import { describe, expect, test } from "bun:test";
import {
  type NativeProcessBridgeSpawner,
  createController,
} from "@opencontroller/core";
import {
  createLinuxUinputBridgeAdapter,
  defaultLinuxUinputHelperPath,
} from "../linux-uinput";

describe("linux uinput adapter helpers", () => {
  test("creates the default helper path", () => {
    expect(defaultLinuxUinputHelperPath("/home/agent")).toBe(
      "/home/agent/.opencontroller/bin/opencontroller-uinput-bridge",
    );
  });

  test("wraps the native process adapter with Linux uinput environment", async () => {
    const writes: string[] = [];
    const calls: Array<{
      command: string;
      args: string[];
      env?: Record<string, string | undefined>;
    }> = [];
    let resolveExit: (exitCode: number) => void = () => {};
    const spawn: NativeProcessBridgeSpawner = (command, args, options) => {
      calls.push({ command, args, env: options.env });
      return {
        stdin: {
          write(chunk) {
            writes.push(chunk);
            return chunk.length;
          },
          flush() {
            return 0;
          },
          end() {
            resolveExit(0);
            return 0;
          },
        },
        stdout: null,
        stderr: null,
        exited: new Promise<number>((resolve) => {
          resolveExit = resolve;
        }),
        kill() {},
      };
    };

    const adapter = createLinuxUinputBridgeAdapter({
      helperPath: "/tmp/opencontroller-uinput-bridge",
      devicePath: "/tmp/uinput",
      deviceName: "OpenController Test Pad",
      dryRun: true,
      waitForExitMs: 50,
      spawn,
    });
    const controller = await createController({
      id: "linux-player",
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("A", 1);
    await controller.disconnect();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("/tmp/opencontroller-uinput-bridge");
    expect(calls[0]?.args).toEqual(["--dry-run"]);
    expect(calls[0]?.env?.OPENCONTROLLER_UINPUT_DEVICE).toBe("/tmp/uinput");
    expect(calls[0]?.env?.OPENCONTROLLER_UINPUT_NAME).toBe(
      "OpenController Test Pad",
    );
    expect(calls[0]?.env?.OPENCONTROLLER_UINPUT_DRY_RUN).toBe("1");
    expect(writes.some((line) => line.includes('"hidReportBase64"'))).toBe(
      true,
    );
    expect(writes.at(-1)).toContain("opencontroller.bridge.disconnect");
  });
});
