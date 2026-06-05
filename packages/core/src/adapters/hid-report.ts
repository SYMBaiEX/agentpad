import { EventEmitter, type Unsubscribe } from "../events";
import {
  type HidGamepadReport,
  type HidGamepadRumbleEffect,
  type HidGamepadRumbleReport,
  createHidGamepadReport,
  createHidGamepadRumbleReport,
  decodeHidGamepadRumbleReport,
  encodeHidGamepadReport,
  encodeHidGamepadRumbleReport,
} from "../hid/hid-gamepad";
import {
  type HidPlayStationExtendedReport,
  createHidPlayStationExtendedReport,
  encodeHidPlayStationExtendedReport,
} from "../hid/playstation";
import {
  type HidSwitchExtendedReport,
  createHidSwitchExtendedReport,
  encodeHidSwitchExtendedReport,
} from "../hid/switch";
import type {
  ControllerFeedbackEvent,
  ControllerState,
  FeedbackListener,
  NormalizedControllerCommand,
} from "../types";
import { type ControllerAdapter, createAdapterCapabilities } from "./adapter";

export type HidGamepadReportSink = (event: {
  controllerId: string;
  state: ControllerState;
  report: HidGamepadReport;
  bytes: Uint8Array;
}) => Promise<void> | void;

export type HidPlayStationExtendedReportSink = (event: {
  controllerId: string;
  state: ControllerState;
  report: HidPlayStationExtendedReport;
  bytes: Uint8Array;
}) => Promise<void> | void;

export type HidSwitchExtendedReportSink = (event: {
  controllerId: string;
  state: ControllerState;
  report: HidSwitchExtendedReport;
  bytes: Uint8Array;
}) => Promise<void> | void;

export type HidRumbleFeedbackOptions = {
  controllerId?: string;
  timestamp?: number;
  durationMs?: number;
  source?: string;
};

export type HidGamepadReportAdapterOptions = {
  onReport?: HidGamepadReportSink;
  onFeedback?: FeedbackListener;
};

export type HidPlayStationExtendedReportAdapterOptions = {
  onReport?: HidPlayStationExtendedReportSink;
  onFeedback?: FeedbackListener;
};

export type HidSwitchExtendedReportAdapterOptions = {
  onReport?: HidSwitchExtendedReportSink;
  onFeedback?: FeedbackListener;
};

export class HidGamepadReportAdapter implements ControllerAdapter {
  readonly name = "hid-gamepad-report";
  readonly platform = "all" as const;
  readonly reports: Array<{
    controllerId: string;
    report: HidGamepadReport;
    bytes: Uint8Array;
  }> = [];
  private readonly feedbackEvents = new EventEmitter<{
    feedback: ControllerFeedbackEvent;
  }>();
  private connected = false;
  private controllerId: string | undefined;

  constructor(private readonly options: HidGamepadReportAdapterOptions = {}) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(_command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
    this.controllerId = state.id;
    const report = createHidGamepadReport(state);
    const bytes = encodeHidGamepadReport(report);
    const event = {
      controllerId: state.id,
      state,
      report,
      bytes,
    };
    this.reports.push({
      controllerId: event.controllerId,
      report,
      bytes,
    });
    await this.options.onReport?.(event);
  }

  receiveOutputReport(
    bytes: Uint8Array,
    options: HidRumbleFeedbackOptions = {},
  ): ControllerFeedbackEvent {
    this.assertConnected();
    const report = decodeHidGamepadRumbleReport(bytes);
    const canonicalBytes = encodeHidGamepadRumbleReport(report);
    return this.emitRumbleFeedback(report, canonicalBytes, options);
  }

  receiveRumbleReport(
    effectOrReport: HidGamepadRumbleEffect | HidGamepadRumbleReport,
    options: HidRumbleFeedbackOptions = {},
  ): ControllerFeedbackEvent {
    this.assertConnected();
    const report =
      "reportId" in effectOrReport
        ? effectOrReport
        : createHidGamepadRumbleReport(effectOrReport);
    const bytes = encodeHidGamepadRumbleReport(report);
    const decoded = decodeHidGamepadRumbleReport(bytes);
    return this.emitRumbleFeedback(decoded, bytes, options);
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  onFeedback(listener: FeedbackListener): Unsubscribe {
    return this.feedbackEvents.on("feedback", listener);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsRumble: true,
      outputFormats: ["controller-state", "hid-gamepad-report"],
      reportFormats: ["hid-gamepad", "hid-gamepad-rumble"],
      feedbackTypes: ["rumble"],
      transport: "callback",
    });
  }

  private emitRumbleFeedback(
    report: HidGamepadRumbleReport,
    bytes: Uint8Array,
    options: HidRumbleFeedbackOptions,
  ): ControllerFeedbackEvent {
    const controllerId = options.controllerId ?? this.controllerId;
    if (!controllerId) {
      throw new Error(
        "HidGamepadReportAdapter has not synced a controller state; pass controllerId to receiveOutputReport",
      );
    }

    const event: ControllerFeedbackEvent = {
      type: "rumble",
      controllerId,
      timestamp: options.timestamp ?? Date.now(),
      weakMotor: fromU8(report.weakMotor),
      strongMotor: fromU8(report.strongMotor),
      leftTriggerMotor: fromU8(report.leftTriggerMotor),
      rightTriggerMotor: fromU8(report.rightTriggerMotor),
      source: options.source ?? this.name,
      reportFormat: "hid-gamepad-rumble",
      reportId: report.reportId,
      reportBase64: bytesToBase64(bytes),
      ...(options.durationMs !== undefined
        ? { durationMs: options.durationMs }
        : {}),
    };
    this.options.onFeedback?.(event);
    this.feedbackEvents.emit("feedback", event);
    return event;
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("HidGamepadReportAdapter is not connected");
    }
  }
}

export class HidPlayStationExtendedReportAdapter implements ControllerAdapter {
  readonly name = "hid-playstation-extended-report";
  readonly platform = "all" as const;
  readonly reports: Array<{
    controllerId: string;
    report: HidPlayStationExtendedReport;
    bytes: Uint8Array;
  }> = [];
  private readonly feedbackEvents = new EventEmitter<{
    feedback: ControllerFeedbackEvent;
  }>();
  private connected = false;
  private controllerId: string | undefined;

  constructor(
    private readonly options: HidPlayStationExtendedReportAdapterOptions = {},
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(_command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
    this.controllerId = state.id;
    const report = createHidPlayStationExtendedReport(state);
    const bytes = encodeHidPlayStationExtendedReport(report);
    const event = {
      controllerId: state.id,
      state,
      report,
      bytes,
    };
    this.reports.push({
      controllerId: event.controllerId,
      report,
      bytes,
    });
    await this.options.onReport?.(event);
  }

  receiveOutputReport(
    bytes: Uint8Array,
    options: HidRumbleFeedbackOptions = {},
  ): ControllerFeedbackEvent {
    this.assertConnected();
    const report = decodeHidGamepadRumbleReport(bytes);
    const canonicalBytes = encodeHidGamepadRumbleReport(report);
    return this.emitRumbleFeedback(report, canonicalBytes, options);
  }

  receiveRumbleReport(
    effectOrReport: HidGamepadRumbleEffect | HidGamepadRumbleReport,
    options: HidRumbleFeedbackOptions = {},
  ): ControllerFeedbackEvent {
    this.assertConnected();
    const report =
      "reportId" in effectOrReport
        ? effectOrReport
        : createHidGamepadRumbleReport(effectOrReport);
    const bytes = encodeHidGamepadRumbleReport(report);
    const decoded = decodeHidGamepadRumbleReport(bytes);
    return this.emitRumbleFeedback(decoded, bytes, options);
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  onFeedback(listener: FeedbackListener): Unsubscribe {
    return this.feedbackEvents.on("feedback", listener);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsRumble: true,
      supportsTouchpad: true,
      supportsGyro: true,
      supportedProfiles: ["playstation"],
      outputFormats: ["controller-state", "hid-playstation-extended-report"],
      reportFormats: ["hid-playstation-extended", "hid-gamepad-rumble"],
      feedbackTypes: ["rumble"],
      transport: "callback",
    });
  }

  private emitRumbleFeedback(
    report: HidGamepadRumbleReport,
    bytes: Uint8Array,
    options: HidRumbleFeedbackOptions,
  ): ControllerFeedbackEvent {
    const controllerId = options.controllerId ?? this.controllerId;
    if (!controllerId) {
      throw new Error(
        "HidPlayStationExtendedReportAdapter has not synced a controller state; pass controllerId to receiveOutputReport",
      );
    }

    const event: ControllerFeedbackEvent = {
      type: "rumble",
      controllerId,
      timestamp: options.timestamp ?? Date.now(),
      weakMotor: fromU8(report.weakMotor),
      strongMotor: fromU8(report.strongMotor),
      leftTriggerMotor: fromU8(report.leftTriggerMotor),
      rightTriggerMotor: fromU8(report.rightTriggerMotor),
      source: options.source ?? this.name,
      reportFormat: "hid-gamepad-rumble",
      reportId: report.reportId,
      reportBase64: bytesToBase64(bytes),
      ...(options.durationMs !== undefined
        ? { durationMs: options.durationMs }
        : {}),
    };
    this.options.onFeedback?.(event);
    this.feedbackEvents.emit("feedback", event);
    return event;
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("HidPlayStationExtendedReportAdapter is not connected");
    }
  }
}

export class HidSwitchExtendedReportAdapter implements ControllerAdapter {
  readonly name = "hid-switch-extended-report";
  readonly platform = "all" as const;
  readonly reports: Array<{
    controllerId: string;
    report: HidSwitchExtendedReport;
    bytes: Uint8Array;
  }> = [];
  private readonly feedbackEvents = new EventEmitter<{
    feedback: ControllerFeedbackEvent;
  }>();
  private connected = false;
  private controllerId: string | undefined;

  constructor(
    private readonly options: HidSwitchExtendedReportAdapterOptions = {},
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(_command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
    this.controllerId = state.id;
    const report = createHidSwitchExtendedReport(state);
    const bytes = encodeHidSwitchExtendedReport(report);
    const event = {
      controllerId: state.id,
      state,
      report,
      bytes,
    };
    this.reports.push({
      controllerId: event.controllerId,
      report,
      bytes,
    });
    await this.options.onReport?.(event);
  }

  receiveOutputReport(
    bytes: Uint8Array,
    options: HidRumbleFeedbackOptions = {},
  ): ControllerFeedbackEvent {
    this.assertConnected();
    const report = decodeHidGamepadRumbleReport(bytes);
    const canonicalBytes = encodeHidGamepadRumbleReport(report);
    return this.emitRumbleFeedback(report, canonicalBytes, options);
  }

  receiveRumbleReport(
    effectOrReport: HidGamepadRumbleEffect | HidGamepadRumbleReport,
    options: HidRumbleFeedbackOptions = {},
  ): ControllerFeedbackEvent {
    this.assertConnected();
    const report =
      "reportId" in effectOrReport
        ? effectOrReport
        : createHidGamepadRumbleReport(effectOrReport);
    const bytes = encodeHidGamepadRumbleReport(report);
    const decoded = decodeHidGamepadRumbleReport(bytes);
    return this.emitRumbleFeedback(decoded, bytes, options);
  }

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  onFeedback(listener: FeedbackListener): Unsubscribe {
    return this.feedbackEvents.on("feedback", listener);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsRumble: true,
      supportsGyro: true,
      supportedProfiles: ["switch"],
      outputFormats: ["controller-state", "hid-switch-extended-report"],
      reportFormats: ["hid-switch-extended", "hid-gamepad-rumble"],
      feedbackTypes: ["rumble"],
      transport: "callback",
    });
  }

  private emitRumbleFeedback(
    report: HidGamepadRumbleReport,
    bytes: Uint8Array,
    options: HidRumbleFeedbackOptions,
  ): ControllerFeedbackEvent {
    const controllerId = options.controllerId ?? this.controllerId;
    if (!controllerId) {
      throw new Error(
        "HidSwitchExtendedReportAdapter has not synced a controller state; pass controllerId to receiveOutputReport",
      );
    }

    const event: ControllerFeedbackEvent = {
      type: "rumble",
      controllerId,
      timestamp: options.timestamp ?? Date.now(),
      weakMotor: fromU8(report.weakMotor),
      strongMotor: fromU8(report.strongMotor),
      leftTriggerMotor: fromU8(report.leftTriggerMotor),
      rightTriggerMotor: fromU8(report.rightTriggerMotor),
      source: options.source ?? this.name,
      reportFormat: "hid-gamepad-rumble",
      reportId: report.reportId,
      reportBase64: bytesToBase64(bytes),
      ...(options.durationMs !== undefined
        ? { durationMs: options.durationMs }
        : {}),
    };
    this.options.onFeedback?.(event);
    this.feedbackEvents.emit("feedback", event);
    return event;
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("HidSwitchExtendedReportAdapter is not connected");
    }
  }
}

function fromU8(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(255, Math.max(0, value)) / 255;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
