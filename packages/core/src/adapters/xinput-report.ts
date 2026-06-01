import {
  type XInputGamepadReport,
  createXInputReport,
  encodeXInputReport,
} from "../hid/xinput";
import type { ControllerState, NormalizedControllerCommand } from "../types";
import { type ControllerAdapter, createAdapterCapabilities } from "./adapter";

export type XInputReportSink = (event: {
  controllerId: string;
  state: ControllerState;
  report: XInputGamepadReport;
  bytes: Uint8Array;
}) => Promise<void> | void;

export type XInputReportAdapterOptions = {
  onReport?: XInputReportSink;
};

export class XInputReportAdapter implements ControllerAdapter {
  readonly name = "xinput-report";
  readonly platform = "all" as const;
  readonly reports: Array<{
    controllerId: string;
    report: XInputGamepadReport;
    bytes: Uint8Array;
  }> = [];
  private connected = false;

  constructor(private readonly options: XInputReportAdapterOptions = {}) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async send(_command: NormalizedControllerCommand): Promise<void> {
    this.assertConnected();
  }

  async syncState(state: ControllerState): Promise<void> {
    this.assertConnected();
    const report = createXInputReport(state);
    const bytes = encodeXInputReport(report);
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
      supportsXInputReports: true,
      outputFormats: ["controller-state", "xinput-report"],
      reportFormats: ["xinput"],
      transport: "callback",
    });
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("XInputReportAdapter is not connected");
    }
  }
}
