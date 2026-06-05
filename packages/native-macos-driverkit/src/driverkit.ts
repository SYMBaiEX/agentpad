import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, posix, resolve } from "node:path";
import {
  NativeProcessBridgeAdapter,
  type NativeProcessBridgeAdapterOptions,
} from "@opencontroller/core";
import {
  type NativeBridgeStateMessage,
  nativeBridgeMessageToProfileHidReportBytes,
} from "@opencontroller/core/bridge";
import {
  type HidGamepadReport,
  type HidGamepadRumbleEffect,
  type HidGamepadRumbleReport,
  type HidPlayStationExtendedReport,
  type HidSwitchExtendedReport,
  decodeHidGamepadReport,
  decodeHidGamepadRumbleReport,
  decodeHidPlayStationExtendedReport,
  decodeHidSwitchExtendedReport,
  encodeHidGamepadReport,
  encodeHidGamepadRumbleReport,
  encodeHidPlayStationExtendedReport,
  encodeHidSwitchExtendedReport,
  hidGamepadReportByteLength,
  hidGamepadReportDescriptor,
  hidGamepadReportDescriptorWithRumble,
  hidGamepadReportFromNativeBridgeMessage,
  hidGamepadReportId,
  hidGamepadRumbleReportByteLength,
  hidGamepadRumbleReportId,
  hidPlayStationExtendedReportByteLength,
  hidPlayStationExtendedReportDescriptor,
  hidPlayStationExtendedReportDescriptorWithRumble,
  hidPlayStationExtendedReportId,
  hidSwitchExtendedReportByteLength,
  hidSwitchExtendedReportDescriptor,
  hidSwitchExtendedReportDescriptorWithRumble,
  hidSwitchExtendedReportId,
} from "@opencontroller/core/hid";

export type MacosDriverKitReportProfile = "generic" | "playstation" | "switch";
export type MacosDriverKitInputReport = HidGamepadReport;
export type MacosDriverKitPlayStationInputReport = HidPlayStationExtendedReport;
export type MacosDriverKitSwitchInputReport = HidSwitchExtendedReport;
export type MacosDriverKitRumbleReport = HidGamepadRumbleReport;

export const macosDriverKitHidReportDescriptor = hidGamepadReportDescriptor;
export const macosDriverKitHidReportDescriptorWithRumble =
  hidGamepadReportDescriptorWithRumble;
export const macosDriverKitInputReportByteLength = hidGamepadReportByteLength;
export const macosDriverKitPlayStationHidReportDescriptor =
  hidPlayStationExtendedReportDescriptor;
export const macosDriverKitPlayStationHidReportDescriptorWithRumble =
  hidPlayStationExtendedReportDescriptorWithRumble;
export const macosDriverKitPlayStationInputReportByteLength =
  hidPlayStationExtendedReportByteLength;
export const macosDriverKitPlayStationInputReportId =
  hidPlayStationExtendedReportId;
export const macosDriverKitSwitchHidReportDescriptor =
  hidSwitchExtendedReportDescriptor;
export const macosDriverKitSwitchHidReportDescriptorWithRumble =
  hidSwitchExtendedReportDescriptorWithRumble;
export const macosDriverKitSwitchInputReportByteLength =
  hidSwitchExtendedReportByteLength;
export const macosDriverKitSwitchInputReportId = hidSwitchExtendedReportId;
export const macosDriverKitRumbleReportId = hidGamepadRumbleReportId;
export const macosDriverKitRumbleReportByteLength =
  hidGamepadRumbleReportByteLength;

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
  reportProfile?: MacosDriverKitReportProfile;
  headerFileName?: string;
  sourceFileName?: string;
};

export type MacosDriverKitAssetManifestOptions = MacosDriverKitBundleOptions & {
  reportProfile?: MacosDriverKitReportProfile;
};

export type MacosDriverKitHostBridgeAdapterOptions = Pick<
  NativeProcessBridgeAdapterOptions,
  | "args"
  | "cwd"
  | "env"
  | "includeState"
  | "includeExtensions"
  | "includeProfileHidReport"
  | "waitForExitMs"
  | "killSignal"
  | "spawn"
  | "supportsVirtualDevice"
  | "supportsRumble"
  | "supportsLights"
  | "virtualDeviceKind"
  | "requiresNativeInstall"
  | "requiresElevatedPermissions"
  | "onFeedback"
  | "onStdout"
  | "onStderr"
  | "onExit"
> &
  Pick<
    MacosDriverKitBundleOptions,
    "appBundleIdentifier" | "driverBundleIdentifier" | "driverClassName"
  > & {
    controllerId?: string;
    hostBridgePath?: string;
  };

export type PrepareMacosDriverKitSetupOptions = {
  platform?: NodeJS.Platform;
  outputDirectory?: string;
  bundle?: MacosDriverKitBundleOptions;
  driver?: MacosDriverKitDriverSourceOptions;
  hostBridgePath?: string;
};

export type MacosDriverKitSetupPlan = {
  platform: NodeJS.Platform;
  outputDirectory: string;
  driverDirectory: string;
  hostAppDirectory: string;
  hostBridgePath: string;
  appBundleIdentifier: string;
  driverBundleIdentifier: string;
  driverClassName: string;
  reportProfile: MacosDriverKitReportProfile;
  files: string[];
  infoPlistPath: string;
  driverEntitlementsPath: string;
  hostEntitlementsPath: string;
  driverHeaderPath: string;
  driverSourcePath: string;
  manifestPath: string;
  readmePath: string;
  doctorCommand: string;
  codesignReminder: string;
  activationCheckCommand: string;
  nativeTestCommand: string;
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
  reportProfile: "generic",
  headerFileName: "OpenControllerVirtualGamepadDriver.h",
  sourceFileName: "OpenControllerVirtualGamepadDriver.cpp",
} satisfies Required<MacosDriverKitDriverSourceOptions>;

type MacosDriverKitReportSpec = {
  profile: MacosDriverKitReportProfile;
  descriptor: Uint8Array;
  descriptorWithRumble: Uint8Array;
  inputReportByteLength: number;
  inputReportId: number;
};

function macosDriverKitReportSpec(
  profile: MacosDriverKitReportProfile = "generic",
): MacosDriverKitReportSpec {
  if (profile === "playstation") {
    return {
      profile,
      descriptor: macosDriverKitPlayStationHidReportDescriptor,
      descriptorWithRumble:
        macosDriverKitPlayStationHidReportDescriptorWithRumble,
      inputReportByteLength: macosDriverKitPlayStationInputReportByteLength,
      inputReportId: macosDriverKitPlayStationInputReportId,
    };
  }

  if (profile === "switch") {
    return {
      profile,
      descriptor: macosDriverKitSwitchHidReportDescriptor,
      descriptorWithRumble: macosDriverKitSwitchHidReportDescriptorWithRumble,
      inputReportByteLength: macosDriverKitSwitchInputReportByteLength,
      inputReportId: macosDriverKitSwitchInputReportId,
    };
  }

  return {
    profile: "generic",
    descriptor: macosDriverKitHidReportDescriptor,
    descriptorWithRumble: macosDriverKitHidReportDescriptorWithRumble,
    inputReportByteLength: macosDriverKitInputReportByteLength,
    inputReportId: hidGamepadReportId,
  };
}

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

export function defaultMacosDriverKitSetupDirectory(
  baseDirectory = process.cwd(),
): string {
  return resolve(baseDirectory, "opencontroller-macos-driverkit");
}

export async function prepareMacosDriverKitSetup(
  options: PrepareMacosDriverKitSetupOptions = {},
): Promise<MacosDriverKitSetupPlan> {
  const platform = options.platform ?? process.platform;
  const outputDirectory = resolve(
    options.outputDirectory ?? defaultMacosDriverKitSetupDirectory(),
  );
  const driverDirectory = join(outputDirectory, "driverkit-extension");
  const hostAppDirectory = join(outputDirectory, "host-app");
  const bundle = {
    ...defaultMacosDriverKitBundleOptions,
    ...(options.bundle ?? {}),
    ...(options.driver ?? {}),
  };
  const driverOptions: MacosDriverKitDriverSourceOptions = {
    ...bundle,
    ...(options.driver ?? {}),
  };
  const driverFiles = createMacosDriverKitDriverSourceFiles(driverOptions);
  const hostBridgePath =
    options.hostBridgePath ?? defaultMacosDriverKitHostBridgePath();
  const infoPlistPath = join(driverDirectory, "Info.plist");
  const driverEntitlementsPath = join(
    driverDirectory,
    `${bundle.executableName}.entitlements`,
  );
  const hostEntitlementsPath = join(
    hostAppDirectory,
    "OpenControllerHost.entitlements",
  );
  const manifestPath = join(outputDirectory, "manifest.json");
  const readmePath = join(outputDirectory, "README.md");
  const files: string[] = [];

  await mkdir(driverDirectory, { recursive: true });
  await mkdir(hostAppDirectory, { recursive: true });

  for (const [fileName, contents] of Object.entries(driverFiles)) {
    const filePath = join(driverDirectory, fileName);
    await writeFile(filePath, contents);
    files.push(filePath);
  }

  await writeFile(infoPlistPath, createMacosDriverKitInfoPlist(bundle));
  files.push(infoPlistPath);
  await writeFile(
    driverEntitlementsPath,
    createMacosDriverKitEntitlements(bundle),
  );
  files.push(driverEntitlementsPath);
  await writeFile(hostEntitlementsPath, createMacosHostAppEntitlements(bundle));
  files.push(hostEntitlementsPath);
  await writeFile(
    manifestPath,
    `${JSON.stringify(createMacosDriverKitAssetManifest(driverOptions), null, 2)}\n`,
  );
  files.push(manifestPath);

  const plan: MacosDriverKitSetupPlan = {
    platform,
    outputDirectory,
    driverDirectory,
    hostAppDirectory,
    hostBridgePath,
    appBundleIdentifier: bundle.appBundleIdentifier,
    driverBundleIdentifier: bundle.driverBundleIdentifier,
    driverClassName: bundle.driverClassName,
    reportProfile: driverOptions.reportProfile ?? "generic",
    files: [...files, readmePath],
    infoPlistPath,
    driverEntitlementsPath,
    hostEntitlementsPath,
    driverHeaderPath: join(
      driverDirectory,
      driverOptions.headerFileName ??
        defaultMacosDriverKitDriverSourceOptions.headerFileName,
    ),
    driverSourcePath: join(
      driverDirectory,
      driverOptions.sourceFileName ??
        defaultMacosDriverKitDriverSourceOptions.sourceFileName,
    ),
    manifestPath,
    readmePath,
    doctorCommand: "opencontroller-macos-driverkit-doctor --check",
    codesignReminder:
      "codesign and notarize the host app and embedded dext with approved DriverKit entitlements",
    activationCheckCommand: "systemextensionsctl list",
    nativeTestCommand: `opencontroller native test --backend macos-driverkit --id player-1 --host-bridge-path ${quoteShell(
      hostBridgePath,
    )} --driver-bundle-id ${quoteShell(
      bundle.driverBundleIdentifier,
    )} --driver-class-name ${quoteShell(bundle.driverClassName)}`,
  };

  await writeFile(readmePath, formatMacosDriverKitSetupReadme(plan));
  return plan;
}

export function formatMacosDriverKitSetupPlan(
  plan: MacosDriverKitSetupPlan,
): string {
  return [
    "OpenController macOS DriverKit Setup",
    "",
    `Generated kit: ${plan.outputDirectory}`,
    "",
    "No privileged system changes were made.",
    "",
    "Generated files:",
    ...plan.files.map((file) => `  ${file}`),
    "",
    `Report profile: ${plan.reportProfile}`,
    "",
    "Verify local authoring tools:",
    `  ${plan.doctorCommand}`,
    "",
    "Review, build, sign, notarize, and activate the host app and dext:",
    `  ${plan.codesignReminder}`,
    `  ${plan.activationCheckCommand}`,
    "",
    "After the signed host app activates the DriverKit extension, smoke-test the path:",
    `  ${plan.nativeTestCommand}`,
    "",
    "Apple DriverKit requires approved entitlements, code signing, notarization,",
    "and user-approved System Extension activation. This setup kit does not",
    "bypass those requirements.",
  ].join("\n");
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
    includeExtensions: options.includeExtensions ?? true,
    includeProfileHidReport: options.includeProfileHidReport ?? true,
    ...(options.waitForExitMs !== undefined
      ? { waitForExitMs: options.waitForExitMs }
      : {}),
    ...(options.killSignal ? { killSignal: options.killSignal } : {}),
    ...(options.spawn ? { spawn: options.spawn } : {}),
    supportsVirtualDevice: options.supportsVirtualDevice ?? true,
    supportsRumble: options.supportsRumble ?? true,
    supportsLights: options.supportsLights ?? false,
    virtualDeviceKind: options.virtualDeviceKind ?? "os-virtual-gamepad",
    requiresNativeInstall: options.requiresNativeInstall ?? true,
    requiresElevatedPermissions: options.requiresElevatedPermissions ?? false,
    ...(options.onFeedback ? { onFeedback: options.onFeedback } : {}),
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

export function encodeMacosDriverKitRumbleReport(
  effectOrReport: HidGamepadRumbleEffect | MacosDriverKitRumbleReport,
): Uint8Array {
  return encodeHidGamepadRumbleReport(effectOrReport);
}

export function decodeMacosDriverKitRumbleReport(
  bytes: Uint8Array,
): MacosDriverKitRumbleReport {
  return decodeHidGamepadRumbleReport(bytes);
}

export function macosDriverKitInputReportBytesFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): Uint8Array {
  return encodeMacosDriverKitInputReport(
    macosDriverKitInputReportFromNativeBridgeMessage(message),
  );
}

export function macosDriverKitPlayStationInputReportFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): MacosDriverKitPlayStationInputReport {
  if (message.profileHidReportFormat !== "hid-playstation-extended") {
    throw new TypeError(
      "Native bridge message does not include a PlayStation profile HID report",
    );
  }
  const bytes = nativeBridgeMessageToProfileHidReportBytes(message);
  if (!bytes) {
    throw new TypeError(
      "Native bridge message does not include a PlayStation profile HID report",
    );
  }
  return decodeHidPlayStationExtendedReport(bytes);
}

export function encodeMacosDriverKitPlayStationInputReport(
  report: MacosDriverKitPlayStationInputReport,
): Uint8Array {
  return encodeHidPlayStationExtendedReport(report);
}

export function decodeMacosDriverKitPlayStationInputReport(
  bytes: Uint8Array,
): MacosDriverKitPlayStationInputReport {
  return decodeHidPlayStationExtendedReport(bytes);
}

export function macosDriverKitPlayStationInputReportBytesFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): Uint8Array {
  return encodeMacosDriverKitPlayStationInputReport(
    macosDriverKitPlayStationInputReportFromNativeBridgeMessage(message),
  );
}

export function macosDriverKitSwitchInputReportFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): MacosDriverKitSwitchInputReport {
  if (message.profileHidReportFormat !== "hid-switch-extended") {
    throw new TypeError(
      "Native bridge message does not include a Switch profile HID report",
    );
  }
  const bytes = nativeBridgeMessageToProfileHidReportBytes(message);
  if (!bytes) {
    throw new TypeError(
      "Native bridge message does not include a Switch profile HID report",
    );
  }
  return decodeHidSwitchExtendedReport(bytes);
}

export function encodeMacosDriverKitSwitchInputReport(
  report: MacosDriverKitSwitchInputReport,
): Uint8Array {
  return encodeHidSwitchExtendedReport(report);
}

export function decodeMacosDriverKitSwitchInputReport(
  bytes: Uint8Array,
): MacosDriverKitSwitchInputReport {
  return decodeHidSwitchExtendedReport(bytes);
}

export function macosDriverKitSwitchInputReportBytesFromNativeBridgeMessage(
  message: NativeBridgeStateMessage,
): Uint8Array {
  return encodeMacosDriverKitSwitchInputReport(
    macosDriverKitSwitchInputReportFromNativeBridgeMessage(message),
  );
}

export function formatMacosDriverKitHidDescriptorForCpp(
  symbolName = "openControllerHidReportDescriptor",
): string {
  return formatCppByteArray(
    symbolName,
    macosDriverKitHidReportDescriptorWithRumble,
    12,
  );
}

export function formatMacosDriverKitPlayStationHidDescriptorForCpp(
  symbolName = "openControllerPlayStationHidReportDescriptor",
): string {
  return formatCppByteArray(
    symbolName,
    macosDriverKitPlayStationHidReportDescriptorWithRumble,
    12,
  );
}

export function formatMacosDriverKitSwitchHidDescriptorForCpp(
  symbolName = "openControllerSwitchHidReportDescriptor",
): string {
  return formatCppByteArray(
    symbolName,
    macosDriverKitSwitchHidReportDescriptorWithRumble,
    12,
  );
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

export function formatMacosDriverKitPlayStationInputReportForCpp(
  report: MacosDriverKitPlayStationInputReport,
  symbolName = "openControllerPlayStationSampleInputReport",
): string {
  return formatCppByteArray(
    symbolName,
    encodeMacosDriverKitPlayStationInputReport(report),
    13,
  );
}

export function formatMacosDriverKitSwitchInputReportForCpp(
  report: MacosDriverKitSwitchInputReport,
  symbolName = "openControllerSwitchSampleInputReport",
): string {
  return formatCppByteArray(
    symbolName,
    encodeMacosDriverKitSwitchInputReport(report),
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
  options: MacosDriverKitAssetManifestOptions = {},
) {
  const merged = {
    ...defaultMacosDriverKitBundleOptions,
    ...options,
  };
  const reportSpec = macosDriverKitReportSpec(options.reportProfile);

  return {
    driverBundleIdentifier: merged.driverBundleIdentifier,
    hostAppBundleIdentifier: merged.appBundleIdentifier,
    systemExtensionPath: `Contents/Library/SystemExtensions/${merged.driverBundleIdentifier}.dext`,
    driverClassName: merged.driverClassName,
    reportProfile: reportSpec.profile,
    hidReportDescriptorBytes: Array.from(reportSpec.descriptor),
    hidReportDescriptorWithRumbleBytes: Array.from(
      reportSpec.descriptorWithRumble,
    ),
    inputReportByteLength: reportSpec.inputReportByteLength,
    inputReportId: reportSpec.inputReportId,
    rumbleReportByteLength: macosDriverKitRumbleReportByteLength,
    rumbleReportId: macosDriverKitRumbleReportId,
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
  const reportSpec = macosDriverKitReportSpec(merged.reportProfile);

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
    "  kern_return_t setReport(",
    "    IOMemoryDescriptor *report,",
    "    IOHIDReportType reportType,",
    "    IOOptionBits options,",
    "    uint32_t completionTimeout,",
    "    OSAction *action",
    "  ) override;",
    "  kern_return_t updateInputReport(const uint8_t *bytes, uint32_t length);",
    "  kern_return_t copyRumbleReport(",
    "    uint8_t *bytes,",
    "    uint32_t length,",
    "    bool *hasReport",
    "  );",
    "",
    "private:",
    `  uint8_t inputReport[${reportSpec.inputReportByteLength}];`,
    `  uint8_t rumbleReport[${macosDriverKitRumbleReportByteLength}];`,
    "  bool hasRumbleReport;",
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
  const reportSpec = macosDriverKitReportSpec(merged.reportProfile);
  const neutralInputReport = createNeutralInputReportBytes(reportSpec);

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
    formatCppByteArray(
      "openControllerHidReportDescriptor",
      reportSpec.descriptorWithRumble,
      12,
    ),
    "",
    formatCppByteArray(
      "openControllerNeutralInputReport",
      neutralInputReport,
      13,
      {
        length: reportSpec.inputReportByteLength,
      },
    ),
    "",
    `static const uint8_t openControllerInputReportId = ${reportSpec.inputReportId};`,
    `static const uint8_t openControllerRumbleReportId = ${macosDriverKitRumbleReportId};`,
    `static const uint32_t openControllerRumbleReportLength = ${macosDriverKitRumbleReportByteLength};`,
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
    "  memset(rumbleReport, 0, sizeof(rumbleReport));",
    "  hasRumbleReport = false;",
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
    "  if ((options & 0xff) != openControllerInputReportId) {",
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
    `kern_return_t ${className}::setReport(`,
    "  IOMemoryDescriptor *report,",
    "  IOHIDReportType reportType,",
    "  IOOptionBits options,",
    "  uint32_t completionTimeout,",
    "  OSAction *action",
    ")",
    "{",
    "  (void)completionTimeout;",
    "",
    "  if (report == nullptr) {",
    "    return kIOReturnBadArgument;",
    "  }",
    "",
    "  if (reportType != kIOHIDReportTypeOutput) {",
    "    return kIOReturnUnsupported;",
    "  }",
    "",
    "  if ((options & 0xff) != openControllerRumbleReportId) {",
    "    return kIOReturnUnsupported;",
    "  }",
    "",
    "  const uint64_t bytesRead = report->readBytes(",
    "    0,",
    "    rumbleReport,",
    "    sizeof(rumbleReport)",
    "  );",
    "  kern_return_t result = kIOReturnSuccess;",
    "",
    "  if (bytesRead != openControllerRumbleReportLength ||",
    "      rumbleReport[0] != openControllerRumbleReportId) {",
    "    result = kIOReturnBadArgument;",
    "  } else {",
    "    hasRumbleReport = true;",
    "  }",
    "",
    "  if (action != nullptr) {",
    "    CompleteReport(",
    "      report,",
    "      result,",
    "      static_cast<uint32_t>(bytesRead),",
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
    `kern_return_t ${className}::copyRumbleReport(`,
    "  uint8_t *bytes,",
    "  uint32_t length,",
    "  bool *hasReport",
    ")",
    "{",
    "  if (bytes == nullptr || hasReport == nullptr || length != sizeof(rumbleReport)) {",
    "    return kIOReturnBadArgument;",
    "  }",
    "",
    "  if (!hasRumbleReport) {",
    "    *hasReport = false;",
    "    return kIOReturnSuccess;",
    "  }",
    "",
    "  memcpy(bytes, rumbleReport, sizeof(rumbleReport));",
    "  hasRumbleReport = false;",
    "  *hasReport = true;",
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
  options: { length?: number } = {},
): string {
  const length = options.length === undefined ? "[]" : `[${options.length}]`;
  const lines = [`static const uint8_t ${symbolName}${length} = {`];

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

function createNeutralInputReportBytes(
  reportSpec: MacosDriverKitReportSpec,
): Uint8Array {
  const bytes = new Uint8Array(reportSpec.inputReportByteLength);
  bytes[0] = reportSpec.inputReportId;
  return bytes;
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

function formatMacosDriverKitSetupReadme(
  plan: MacosDriverKitSetupPlan,
): string {
  return [
    "# OpenController macOS DriverKit Setup Kit",
    "",
    "This folder contains generated OpenController source material for a macOS",
    "DriverKit virtual HID gamepad backend.",
    `The generated DriverKit device uses the ${plan.reportProfile} HID report profile`,
    "with rumble output support and stores the latest rumble report for a signed",
    "host bridge to publish through OpenController feedback events.",
    "",
    "No privileged system changes were made when this kit was generated.",
    "",
    "## Contents",
    "",
    `- Driver source: ${plan.driverSourcePath}`,
    `- Driver header: ${plan.driverHeaderPath}`,
    `- Driver Info.plist: ${plan.infoPlistPath}`,
    `- Driver entitlements: ${plan.driverEntitlementsPath}`,
    `- Host app entitlements: ${plan.hostEntitlementsPath}`,
    `- Asset manifest: ${plan.manifestPath}`,
    "",
    "## Review And Build",
    "",
    "1. Review the generated DriverKit C++ source, Info.plist, entitlements, and manifest.",
    "2. Create or attach these files to a DriverKit-capable Xcode project.",
    "3. Build a host app that embeds and activates the DriverKit extension.",
    "4. Sign and notarize the host app and dext with approved DriverKit entitlements.",
    "5. Let the user approve System Extension activation.",
    `6. Place the host bridge at ${plan.hostBridgePath}.`,
    "",
    "## Reviewed Commands",
    "",
    "Verify local authoring tools:",
    "",
    "```bash",
    plan.doctorCommand,
    "```",
    "",
    "Check System Extension activation state:",
    "",
    "```bash",
    plan.activationCheckCommand,
    "```",
    "",
    "After the signed host app activates the DriverKit extension, smoke-test the native path:",
    "",
    "```bash",
    plan.nativeTestCommand,
    "```",
    "",
    "DriverKit still needs explicit user trust. Do not hide virtual input driver",
    "activation from the user.",
    "",
  ].join("\n");
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
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
    | "appBundleIdentifier"
    | "controllerId"
    | "driverBundleIdentifier"
    | "driverClassName"
    | "env"
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
    ...(options.controllerId
      ? { OPENCONTROLLER_CONTROLLER_ID: options.controllerId }
      : {}),
  };
}
