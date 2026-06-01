import type { NativeBridgeStateMessage } from "@opencontroller/core/bridge";
import {
  type HidGamepadReport,
  decodeHidGamepadReport,
  encodeHidGamepadReport,
  hidGamepadReportByteLength,
  hidGamepadReportDescriptor,
  hidGamepadReportFromNativeBridgeMessage,
} from "@opencontroller/core/hid";

export type MacosDriverKitInputReport = HidGamepadReport;

export const macosDriverKitHidReportDescriptor = hidGamepadReportDescriptor;
export const macosDriverKitInputReportByteLength = hidGamepadReportByteLength;

export type MacosDriverKitBundleOptions = {
  appBundleIdentifier?: string;
  driverBundleIdentifier?: string;
  executableName?: string;
  driverClassName?: string;
  personalityName?: string;
  productName?: string;
  vendorId?: number;
  productId?: number;
  teamIdentifier?: string;
};

export const defaultMacosDriverKitBundleOptions = {
  appBundleIdentifier: "com.opencontroller.app",
  driverBundleIdentifier: "com.opencontroller.driverkit.virtual-gamepad",
  executableName: "OpenControllerVirtualGamepad",
  driverClassName: "OpenControllerVirtualGamepadDriver",
  personalityName: "OpenController Virtual HID Gamepad",
  productName: "OpenController Virtual HID Gamepad",
  vendorId: 0x4f43,
  productId: 0x0001,
  teamIdentifier: "TEAMID",
} satisfies Required<MacosDriverKitBundleOptions>;

export function macosDriverKitInputReportFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): MacosDriverKitInputReport {
  return hidGamepadReportFromNativeBridgeMessage(message);
}

export function encodeMacosDriverKitInputReport(
  report: MacosDriverKitInputReport,
): Uint8Array {
  return encodeHidGamepadReport(report);
}

export function decodeMacosDriverKitInputReport(
  bytes: Uint8Array,
): MacosDriverKitInputReport {
  return decodeHidGamepadReport(bytes);
}

export function macosDriverKitInputReportBytesFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): Uint8Array {
  return encodeMacosDriverKitInputReport(
    macosDriverKitInputReportFromNativeBridgeMessage(message),
  );
}

export function formatMacosDriverKitHidDescriptorForCpp(
  symbolName = "openControllerHidReportDescriptor",
): string {
  return formatCppByteArray(symbolName, macosDriverKitHidReportDescriptor, 12);
}

export function formatMacosDriverKitInputReportForCpp(
  report: MacosDriverKitInputReport,
  symbolName = "openControllerSampleInputReport",
): string {
  return formatCppByteArray(
    symbolName,
    encodeMacosDriverKitInputReport(report),
    13,
  );
}

export function createMacosDriverKitInfoPlist(
  options: MacosDriverKitBundleOptions = {},
): string {
  const merged = {
    ...defaultMacosDriverKitBundleOptions,
    ...options,
  };

  return xmlPlist([
    dict([
      keyValue("CFBundleDevelopmentRegion", stringValue("en")),
      keyValue("CFBundleExecutable", stringValue(merged.executableName)),
      keyValue(
        "CFBundleIdentifier",
        stringValue(merged.driverBundleIdentifier),
      ),
      keyValue("CFBundleName", stringValue(merged.productName)),
      keyValue("CFBundlePackageType", stringValue("DEXT")),
      keyValue("CFBundleShortVersionString", stringValue("0.1.0")),
      keyValue("CFBundleVersion", stringValue("1")),
      keyValue(
        "IOKitPersonalities",
        dict([
          keyValue(
            merged.personalityName,
            dict([
              keyValue(
                "CFBundleIdentifier",
                stringValue(merged.driverBundleIdentifier),
              ),
              keyValue("IOClass", stringValue("AppleUserHIDDevice")),
              keyValue("IOProviderClass", stringValue("IOResources")),
              keyValue("IOUserClass", stringValue(merged.driverClassName)),
              keyValue(
                "IOUserServerName",
                stringValue(merged.driverBundleIdentifier),
              ),
              keyValue("PrimaryUsagePage", integerValue(0x01)),
              keyValue("PrimaryUsage", integerValue(0x05)),
              keyValue("VendorID", integerValue(merged.vendorId)),
              keyValue("ProductID", integerValue(merged.productId)),
            ]),
          ),
        ]),
      ),
      keyValue(
        "OSBundleUsageDescription",
        stringValue("Provides an OpenController virtual HID gamepad."),
      ),
    ]),
  ]);
}

export function createMacosDriverKitEntitlements(
  options: MacosDriverKitBundleOptions = {},
): string {
  const merged = {
    ...defaultMacosDriverKitBundleOptions,
    ...options,
  };

  return xmlPlist([
    dict([
      keyValue("com.apple.developer.driverkit", trueValue()),
      keyValue("com.apple.developer.driverkit.family.hid.device", trueValue()),
      keyValue(
        "com.apple.developer.driverkit.family.hid.virtual.device",
        trueValue(),
      ),
      keyValue("com.apple.developer.hid.virtual.device", trueValue()),
      keyValue(
        "com.apple.developer.team-identifier",
        stringValue(merged.teamIdentifier),
      ),
    ]),
  ]);
}

export function createMacosHostAppEntitlements(
  options: MacosDriverKitBundleOptions = {},
): string {
  const merged = {
    ...defaultMacosDriverKitBundleOptions,
    ...options,
  };

  return xmlPlist([
    dict([
      keyValue("com.apple.developer.system-extension.install", trueValue()),
      keyValue(
        "com.apple.developer.driverkit.userclient-access",
        array([stringValue(merged.driverBundleIdentifier)]),
      ),
      keyValue(
        "com.apple.developer.team-identifier",
        stringValue(merged.teamIdentifier),
      ),
    ]),
  ]);
}

export function createMacosDriverKitAssetManifest(
  options: MacosDriverKitBundleOptions = {},
) {
  const merged = {
    ...defaultMacosDriverKitBundleOptions,
    ...options,
  };

  return {
    driverBundleIdentifier: merged.driverBundleIdentifier,
    hostAppBundleIdentifier: merged.appBundleIdentifier,
    systemExtensionPath: `Contents/Library/SystemExtensions/${merged.driverBundleIdentifier}.dext`,
    driverClassName: merged.driverClassName,
    hidReportDescriptorBytes: Array.from(macosDriverKitHidReportDescriptor),
    inputReportByteLength: macosDriverKitInputReportByteLength,
    requiredEntitlements: [
      "com.apple.developer.driverkit",
      "com.apple.developer.driverkit.family.hid.virtual.device",
      "com.apple.developer.hid.virtual.device",
      "com.apple.developer.system-extension.install",
      "com.apple.developer.driverkit.userclient-access",
    ],
  };
}

function formatCppByteArray(
  symbolName: string,
  bytes: Uint8Array,
  columns: number,
): string {
  const lines = [`static const uint8_t ${symbolName}[] = {`];

  for (let index = 0; index < bytes.length; index += columns) {
    const chunk = bytes.slice(index, index + columns);
    lines.push(
      `  ${Array.from(chunk, formatHexByte).join(", ")}${
        index + columns < bytes.length ? "," : ""
      }`,
    );
  }

  lines.push("};");
  return lines.join("\n");
}

function formatHexByte(byte: number): string {
  return `0x${byte.toString(16).padStart(2, "0")}`;
}

function xmlPlist(children: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    ...children,
    "</plist>",
    "",
  ].join("\n");
}

function dict(entries: string[]): string {
  return ["<dict>", ...indent(entries), "</dict>"].join("\n");
}

function array(values: string[]): string {
  return ["<array>", ...indent(values), "</array>"].join("\n");
}

function keyValue(key: string, value: string): string {
  return [`<key>${escapeXml(key)}</key>`, value].join("\n");
}

function stringValue(value: string): string {
  return `<string>${escapeXml(value)}</string>`;
}

function integerValue(value: number): string {
  return `<integer>${value}</integer>`;
}

function trueValue(): string {
  return "<true/>";
}

function indent(lines: string[]): string[] {
  return lines.flatMap((line) => line.split("\n").map((part) => `  ${part}`));
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
