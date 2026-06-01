import { spawn as spawnChildProcess } from "node:child_process";
import { Readable } from "node:stream";
import {
  type CreateNativeBridgeStateMessageOptions,
  type NativeBridgeMessage,
  createNativeBridgeDisconnectMessage,
  createNativeBridgeStateMessage,
  nativeBridgeFeedbackMessageToControllerFeedback,
  parseNativeBridgeMessage,
  serializeNativeBridgeMessage,
} from "../bridge";
import { AdapterError } from "../errors";
import { EventEmitter, type Unsubscribe } from "../events";
import type {
  ControllerAdapterVirtualDeviceKind,
  ControllerFeedbackEvent,
  ControllerState,
  FeedbackListener,
  NormalizedControllerCommand,
} from "../types";
import {
  type ControllerAdapter,
  controllerCommandTypes,
  createAdapterCapabilities,
} from "./adapter";

export type NativeProcessBridgeWritable = {
  write(chunk: string): number | Promise<number>;
  flush?(): number | Promise<number>;
  end?(error?: Error): number | Promise<number>;
};

export type NativeProcessBridgeProcess = {
  stdin: NativeProcessBridgeWritable;
  stdout?: ReadableStream<Uint8Array> | null;
  stderr?: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill(signal?: number | NodeJS.Signals): void;
};

export type NativeProcessBridgeSpawnOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
};

export type NativeProcessBridgeSpawner = (
  command: string,
  args: string[],
  options: NativeProcessBridgeSpawnOptions,
) => NativeProcessBridgeProcess;

export type NativeProcessBridgeAdapterOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  includeState?: boolean;
  includeExtensions?: boolean;
  includeProfileHidReport?: boolean;
  waitForExitMs?: number;
  killSignal?: number | NodeJS.Signals;
  spawn?: NativeProcessBridgeSpawner;
  supportsVirtualDevice?: boolean;
  supportsRumble?: boolean;
  virtualDeviceKind?: ControllerAdapterVirtualDeviceKind;
  requiresNativeInstall?: boolean;
  requiresElevatedPermissions?: boolean;
  onFeedback?: FeedbackListener;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onExit?: (exitCode: number) => void;
};

export class NativeProcessBridgeAdapter implements ControllerAdapter {
  readonly name = "native-process";
  readonly platform = "all" as const;
  readonly messages: NativeBridgeMessage[] = [];
  private readonly feedbackEvents = new EventEmitter<{
    feedback: ControllerFeedbackEvent;
  }>();
  private process: NativeProcessBridgeProcess | undefined;
  private exitCode: number | undefined;
  private connected = false;
  private controllerId: string | undefined;
  private stdoutBuffer = "";

  constructor(private readonly options: NativeProcessBridgeAdapterOptions) {}

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const args = this.options.args ?? [];
    const spawn = this.options.spawn ?? defaultSpawnNativeProcess;
    this.process = spawn(this.options.command, args, {
      ...(this.options.cwd ? { cwd: this.options.cwd } : {}),
      ...(this.options.env ? { env: this.options.env } : {}),
    });
    this.connected = true;
    this.exitCode = undefined;

    this.consumeOutput(
      this.process.stdout,
      (chunk) => {
        this.options.onStdout?.(chunk);
        this.consumeStdoutFeedback(chunk);
      },
      () => this.flushStdoutFeedback(),
    );
    this.consumeOutput(this.process.stderr, this.options.onStderr);
    void this.process.exited.then((exitCode) => {
      this.exitCode = exitCode;
      this.options.onExit?.(exitCode);
    });
  }

  async send(_command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
    this.controllerId = state.id;
    await this.emit(
      createNativeBridgeStateMessage(state, this.stateMessageOptions()),
    );
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  onFeedback(listener: FeedbackListener): Unsubscribe {
    return this.feedbackEvents.on("feedback", listener);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      if (this.controllerId) {
        await this.emit(createNativeBridgeDisconnectMessage(this.controllerId));
      }
      await this.process?.stdin.end?.();
      await this.waitForExit();
    } finally {
      this.connected = false;
      this.process = undefined;
    }
  }

  capabilities() {
    const supportsRumble = this.options.supportsRumble ?? false;
    const supportsVirtualDevice = this.options.supportsVirtualDevice ?? true;
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsXInputReports: true,
      supportsNativeBridge: true,
      supportsRumble,
      supportsTouchpad: true,
      supportsGyro: true,
      supportsVirtualDevice,
      supportedCommands: controllerCommandTypes,
      requiresNativeInstall: this.options.requiresNativeInstall ?? true,
      requiresElevatedPermissions:
        this.options.requiresElevatedPermissions ?? false,
      outputFormats: [
        "controller-state",
        "xinput-report",
        "hid-gamepad-report",
        "native-bridge-jsonl",
      ],
      reportFormats: supportsRumble
        ? [
            "xinput",
            "hid-gamepad",
            "hid-playstation-extended",
            "hid-gamepad-rumble",
          ]
        : ["xinput", "hid-gamepad", "hid-playstation-extended"],
      feedbackTypes: supportsRumble ? ["rumble"] : [],
      transport: "native-process",
      virtualDeviceKind:
        this.options.virtualDeviceKind ??
        (supportsVirtualDevice ? "native-helper" : "none"),
    });
  }

  private async emit(message: NativeBridgeMessage): Promise<void> {
    this.assertConnected();
    const process = this.process;
    if (!process) {
      throw new AdapterError(
        "NATIVE_PROCESS_NOT_CONNECTED",
        "Native process adapter is not connected",
      );
    }

    const line = serializeNativeBridgeMessage(message);
    this.messages.push(message);
    await process.stdin.write(line);
    await process.stdin.flush?.();
  }

  private async waitForExit(): Promise<void> {
    const process = this.process;
    if (!process) {
      return;
    }

    const waitForExitMs = this.options.waitForExitMs ?? 1000;
    if (waitForExitMs < 0) {
      return;
    }

    const exitCode = await Promise.race([
      process.exited,
      sleep(waitForExitMs).then(() => undefined),
    ]);

    if (exitCode === undefined) {
      process.kill(this.options.killSignal ?? "SIGTERM");
      return;
    }
    if (exitCode !== 0) {
      throw new AdapterError(
        "NATIVE_PROCESS_EXITED",
        `Native bridge process exited with code ${exitCode}`,
      );
    }
  }

  private consumeOutput(
    stream: ReadableStream<Uint8Array> | null | undefined,
    callback: ((chunk: string) => void) | undefined,
    onEnd?: () => void,
  ): void {
    if (!stream) {
      return;
    }

    const decoder = new TextDecoder();
    void (async () => {
      const reader = stream.getReader();
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) {
            break;
          }
          callback?.(decoder.decode(next.value, { stream: true }));
        }
        const tail = decoder.decode();
        if (tail) {
          callback?.(tail);
        }
        onEnd?.();
      } catch {
        // Output capture is diagnostic only; command writes surface separately.
      } finally {
        reader.releaseLock();
      }
    })();
  }

  private stateMessageOptions(): CreateNativeBridgeStateMessageOptions {
    return {
      ...(this.options.includeState !== undefined
        ? { includeState: this.options.includeState }
        : {}),
      ...(this.options.includeExtensions !== undefined
        ? { includeExtensions: this.options.includeExtensions }
        : {}),
      ...(this.options.includeProfileHidReport !== undefined
        ? { includeProfileHidReport: this.options.includeProfileHidReport }
        : {}),
    };
  }

  private consumeStdoutFeedback(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      this.consumeStdoutFeedbackLine(line);
    }
  }

  private flushStdoutFeedback(): void {
    if (!this.stdoutBuffer.trim()) {
      this.stdoutBuffer = "";
      return;
    }

    this.consumeStdoutFeedbackLine(this.stdoutBuffer);
    this.stdoutBuffer = "";
  }

  private consumeStdoutFeedbackLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      const message = parseNativeBridgeMessage(trimmed);
      if (message.type !== "opencontroller.bridge.feedback") {
        return;
      }
      if (!this.controllerId || message.controllerId !== this.controllerId) {
        return;
      }

      const event = nativeBridgeFeedbackMessageToControllerFeedback(message);
      this.options.onFeedback?.(event);
      this.feedbackEvents.emit("feedback", event);
    } catch {
      // Helper stdout may contain human-readable diagnostics; only JSONL feedback is consumed.
    }
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new AdapterError(
        "NATIVE_PROCESS_NOT_CONNECTED",
        "Native process adapter is not connected",
      );
    }
    if (this.exitCode !== undefined) {
      throw new AdapterError(
        "NATIVE_PROCESS_EXITED",
        `Native bridge process exited with code ${this.exitCode}`,
      );
    }
  }
}

function defaultSpawnNativeProcess(
  command: string,
  args: string[],
  options: NativeProcessBridgeSpawnOptions,
): NativeProcessBridgeProcess {
  const bun = (globalThis as typeof globalThis & { Bun?: typeof Bun }).Bun;
  if (bun) {
    return bun.spawn([command, ...args], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: options.env } : {}),
    });
  }

  const child = spawnChildProcess(command, args, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env as NodeJS.ProcessEnv } : {}),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const exited = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 0));
  });

  return {
    stdin: {
      write(chunk) {
        return new Promise<number>((resolve, reject) => {
          child.stdin.write(chunk, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(chunk.length);
            }
          });
        });
      },
      flush() {
        return 0;
      },
      end() {
        child.stdin.end();
        return 0;
      },
    },
    stdout: child.stdout
      ? (Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>)
      : null,
    stderr: child.stderr
      ? (Readable.toWeb(child.stderr) as unknown as ReadableStream<Uint8Array>)
      : null,
    exited,
    kill(signal) {
      child.kill(signal);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
