import { homedir } from "node:os";
import { posix } from "node:path";
import {
  NativeProcessBridgeAdapter,
  type NativeProcessBridgeAdapterOptions,
} from "@opencontroller/core";
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

export type MacosDriverKitDriverSourceOptions = MacosDriverKitBundleOptions & {
  headerFileName?: string;
  sourceFileName?: string;
};

export type MacosDriverKitHostBridgeAdapterOptions = Pick<
  NativeProcessBridgeAdapterOptions,
  | "args"
  | "cwd"
  | "env"
  | "includeState"
  | "waitForExitMs"
  | "killSignal"
  | "spawn"
  | "onStdout"
  | "onStderr"
  | "onExit"
> &
  Pick<
    MacosDriverKitBundleOptions,
    "appBundleIdentifier" | "driverBundleIdentifier" | "driverClassName"
  > & {
    hostBridgePath?: string;
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

export const defaultMacosDriverKitDriverSourceOptions = {
  ...defaultMacosDriverKitBundleOptions,
  headerFileName: "OpenControllerVirtualGamepadDriver.h",
  sourceFileName: "OpenControllerVirtualGamepadDriver.cpp",
} satisfies Required<MacosDriverKitDriverSourceOptions>;

export function defaultMacosDriverKitHostBridgePath(
  applicationSupportDirectory = posix.join(
    homedir(),
    "Library",
    "Application Support",
  ),
): string {
  return posix.join(
    applicationSupportDirectory,
    "OpenController",
    "bin",
    "OpenControllerDriverKitHostBridge",
  );
}

export function createMacosDriverKitHostBridgeAdapter(
  options: MacosDriverKitHostBridgeAdapterOptions = {},
): NativeProcessBridgeAdapter {
  return new NativeProcessBridgeAdapter({
    command: options.hostBridgePath ?? defaultMacosDriverKitHostBridgePath(),
    args: options.args ?? [],
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: createMacosDriverKitHostBridgeEnv(options),
    includeState: options.includeState ?? false,
    ...(options.waitForExitMs !== undefined
      ? { waitForExitMs: options.waitForExitMs }
      : {}),
    ...(options.killSignal ? { killSignal: options.killSignal } : {}),
    ...(options.spawn ? { spawn: options.spawn } : {}),
    ...(options.onStdout ? { onStdout: options.onStdout } : {}),
    ...(options.onStderr ? { onStderr: options.onStderr } : {}),
    ...(options.onExit ? { onExit: options.onExit } : {}),
  });
}

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

export function createMacosDriverKitDriverHeader(
  options: MacosDriverKitDriverSourceOptions = {},
): string {
  const merged = {
    ...defaultMacosDriverKitDriverSourceOptions,
    ...options,
  };
  const className = toCppIdentifier(merged.driverClassName);
  const guard = `${className.toUpperCase()}_H`;

  return [
    "#pragma once",
    "",
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    "#include <DriverKit/IOMemoryDescriptor.h>",
    "#include <DriverKit/OSData.h>",
    "#include <DriverKit/OSDictionary.h>",
    "#include <HIDDriverKit/IOUserHIDDevice.h>",
    "",
    `class ${className} final : public IOUserHIDDevice {`,
    `  OSDeclareDefaultStructors(${className})`,
    "",
    "public:",
    "  bool init() override;",
    "  void free() override;",
    "  OSDictionary *newDeviceDescription() override;",
    "  OSData *newReportDescriptor() override;",
    "  kern_return_t getReport(",
    "    IOMemoryDescriptor *report,",
    "    IOHIDReportType reportType,",
    "    IOOptionBits options,",
    "    uint32_t completionTimeout,",
    "    OSAction *action",
    "  ) override;",
    "  kern_return_t updateInputReport(const uint8_t *bytes, uint32_t length);",
    "",
    "private:",
    `  uint8_t inputReport[${macosDriverKitInputReportByteLength}];`,
    "};",
    "",
    `#endif  // ${guard}`,
    "",
  ].join("\n");
}

export function createMacosDriverKitDriverSource(
  options: MacosDriverKitDriverSourceOptions = {},
): string {
  const merged = {
    ...defaultMacosDriverKitDriverSourceOptions,
    ...options,
  };
  const className = toCppIdentifier(merged.driverClassName);

  return [
    `#include "${merged.headerFileName}"`,
    "",
    "#include <string.h>",
    "",
    "#include <DriverKit/OSData.h>",
    "#include <DriverKit/OSNumber.h>",
    "#include <DriverKit/OSString.h>",
    "#include <HIDDriverKit/HIDDriverKit.h>",
    "",
    formatMacosDriverKitHidDescriptorForCpp(),
    "",
    `static const uint8_t openControllerNeutralInputReport[${macosDriverKitInputReportByteLength}] = {`,
    "  0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,",
    "  0x00, 0x00, 0x00, 0x00, 0x00, 0x00",
    "};",
    "",
    `OSDefineMetaClassAndStructors(${className}, IOUserHIDDevice)`,
    "",
    `bool ${className}::init()`,
    "{",
    "  if (!super::init()) {",
    "    return false;",
    "  }",
    "",
    "  memcpy(",
    "    inputReport,",
    "    openControllerNeutralInputReport,",
    "    sizeof(inputReport)",
    "  );",
    "  return true;",
    "}",
    "",
    `void ${className}::free()`,
    "{",
    "  super::free();",
    "}",
    "",
    `OSData *${className}::newReportDescriptor()`,
    "{",
    "  return OSData::withBytes(",
    "    openControllerHidReportDescriptor,",
    "    sizeof(openControllerHidReportDescriptor)",
    "  );",
    "}",
    "",
    `OSDictionary *${className}::newDeviceDescription()`,
    "{",
    "  OSDictionary *description = OSDictionary::withCapacity(8);",
    "  if (description == nullptr) {",
    "    return nullptr;",
    "  }",
    "",
    `  description->setObject(kIOHIDVendorIDKey, OSNumber::withNumber(${merged.vendorId}, 32));`,
    `  description->setObject(kIOHIDProductIDKey, OSNumber::withNumber(${merged.productId}, 32));`,
    '  description->setObject(kIOHIDTransportKey, OSString::withCString("Virtual"));',
    `  description->setObject(kIOHIDManufacturerKey, OSString::withCString("OpenController"));`,
    `  description->setObject(kIOHIDProductKey, OSString::withCString("${escapeCString(
      merged.productName,
    )}"));`,
    "  description->setObject(kIOHIDVersionNumberKey, OSNumber::withNumber(1, 32));",
    "  description->setObject(kIOHIDCountryCodeKey, OSNumber::withNumber(0, 32));",
    "  description->setObject(kIOHIDReportIntervalKey, OSNumber::withNumber(1000, 32));",
    "",
    "  return description;",
    "}",
    "",
    `kern_return_t ${className}::getReport(`,
    "  IOMemoryDescriptor *report,",
    "  IOHIDReportType reportType,",
    "  IOOptionBits options,",
    "  uint32_t completionTimeout,",
    "  OSAction *action",
    ")",
    "{",
    "  (void)completionTimeout;",
    "",
    "  if (reportType != kIOHIDReportTypeInput) {",
    "    return kIOReturnUnsupported;",
    "  }",
    "",
    "  if ((options & 0xff) != openControllerNeutralInputReport[0]) {",
    "    return kIOReturnUnsupported;",
    "  }",
    "",
    "  uint64_t bytesWritten = 0;",
    "  kern_return_t result = report->writeBytes(",
    "    0,",
    "    inputReport,",
    "    sizeof(inputReport),",
    "    &bytesWritten",
    "  );",
    "",
    "  if (action != nullptr) {",
    "    CompleteReport(",
    "      report,",
    "      result,",
    "      static_cast<uint32_t>(bytesWritten),",
    "      action",
    "    );",
    "  }",
    "",
    "  return result;",
    "}",
    "",
    `kern_return_t ${className}::updateInputReport(`,
    "  const uint8_t *bytes,",
    "  uint32_t length",
    ")",
    "{",
    "  if (bytes == nullptr || length != sizeof(inputReport)) {",
    "    return kIOReturnBadArgument;",
    "  }",
    "",
    "  memcpy(inputReport, bytes, sizeof(inputReport));",
    "  return kIOReturnSuccess;",
    "}",
    "",
  ].join("\n");
}

export function createMacosDriverKitDriverSourceFiles(
  options: MacosDriverKitDriverSourceOptions = {},
): Record<string, string> {
  const merged = {
    ...defaultMacosDriverKitDriverSourceOptions,
    ...options,
  };

  return {
    [merged.headerFileName]: createMacosDriverKitDriverHeader(merged),
    [merged.sourceFileName]: createMacosDriverKitDriverSource(merged),
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

function escapeCString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function toCppIdentifier(value: string): string {
  const identifier = value.replaceAll(/[^A-Za-z0-9_]/g, "_");
  if (/^[A-Za-z_]/.test(identifier)) {
    return identifier;
  }

  return `_${identifier}`;
}

function createMacosDriverKitHostBridgeEnv(
  options: Pick<
    MacosDriverKitHostBridgeAdapterOptions,
    "appBundleIdentifier" | "driverBundleIdentifier" | "driverClassName" | "env"
  >,
): Record<string, string | undefined> {
  const bundle = {
    ...defaultMacosDriverKitBundleOptions,
    ...options,
  };

  return {
    ...process.env,
    ...options.env,
    OPENCONTROLLER_DRIVERKIT_HOST_APP_BUNDLE_ID: bundle.appBundleIdentifier,
    OPENCONTROLLER_DRIVERKIT_DRIVER_BUNDLE_ID: bundle.driverBundleIdentifier,
    OPENCONTROLLER_DRIVERKIT_SERVICE_NAME: bundle.driverClassName,
  };
}
