import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, win32 } from "node:path";
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
  hidGamepadReportId,
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

export type WindowsVhfDriverSourceOptions = {
  driverName?: string;
  headerFileName?: string;
  vendorId?: number;
  productId?: number;
  versionNumber?: number;
  ioctlFunctionCode?: number;
  deviceInterfaceName?: string;
  symbolicLinkName?: string;
  userDevicePath?: string;
};

export type WindowsVhfHostBridgeSourceOptions = {
  bridgeName?: string;
  headerFileName?: string;
  ioctlFunctionCode?: number;
  userDevicePath?: string;
};

export type WindowsVhfHostBridgeAdapterOptions = Pick<
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
> & {
  hostBridgePath?: string;
  controllerId?: string;
  devicePath?: string;
};

export type PrepareWindowsVhfSetupOptions = {
  platform?: NodeJS.Platform;
  outputDirectory?: string;
  driver?: WindowsVhfDriverSourceOptions;
  inf?: WindowsVhfInfOptions;
  hostBridge?: WindowsVhfHostBridgeSourceOptions;
  hostBridgePath?: string;
  devicePath?: string;
};

export type WindowsVhfSetupPlan = {
  platform: NodeJS.Platform;
  outputDirectory: string;
  driverDirectory: string;
  hostBridgeDirectory: string;
  hostBridgePath: string;
  devicePath: string;
  files: string[];
  infPath: string;
  driverHeaderPath: string;
  driverSourcePath: string;
  hostBridgeHeaderPath: string;
  hostBridgeSourcePath: string;
  readmePath: string;
  installCommand: string;
  nativeTestCommand: string;
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

export const defaultWindowsVhfDriverSourceOptions = {
  driverName: "OpenControllerVhfGamepad",
  headerFileName: "OpenControllerVhfGamepad.h",
  vendorId: 0x4f43,
  productId: 0x0001,
  versionNumber: 0x0001,
  ioctlFunctionCode: 0x801,
  deviceInterfaceName: "OpenControllerVhfGamepad",
  symbolicLinkName: "\\DosDevices\\OpenControllerVhfGamepad",
  userDevicePath: "\\\\.\\OpenControllerVhfGamepad",
} satisfies Required<WindowsVhfDriverSourceOptions>;

export const defaultWindowsVhfHostBridgeSourceOptions = {
  bridgeName: "OpenControllerVhfHostBridge",
  headerFileName: "OpenControllerVhfHostBridge.h",
  ioctlFunctionCode: 0x801,
  userDevicePath: defaultWindowsVhfDriverSourceOptions.userDevicePath,
} satisfies Required<WindowsVhfHostBridgeSourceOptions>;

export function defaultWindowsVhfHostBridgePath(
  baseDirectory = process.env.LOCALAPPDATA ??
    win32.join(homedir(), "AppData", "Local"),
): string {
  return win32.join(
    baseDirectory,
    "OpenController",
    "bin",
    "OpenControllerVhfHostBridge.exe",
  );
}

export function defaultWindowsVhfSetupDirectory(
  baseDirectory = process.cwd(),
): string {
  return resolve(baseDirectory, "opencontroller-windows-vhf");
}

export async function prepareWindowsVhfSetup(
  options: PrepareWindowsVhfSetupOptions = {},
): Promise<WindowsVhfSetupPlan> {
  const platform = options.platform ?? process.platform;
  const outputDirectory = resolve(
    options.outputDirectory ?? defaultWindowsVhfSetupDirectory(),
  );
  const driverDirectory = join(outputDirectory, "driver");
  const hostBridgeDirectory = join(outputDirectory, "host-bridge");
  const devicePath =
    options.devicePath ??
    options.hostBridge?.userDevicePath ??
    defaultWindowsVhfHostBridgeSourceOptions.userDevicePath;
  const hostBridgePath =
    options.hostBridgePath ?? defaultWindowsVhfHostBridgePath();
  const driverOptions = options.driver ?? {};
  const infOptions = options.inf ?? {};
  const hostBridgeOptions: WindowsVhfHostBridgeSourceOptions = {
    ...(options.hostBridge ?? {}),
    userDevicePath: devicePath,
  };

  const driverFiles = createWindowsVhfDriverSourceFiles(driverOptions);
  const hostBridgeFiles =
    createWindowsVhfHostBridgeSourceFiles(hostBridgeOptions);
  const infFileName = `${toCIdentifier(
    infOptions.serviceName ?? defaultWindowsVhfInfOptions.serviceName,
  )}.inf`;
  const infPath = join(driverDirectory, infFileName);
  const readmePath = join(outputDirectory, "README.md");
  const files: string[] = [];

  await mkdir(driverDirectory, { recursive: true });
  await mkdir(hostBridgeDirectory, { recursive: true });

  for (const [fileName, contents] of Object.entries(driverFiles)) {
    const filePath = join(driverDirectory, fileName);
    await writeFile(filePath, contents);
    files.push(filePath);
  }

  await writeFile(infPath, createWindowsVhfInf(infOptions));
  files.push(infPath);

  for (const [fileName, contents] of Object.entries(hostBridgeFiles)) {
    const filePath = join(hostBridgeDirectory, fileName);
    await writeFile(filePath, contents);
    files.push(filePath);
  }

  const plan: WindowsVhfSetupPlan = {
    platform,
    outputDirectory,
    driverDirectory,
    hostBridgeDirectory,
    hostBridgePath,
    devicePath,
    files: [...files, readmePath],
    infPath,
    driverHeaderPath: join(
      driverDirectory,
      driverOptions.headerFileName ??
        defaultWindowsVhfDriverSourceOptions.headerFileName,
    ),
    driverSourcePath: join(
      driverDirectory,
      `${driverOptions.driverName ?? defaultWindowsVhfDriverSourceOptions.driverName}.c`,
    ),
    hostBridgeHeaderPath: join(
      hostBridgeDirectory,
      hostBridgeOptions.headerFileName ??
        defaultWindowsVhfHostBridgeSourceOptions.headerFileName,
    ),
    hostBridgeSourcePath: join(
      hostBridgeDirectory,
      `${hostBridgeOptions.bridgeName ?? defaultWindowsVhfHostBridgeSourceOptions.bridgeName}.c`,
    ),
    readmePath,
    installCommand: `pnputil /add-driver ${quotePowerShell(infPath)} /install`,
    nativeTestCommand: `opencontroller native test --backend windows-vhf --id player-1 --host-bridge-path ${quotePowerShell(
      hostBridgePath,
    )} --device-path ${quotePowerShell(devicePath)}`,
  };

  await writeFile(readmePath, formatWindowsVhfSetupReadme(plan));
  return plan;
}

export function formatWindowsVhfSetupPlan(plan: WindowsVhfSetupPlan): string {
  return [
    "OpenController Windows VHF Setup",
    "",
    `Generated kit: ${plan.outputDirectory}`,
    "",
    "No privileged system changes were made.",
    "",
    "Generated files:",
    ...plan.files.map((file) => `  ${file}`),
    "",
    "Review, build, sign, and install the driver package on Windows with WDK:",
    `  ${plan.installCommand}`,
    "",
    "After the signed driver and host bridge are installed, smoke-test the path:",
    `  ${plan.nativeTestCommand}`,
    "",
    "Virtual HID drivers run with sensitive system privileges. Review and sign",
    "the generated source before installing it on a real machine.",
  ].join("\n");
}

export function createWindowsVhfHostBridgeAdapter(
  options: WindowsVhfHostBridgeAdapterOptions = {},
): NativeProcessBridgeAdapter {
  return new NativeProcessBridgeAdapter({
    command: options.hostBridgePath ?? defaultWindowsVhfHostBridgePath(),
    args: options.args ?? [],
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: createWindowsVhfHostBridgeEnv(options),
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

export function createWindowsVhfDriverHeader(
  options: WindowsVhfDriverSourceOptions = {},
): string {
  const merged = {
    ...defaultWindowsVhfDriverSourceOptions,
    ...options,
  };
  const guard = `${toCIdentifier(merged.driverName).toUpperCase()}_H`;
  const prefix = toCIdentifier(merged.driverName).toUpperCase();

  return [
    "#pragma once",
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    "#include <ntddk.h>",
    "#include <wdf.h>",
    "#include <hidport.h>",
    "#include <vhf.h>",
    "",
    `#define ${prefix}_VENDOR_ID 0x${formatHexWord(merged.vendorId)}`,
    `#define ${prefix}_PRODUCT_ID 0x${formatHexWord(merged.productId)}`,
    `#define ${prefix}_VERSION_NUMBER 0x${formatHexWord(merged.versionNumber)}`,
    `#define IOCTL_${prefix}_SUBMIT_REPORT CTL_CODE(FILE_DEVICE_UNKNOWN, 0x${formatHexWord(
      merged.ioctlFunctionCode,
    )}, METHOD_BUFFERED, FILE_WRITE_DATA)`,
    `#define ${prefix}_USER_DEVICE_PATH "${escapeCString(merged.userDevicePath)}"`,
    "",
    "typedef struct _OPENCONTROLLER_DEVICE_CONTEXT {",
    "  VHFHANDLE VhfHandle;",
    `  UCHAR InputReport[${windowsVhfInputReportByteLength}];`,
    "} OPENCONTROLLER_DEVICE_CONTEXT, *POPENCONTROLLER_DEVICE_CONTEXT;",
    "",
    "WDF_DECLARE_CONTEXT_TYPE_WITH_NAME(",
    "  OPENCONTROLLER_DEVICE_CONTEXT,",
    "  OpenControllerGetDeviceContext",
    ");",
    "",
    "DRIVER_INITIALIZE DriverEntry;",
    "EVT_WDF_DRIVER_DEVICE_ADD OpenControllerEvtDeviceAdd;",
    "EVT_WDF_OBJECT_CONTEXT_CLEANUP OpenControllerEvtDeviceCleanup;",
    "EVT_WDF_IO_QUEUE_IO_DEVICE_CONTROL OpenControllerEvtIoDeviceControl;",
    "",
    `#endif  // ${guard}`,
    "",
  ].join("\n");
}

export function createWindowsVhfDriverSource(
  options: WindowsVhfDriverSourceOptions = {},
): string {
  const merged = {
    ...defaultWindowsVhfDriverSourceOptions,
    ...options,
  };
  const prefix = toCIdentifier(merged.driverName).toUpperCase();

  return [
    `#include "${merged.headerFileName}"`,
    "",
    formatCByteArray(
      "OpenControllerHidReportDescriptor",
      windowsVhfHidReportDescriptor,
      {
        storageClass: "static UCHAR",
        columns: 12,
      },
    ),
    "",
    `static const ULONG OpenControllerInputReportLength = ${windowsVhfInputReportByteLength};`,
    `static const UCHAR OpenControllerInputReportId = ${hidGamepadReportId};`,
    "",
    "NTSTATUS",
    "DriverEntry(",
    "  _In_ PDRIVER_OBJECT DriverObject,",
    "  _In_ PUNICODE_STRING RegistryPath",
    ")",
    "{",
    "  WDF_DRIVER_CONFIG config;",
    "",
    "  WDF_DRIVER_CONFIG_INIT(&config, OpenControllerEvtDeviceAdd);",
    "  return WdfDriverCreate(",
    "    DriverObject,",
    "    RegistryPath,",
    "    WDF_NO_OBJECT_ATTRIBUTES,",
    "    &config,",
    "    WDF_NO_HANDLE",
    "  );",
    "}",
    "",
    "NTSTATUS",
    "OpenControllerEvtDeviceAdd(",
    "  _In_ WDFDRIVER Driver,",
    "  _Inout_ PWDFDEVICE_INIT DeviceInit",
    ")",
    "{",
    "  UNREFERENCED_PARAMETER(Driver);",
    "",
    "  NTSTATUS status;",
    "  WDFDEVICE device;",
    "  WDF_OBJECT_ATTRIBUTES deviceAttributes;",
    "  WDF_IO_QUEUE_CONFIG queueConfig;",
    `  DECLARE_CONST_UNICODE_STRING(symbolicLinkName, L"${escapeWideCString(
      merged.symbolicLinkName,
    )}");`,
    "  VHF_CONFIG vhfConfig;",
    "  POPENCONTROLLER_DEVICE_CONTEXT context;",
    "",
    "  WDF_OBJECT_ATTRIBUTES_INIT_CONTEXT_TYPE(",
    "    &deviceAttributes,",
    "    OPENCONTROLLER_DEVICE_CONTEXT",
    "  );",
    "  deviceAttributes.EvtCleanupCallback = OpenControllerEvtDeviceCleanup;",
    "",
    "  WdfDeviceInitSetIoType(DeviceInit, WdfDeviceIoBuffered);",
    "",
    "  status = WdfDeviceCreate(&DeviceInit, &deviceAttributes, &device);",
    "  if (!NT_SUCCESS(status)) {",
    "    return status;",
    "  }",
    "",
    "  context = OpenControllerGetDeviceContext(device);",
    "  RtlZeroMemory(context, sizeof(*context));",
    "",
    "  status = WdfDeviceCreateSymbolicLink(device, &symbolicLinkName);",
    "  if (!NT_SUCCESS(status)) {",
    "    return status;",
    "  }",
    "",
    "  WDF_IO_QUEUE_CONFIG_INIT_DEFAULT_QUEUE(",
    "    &queueConfig,",
    "    WdfIoQueueDispatchSequential",
    "  );",
    "  queueConfig.EvtIoDeviceControl = OpenControllerEvtIoDeviceControl;",
    "",
    "  status = WdfIoQueueCreate(",
    "    device,",
    "    &queueConfig,",
    "    WDF_NO_OBJECT_ATTRIBUTES,",
    "    WDF_NO_HANDLE",
    "  );",
    "  if (!NT_SUCCESS(status)) {",
    "    return status;",
    "  }",
    "",
    "  VHF_CONFIG_INIT(",
    "    &vhfConfig,",
    "    WdfDeviceWdmGetDeviceObject(device),",
    "    (USHORT)sizeof(OpenControllerHidReportDescriptor),",
    "    OpenControllerHidReportDescriptor",
    "  );",
    `  vhfConfig.VendorID = ${prefix}_VENDOR_ID;`,
    `  vhfConfig.ProductID = ${prefix}_PRODUCT_ID;`,
    `  vhfConfig.VersionNumber = ${prefix}_VERSION_NUMBER;`,
    "",
    "  status = VhfCreate(&vhfConfig, &context->VhfHandle);",
    "  if (!NT_SUCCESS(status)) {",
    "    return status;",
    "  }",
    "",
    "  status = VhfStart(context->VhfHandle);",
    "  if (!NT_SUCCESS(status)) {",
    "    VhfDelete(context->VhfHandle, TRUE);",
    "    context->VhfHandle = NULL;",
    "  }",
    "",
    "  return status;",
    "}",
    "",
    "VOID",
    "OpenControllerEvtDeviceCleanup(_In_ WDFOBJECT DeviceObject)",
    "{",
    "  POPENCONTROLLER_DEVICE_CONTEXT context =",
    "    OpenControllerGetDeviceContext(DeviceObject);",
    "",
    "  if (context->VhfHandle != NULL) {",
    "    VhfDelete(context->VhfHandle, TRUE);",
    "    context->VhfHandle = NULL;",
    "  }",
    "}",
    "",
    "VOID",
    "OpenControllerEvtIoDeviceControl(",
    "  _In_ WDFQUEUE Queue,",
    "  _In_ WDFREQUEST Request,",
    "  _In_ size_t OutputBufferLength,",
    "  _In_ size_t InputBufferLength,",
    "  _In_ ULONG IoControlCode",
    ")",
    "{",
    "  UNREFERENCED_PARAMETER(OutputBufferLength);",
    "",
    "  NTSTATUS status = STATUS_SUCCESS;",
    "  WDFDEVICE device = WdfIoQueueGetDevice(Queue);",
    "  POPENCONTROLLER_DEVICE_CONTEXT context =",
    "    OpenControllerGetDeviceContext(device);",
    "  PVOID inputBuffer = NULL;",
    "  HID_XFER_PACKET packet;",
    "",
    `  if (IoControlCode != IOCTL_${prefix}_SUBMIT_REPORT) {`,
    "    WdfRequestComplete(Request, STATUS_INVALID_DEVICE_REQUEST);",
    "    return;",
    "  }",
    "",
    "  if (InputBufferLength != OpenControllerInputReportLength) {",
    "    WdfRequestComplete(Request, STATUS_INVALID_BUFFER_SIZE);",
    "    return;",
    "  }",
    "",
    "  status = WdfRequestRetrieveInputBuffer(",
    "    Request,",
    "    OpenControllerInputReportLength,",
    "    &inputBuffer,",
    "    NULL",
    "  );",
    "  if (!NT_SUCCESS(status)) {",
    "    WdfRequestComplete(Request, status);",
    "    return;",
    "  }",
    "",
    "  RtlCopyMemory(",
    "    context->InputReport,",
    "    inputBuffer,",
    "    OpenControllerInputReportLength",
    "  );",
    "",
    "  RtlZeroMemory(&packet, sizeof(packet));",
    "  packet.reportBuffer = context->InputReport;",
    "  packet.reportBufferLen = OpenControllerInputReportLength;",
    "  packet.reportId = OpenControllerInputReportId;",
    "",
    "  status = VhfReadReportSubmit(context->VhfHandle, &packet);",
    "  WdfRequestComplete(Request, status);",
    "}",
    "",
  ].join("\n");
}

export function createWindowsVhfDriverSourceFiles(
  options: WindowsVhfDriverSourceOptions = {},
): Record<string, string> {
  const merged = {
    ...defaultWindowsVhfDriverSourceOptions,
    ...options,
  };

  return {
    [merged.headerFileName]: createWindowsVhfDriverHeader(merged),
    [`${merged.driverName}.c`]: createWindowsVhfDriverSource(merged),
  };
}

export function createWindowsVhfHostBridgeHeader(
  options: WindowsVhfHostBridgeSourceOptions = {},
): string {
  const merged = {
    ...defaultWindowsVhfHostBridgeSourceOptions,
    ...options,
  };
  const guard = `${toCIdentifier(merged.bridgeName).toUpperCase()}_H`;
  const prefix = toCIdentifier(merged.bridgeName).toUpperCase();

  return [
    "#pragma once",
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    "#include <stdint.h>",
    "#include <windows.h>",
    "",
    "#define OPENCONTROLLER_XINPUT_REPORT_BYTES 12",
    `#define OPENCONTROLLER_HID_REPORT_BYTES ${windowsVhfInputReportByteLength}`,
    "#define OPENCONTROLLER_HID_REPORT_ID 1",
    `#define ${prefix}_DEFAULT_DEVICE_PATH "${escapeCString(merged.userDevicePath)}"`,
    `#define IOCTL_${prefix}_SUBMIT_REPORT CTL_CODE(FILE_DEVICE_UNKNOWN, 0x${formatHexWord(
      merged.ioctlFunctionCode,
    )}, METHOD_BUFFERED, FILE_WRITE_DATA)`,
    "",
    "typedef struct OPENCONTROLLER_XINPUT_REPORT {",
    "  uint16_t buttons;",
    "  uint8_t leftTrigger;",
    "  uint8_t rightTrigger;",
    "  int16_t leftStickX;",
    "  int16_t leftStickY;",
    "  int16_t rightStickX;",
    "  int16_t rightStickY;",
    "} OPENCONTROLLER_XINPUT_REPORT;",
    "",
    `#endif  // ${guard}`,
    "",
  ].join("\n");
}

export function createWindowsVhfHostBridgeSource(
  options: WindowsVhfHostBridgeSourceOptions = {},
): string {
  const merged = {
    ...defaultWindowsVhfHostBridgeSourceOptions,
    ...options,
  };
  const prefix = toCIdentifier(merged.bridgeName).toUpperCase();

  return [
    `#include "${merged.headerFileName}"`,
    "",
    "#include <stdio.h>",
    "#include <stdlib.h>",
    "#include <string.h>",
    "",
    "#define OPENCONTROLLER_LINE_MAX 8192",
    "",
    "static int opencontroller_is_disconnect(const char *line);",
    "static int opencontroller_line_matches_controller_id(",
    "  const char *line,",
    "  const char *controllerId",
    ");",
    "static int opencontroller_extract_hid_report_base64(",
    "  const char *line,",
    "  uint8_t output[OPENCONTROLLER_HID_REPORT_BYTES]",
    ");",
    "static int opencontroller_extract_xinput_report_base64(",
    "  const char *line,",
    "  uint8_t output[OPENCONTROLLER_XINPUT_REPORT_BYTES]",
    ");",
    "static void opencontroller_decode_xinput_report(",
    "  const uint8_t bytes[OPENCONTROLLER_XINPUT_REPORT_BYTES],",
    "  OPENCONTROLLER_XINPUT_REPORT *report",
    ");",
    "static void opencontroller_encode_hid_report(",
    "  const OPENCONTROLLER_XINPUT_REPORT *report,",
    "  uint8_t output[OPENCONTROLLER_HID_REPORT_BYTES]",
    ");",
    "static int opencontroller_submit_hid_report(",
    "  HANDLE device,",
    "  const uint8_t report[OPENCONTROLLER_HID_REPORT_BYTES]",
    ");",
    "",
    "int main(int argc, char **argv)",
    "{",
    '  const char *devicePath = getenv("OPENCONTROLLER_VHF_DEVICE_PATH");',
    '  const char *controllerId = getenv("OPENCONTROLLER_CONTROLLER_ID");',
    '  const char *controllerIdPrefix = "--controller-id=";',
    "  HANDLE device;",
    "  char line[OPENCONTROLLER_LINE_MAX];",
    "  uint8_t neutralReport[OPENCONTROLLER_HID_REPORT_BYTES] = {0};",
    "  int argIndex;",
    "",
    "  neutralReport[0] = OPENCONTROLLER_HID_REPORT_ID;",
    "",
    "  for (argIndex = 1; argIndex < argc; argIndex++) {",
    '    if (strcmp(argv[argIndex], "--controller-id") == 0) {',
    "      if (argIndex + 1 >= argc || argv[argIndex + 1][0] == '\\0') {",
    '        fprintf(stderr, "opencontroller-vhf-host: --controller-id requires a value\\n");',
    "        return 2;",
    "      }",
    "      controllerId = argv[++argIndex];",
    "      continue;",
    "    }",
    "    if (strncmp(argv[argIndex], controllerIdPrefix, strlen(controllerIdPrefix)) == 0) {",
    "      controllerId = argv[argIndex] + strlen(controllerIdPrefix);",
    "      if (controllerId[0] == '\\0') {",
    '        fprintf(stderr, "opencontroller-vhf-host: --controller-id requires a value\\n");',
    "        return 2;",
    "      }",
    "      continue;",
    "    }",
    '    if (strcmp(argv[argIndex], "--device-path") == 0) {',
    "      if (argIndex + 1 >= argc || argv[argIndex + 1][0] == '\\0') {",
    '        fprintf(stderr, "opencontroller-vhf-host: --device-path requires a value\\n");',
    "        return 2;",
    "      }",
    "      devicePath = argv[++argIndex];",
    "      continue;",
    "    }",
    "    if (argv[argIndex][0] != '\\0' && argv[argIndex][0] != '-') {",
    "      devicePath = argv[argIndex];",
    "      continue;",
    "    }",
    '    fprintf(stderr, "opencontroller-vhf-host: unknown argument: %s\\n", argv[argIndex]);',
    "    return 2;",
    "  }",
    "  if (devicePath == NULL || devicePath[0] == '\\0') {",
    `    devicePath = ${prefix}_DEFAULT_DEVICE_PATH;`,
    "  }",
    "",
    "  device = CreateFileA(",
    "    devicePath,",
    "    GENERIC_WRITE,",
    "    FILE_SHARE_READ | FILE_SHARE_WRITE,",
    "    NULL,",
    "    OPEN_EXISTING,",
    "    FILE_ATTRIBUTE_NORMAL,",
    "    NULL",
    "  );",
    "  if (device == INVALID_HANDLE_VALUE) {",
    "    fprintf(",
    "      stderr,",
    '      "opencontroller-vhf-host: failed to open %s: %lu\\n",',
    "      devicePath,",
    "      GetLastError()",
    "    );",
    "    return 1;",
    "  }",
    "",
    "  while (fgets(line, sizeof(line), stdin) != NULL) {",
    "    uint8_t xinputBytes[OPENCONTROLLER_XINPUT_REPORT_BYTES];",
    "    uint8_t hidReport[OPENCONTROLLER_HID_REPORT_BYTES];",
    "    OPENCONTROLLER_XINPUT_REPORT xinputReport;",
    "",
    "    if (!opencontroller_line_matches_controller_id(line, controllerId)) {",
    "      continue;",
    "    }",
    "",
    "    if (opencontroller_is_disconnect(line)) {",
    "      opencontroller_submit_hid_report(device, neutralReport);",
    "      break;",
    "    }",
    "",
    "    if (opencontroller_extract_hid_report_base64(line, hidReport) != 0) {",
    "      if (opencontroller_extract_xinput_report_base64(line, xinputBytes) != 0) {",
    "        continue;",
    "      }",
    "",
    "      opencontroller_decode_xinput_report(xinputBytes, &xinputReport);",
    "      opencontroller_encode_hid_report(&xinputReport, hidReport);",
    "    }",
    "",
    "    if (opencontroller_submit_hid_report(device, hidReport) != 0) {",
    '      fprintf(stderr, "opencontroller-vhf-host: DeviceIoControl failed: %lu\\n", GetLastError());',
    "      CloseHandle(device);",
    "      return 1;",
    "    }",
    "  }",
    "",
    "  opencontroller_submit_hid_report(device, neutralReport);",
    "  CloseHandle(device);",
    "  return 0;",
    "}",
    "",
    "static int opencontroller_base64_value(char c)",
    "{",
    "  if (c >= 'A' && c <= 'Z') {",
    "    return c - 'A';",
    "  }",
    "  if (c >= 'a' && c <= 'z') {",
    "    return c - 'a' + 26;",
    "  }",
    "  if (c >= '0' && c <= '9') {",
    "    return c - '0' + 52;",
    "  }",
    "  if (c == '+') {",
    "    return 62;",
    "  }",
    "  if (c == '/') {",
    "    return 63;",
    "  }",
    "  if (c == '=') {",
    "    return -2;",
    "  }",
    "  return -1;",
    "}",
    "",
    "static int opencontroller_decode_base64_bytes(",
    "  const char *input,",
    "  uint8_t *output,",
    "  size_t expectedBytes",
    ")",
    "{",
    "  int values[4];",
    "  int valueCount = 0;",
    "  size_t outputCount = 0;",
    "  const char *cursor = input;",
    "",
    "  while (*cursor != '\\0' && *cursor != '\"') {",
    "    int value = opencontroller_base64_value(*cursor++);",
    "    if (value == -1) {",
    "      continue;",
    "    }",
    "",
    "    values[valueCount++] = value;",
    "    if (valueCount < 4) {",
    "      continue;",
    "    }",
    "",
    "    if (values[0] < 0 || values[1] < 0) {",
    "      return -1;",
    "    }",
    "    if (outputCount < expectedBytes) {",
    "      output[outputCount++] = (uint8_t)((values[0] << 2) | (values[1] >> 4));",
    "    }",
    "    if (values[2] >= 0 && outputCount < expectedBytes) {",
    "      output[outputCount++] =",
    "        (uint8_t)(((values[1] & 0x0f) << 4) | (values[2] >> 2));",
    "    }",
    "    if (values[3] >= 0 && outputCount < expectedBytes) {",
    "      output[outputCount++] =",
    "        (uint8_t)(((values[2] & 0x03) << 6) | values[3]);",
    "    }",
    "",
    "    valueCount = 0;",
    "  }",
    "",
    "  return outputCount == expectedBytes ? 0 : -1;",
    "}",
    "",
    "static int opencontroller_extract_base64_field(",
    "  const char *line,",
    "  const char *key,",
    "  uint8_t *output,",
    "  size_t expectedBytes",
    ")",
    "{",
    "  const char *start = strstr(line, key);",
    "  if (start == NULL) {",
    "    return -1;",
    "  }",
    "  start += strlen(key);",
    "  return opencontroller_decode_base64_bytes(start, output, expectedBytes);",
    "}",
    "",
    "static int opencontroller_extract_hid_report_base64(",
    "  const char *line,",
    "  uint8_t output[OPENCONTROLLER_HID_REPORT_BYTES]",
    ")",
    "{",
    '  return opencontroller_extract_base64_field(line, "\\"hidReportBase64\\":\\"", output, OPENCONTROLLER_HID_REPORT_BYTES);',
    "}",
    "",
    "static int opencontroller_extract_xinput_report_base64(",
    "  const char *line,",
    "  uint8_t output[OPENCONTROLLER_XINPUT_REPORT_BYTES]",
    ")",
    "{",
    '  return opencontroller_extract_base64_field(line, "\\"reportBase64\\":\\"", output, OPENCONTROLLER_XINPUT_REPORT_BYTES);',
    "}",
    "",
    "static int opencontroller_is_disconnect(const char *line)",
    "{",
    '  return strstr(line, "\\"type\\":\\"opencontroller.bridge.disconnect\\"") != NULL;',
    "}",
    "",
    "static int opencontroller_line_matches_controller_id(",
    "  const char *line,",
    "  const char *controllerId",
    ")",
    "{",
    '  const char *key = "\\"controllerId\\":\\"";',
    "  const char *start;",
    "  const char *end;",
    "  size_t idLength;",
    "",
    "  if (controllerId == NULL || controllerId[0] == '\\0') {",
    "    return 1;",
    "  }",
    "",
    "  start = strstr(line, key);",
    "  if (start == NULL) {",
    "    return 0;",
    "  }",
    "",
    "  start += strlen(key);",
    "  end = strchr(start, '\"');",
    "  if (end == NULL) {",
    "    return 0;",
    "  }",
    "",
    "  idLength = (size_t)(end - start);",
    "  return strlen(controllerId) == idLength &&",
    "    strncmp(start, controllerId, idLength) == 0;",
    "}",
    "",
    "static void opencontroller_decode_xinput_report(",
    "  const uint8_t bytes[OPENCONTROLLER_XINPUT_REPORT_BYTES],",
    "  OPENCONTROLLER_XINPUT_REPORT *report",
    ")",
    "{",
    "  report->buttons = (uint16_t)(bytes[0] | (bytes[1] << 8));",
    "  report->leftTrigger = bytes[2];",
    "  report->rightTrigger = bytes[3];",
    "  report->leftStickX = (int16_t)(bytes[4] | (bytes[5] << 8));",
    "  report->leftStickY = (int16_t)(bytes[6] | (bytes[7] << 8));",
    "  report->rightStickX = (int16_t)(bytes[8] | (bytes[9] << 8));",
    "  report->rightStickY = (int16_t)(bytes[10] | (bytes[11] << 8));",
    "}",
    "",
    "static void opencontroller_write_i16_le(uint8_t *target, int16_t value)",
    "{",
    "  target[0] = (uint8_t)(value & 0xff);",
    "  target[1] = (uint8_t)(((uint16_t)value >> 8) & 0xff);",
    "}",
    "",
    "static void opencontroller_encode_hid_report(",
    "  const OPENCONTROLLER_XINPUT_REPORT *report,",
    "  uint8_t output[OPENCONTROLLER_HID_REPORT_BYTES]",
    ")",
    "{",
    "  output[0] = OPENCONTROLLER_HID_REPORT_ID;",
    "  output[1] = (uint8_t)(report->buttons & 0xff);",
    "  output[2] = (uint8_t)((report->buttons >> 8) & 0xff);",
    "  opencontroller_write_i16_le(&output[3], report->leftStickX);",
    "  opencontroller_write_i16_le(&output[5], report->leftStickY);",
    "  opencontroller_write_i16_le(&output[7], report->rightStickX);",
    "  opencontroller_write_i16_le(&output[9], report->rightStickY);",
    "  output[11] = report->leftTrigger;",
    "  output[12] = report->rightTrigger;",
    "}",
    "",
    "static int opencontroller_submit_hid_report(",
    "  HANDLE device,",
    "  const uint8_t report[OPENCONTROLLER_HID_REPORT_BYTES]",
    ")",
    "{",
    "  DWORD bytesReturned = 0;",
    "  BOOL ok = DeviceIoControl(",
    "    device,",
    `    IOCTL_${prefix}_SUBMIT_REPORT,`,
    "    (LPVOID)report,",
    "    OPENCONTROLLER_HID_REPORT_BYTES,",
    "    NULL,",
    "    0,",
    "    &bytesReturned,",
    "    NULL",
    "  );",
    "",
    "  return ok ? 0 : -1;",
    "}",
    "",
  ].join("\n");
}

export function createWindowsVhfHostBridgeSourceFiles(
  options: WindowsVhfHostBridgeSourceOptions = {},
): Record<string, string> {
  const merged = {
    ...defaultWindowsVhfHostBridgeSourceOptions,
    ...options,
  };

  return {
    [merged.headerFileName]: createWindowsVhfHostBridgeHeader(merged),
    [`${merged.bridgeName}.c`]: createWindowsVhfHostBridgeSource(merged),
  };
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

function formatHexWord(value: number): string {
  return value.toString(16).padStart(4, "0");
}

function toCIdentifier(value: string): string {
  const identifier = value.replaceAll(/[^A-Za-z0-9_]/g, "_");
  if (/^[A-Za-z_]/.test(identifier)) {
    return identifier;
  }

  return `_${identifier}`;
}

function escapeCString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeWideCString(value: string): string {
  return escapeCString(value);
}

function formatWindowsVhfSetupReadme(plan: WindowsVhfSetupPlan): string {
  return [
    "# OpenController Windows VHF Setup Kit",
    "",
    "This folder contains generated OpenController source material for a Windows",
    "Virtual HID Framework gamepad backend.",
    "",
    "No privileged system changes were made when this kit was generated.",
    "",
    "## Contents",
    "",
    `- Driver source: ${plan.driverSourcePath}`,
    `- Driver header: ${plan.driverHeaderPath}`,
    `- Driver INF: ${plan.infPath}`,
    `- Host bridge source: ${plan.hostBridgeSourcePath}`,
    `- Host bridge header: ${plan.hostBridgeHeaderPath}`,
    "",
    "## Review And Build",
    "",
    "1. Review the generated KMDF/VHF driver source and INF.",
    "2. Create or attach these files to a WDK driver project.",
    "3. Build and sign the driver package with your trusted certificate.",
    "4. Build the user-mode host bridge executable.",
    `5. Place the host bridge at ${plan.hostBridgePath}.`,
    "",
    "## Reviewed Commands",
    "",
    "After signing the driver package, install it from an elevated Windows",
    "terminal:",
    "",
    "```powershell",
    plan.installCommand,
    "```",
    "",
    "After the driver and host bridge are installed, smoke-test the native path:",
    "",
    "```powershell",
    plan.nativeTestCommand,
    "```",
    "",
    "Virtual HID drivers run with sensitive system privileges. Do not install",
    "unsigned or unreviewed driver packages.",
    "",
  ].join("\n");
}

function quotePowerShell(value: string): string {
  return `"${value.replaceAll("`", "``").replaceAll('"', '`"')}"`;
}

function createWindowsVhfHostBridgeEnv(
  options: Pick<
    WindowsVhfHostBridgeAdapterOptions,
    "controllerId" | "devicePath" | "env"
  >,
): Record<string, string | undefined> {
  return {
    ...process.env,
    ...options.env,
    ...(options.controllerId
      ? { OPENCONTROLLER_CONTROLLER_ID: options.controllerId }
      : {}),
    ...(options.devicePath
      ? { OPENCONTROLLER_VHF_DEVICE_PATH: options.devicePath }
      : {}),
  };
}
