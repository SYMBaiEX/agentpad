import {
  type HidGamepadReport,
  createHidGamepadReport,
  encodeHidGamepadReport,
} from "../hid/hid-gamepad";
import {
  type HidPlayStationExtendedReport,
  createHidPlayStationExtendedReport,
  encodeHidPlayStationExtendedReport,
} from "../hid/playstation";
import type { ControllerState, NormalizedControllerCommand } from "../types";
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

export type HidGamepadReportAdapterOptions = {
  onReport?: HidGamepadReportSink;
};

export type HidPlayStationExtendedReportAdapterOptions = {
  onReport?: HidPlayStationExtendedReportSink;
};

export class HidGamepadReportAdapter implements ControllerAdapter {
  readonly name = "hid-gamepad-report";
  readonly platform = "all" as const;
  readonly reports: Array<{
    controllerId: string;
    report: HidGamepadReport;
    bytes: Uint8Array;
  }> = [];
  private connected = false;

  constructor(private readonly options: HidGamepadReportAdapterOptions = {}) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(_command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
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

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      outputFormats: ["controller-state", "hid-gamepad-report"],
      reportFormats: ["hid-gamepad"],
      transport: "callback",
    });
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
  private connected = false;

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

  async neutral(): Promise<void> {
    this.assertConnected();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  capabilities() {
    return createAdapterCapabilities({
      supportsStateSync: true,
      supportsTouchpad: true,
      supportsGyro: true,
      supportedProfiles: ["playstation"],
      outputFormats: ["controller-state", "hid-playstation-extended-report"],
      reportFormats: ["hid-playstation-extended"],
      transport: "callback",
    });
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("HidPlayStationExtendedReportAdapter is not connected");
    }
  }
}
