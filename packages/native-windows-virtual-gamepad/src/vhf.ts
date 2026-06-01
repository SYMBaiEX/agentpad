import type { NativeBridgeStateMessage } from "@opencontroller/core/bridge";
import {
  type HidGamepadReport,
  decodeHidGamepadReport,
  encodeHidGamepadReport,
  hidGamepadReportByteLength,
  hidGamepadReportDescriptor,
  hidGamepadReportFromNativeBridgeMessage,
} from "@opencontroller/core/hid";

export type WindowsVhfInputReport = HidGamepadReport;

export const windowsVhfHidReportDescriptor = hidGamepadReportDescriptor;
export const windowsVhfInputReportByteLength = hidGamepadReportByteLength;

export type WindowsVhfInfOptions = {
  deviceName?: string;
  manufacturerName?: string;
  providerName?: string;
  hardwareId?: string;
  serviceName?: string;
  driverBinary?: string;
  catalogFile?: string;
  driverVersion?: string;
  architecture?: "NTamd64" | "NTarm64" | "NTx86" | (string & {});
};

export const defaultWindowsVhfInfOptions = {
  deviceName: "OpenController Virtual HID Gamepad",
  manufacturerName: "OpenController",
  providerName: "OpenController",
  hardwareId: "Root\\OpenControllerVhfGamepad",
  serviceName: "OpenControllerVhfGamepad",
  driverBinary: "OpenControllerVhfGamepad.sys",
  catalogFile: "OpenControllerVhfGamepad.cat",
  driverVersion: "06/01/2026,0.1.0.0",
  architecture: "NTamd64",
} satisfies Required<WindowsVhfInfOptions>;

export function windowsVhfInputReportFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): WindowsVhfInputReport {
  return hidGamepadReportFromNativeBridgeMessage(message);
}

export function encodeWindowsVhfInputReport(
  report: WindowsVhfInputReport,
): Uint8Array {
  return encodeHidGamepadReport(report);
}

export function decodeWindowsVhfInputReport(
  bytes: Uint8Array,
): WindowsVhfInputReport {
  return decodeHidGamepadReport(bytes);
}

export function windowsVhfInputReportBytesFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): Uint8Array {
  return encodeWindowsVhfInputReport(
    windowsVhfInputReportFromNativeBridgeMessage(message),
  );
}

export function formatWindowsVhfHidDescriptorForC(
  symbolName = "OpenControllerHidReportDescriptor",
): string {
  return formatCByteArray(symbolName, windowsVhfHidReportDescriptor, {
    storageClass: "static const UCHAR",
    columns: 12,
  });
}

export function formatWindowsVhfInputReportForC(
  report: WindowsVhfInputReport,
  symbolName = "OpenControllerSampleInputReport",
): string {
  return formatCByteArray(symbolName, encodeWindowsVhfInputReport(report), {
    storageClass: "static const UCHAR",
    columns: 13,
  });
}

export function createWindowsVhfInf(
  options: WindowsVhfInfOptions = {},
): string {
  const merged = {
    ...defaultWindowsVhfInfOptions,
    ...options,
  };

  return [
    "; OpenController Windows VHF driver INF template",
    "; Review and sign this driver package before installation.",
    "",
    "[Version]",
    'Signature="$WINDOWS NT$"',
    "Class=HIDClass",
    "ClassGuid={745A17A0-74D3-11D0-B6FE-00A0C90F57DA}",
    "Provider=%ProviderName%",
    `DriverVer=${merged.driverVersion}`,
    `CatalogFile=${merged.catalogFile}`,
    "",
    "[Manufacturer]",
    `%ManufacturerName%=Standard,${merged.architecture}`,
    "",
    `[Standard.${merged.architecture}]`,
    `%DeviceName%=OpenControllerVhf_Install, ${merged.hardwareId}`,
    "",
    "[OpenControllerVhf_Install.NT]",
    "CopyFiles=OpenControllerVhf_CopyFiles",
    "",
    "[OpenControllerVhf_CopyFiles]",
    merged.driverBinary,
    "",
    "[OpenControllerVhf_Install.NT.Services]",
    "AddService=%ServiceName%,0x00000002,OpenControllerVhf_Service",
    "",
    "[OpenControllerVhf_Service]",
    "DisplayName=%ServiceName%",
    "ServiceType=1",
    "StartType=3",
    "ErrorControl=1",
    `ServiceBinary=%12%\\${merged.driverBinary}`,
    "",
    "[OpenControllerVhf_Install.NT.HW]",
    "AddReg=OpenControllerVhf_AddReg",
    "",
    "[OpenControllerVhf_AddReg]",
    'HKR,,"LowerFilters",0x00010000,"vhf"',
    "",
    "[DestinationDirs]",
    "OpenControllerVhf_CopyFiles=12",
    "",
    "[Strings]",
    `DeviceName="${merged.deviceName}"`,
    `ManufacturerName="${merged.manufacturerName}"`,
    `ProviderName="${merged.providerName}"`,
    `ServiceName="${merged.serviceName}"`,
    "",
  ].join("\n");
}

function formatCByteArray(
  symbolName: string,
  bytes: Uint8Array,
  options: { storageClass: string; columns: number },
): string {
  const lines = [`${options.storageClass} ${symbolName}[] = {`];

  for (let index = 0; index < bytes.length; index += options.columns) {
    const chunk = bytes.slice(index, index + options.columns);
    lines.push(
      `  ${Array.from(chunk, formatHexByte).join(", ")}${
        index + options.columns < bytes.length ? "," : ""
      }`,
    );
  }

  lines.push("};");
  return lines.join("\n");
}

function formatHexByte(byte: number): string {
  return `0x${byte.toString(16).padStart(2, "0")}`;
}
