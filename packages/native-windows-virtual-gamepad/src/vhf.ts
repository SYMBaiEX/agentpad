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
} satisfies Required<WindowsVhfDriverSourceOptions>;

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
    "  VHF_CONFIG vhfConfig;",
    "  POPENCONTROLLER_DEVICE_CONTEXT context;",
    "",
    "  WDF_OBJECT_ATTRIBUTES_INIT_CONTEXT_TYPE(",
    "    &deviceAttributes,",
    "    OPENCONTROLLER_DEVICE_CONTEXT",
    "  );",
    "  deviceAttributes.EvtCleanupCallback = OpenControllerEvtDeviceCleanup;",
    "",
    "  status = WdfDeviceCreate(&DeviceInit, &deviceAttributes, &device);",
    "  if (!NT_SUCCESS(status)) {",
    "    return status;",
    "  }",
    "",
    "  context = OpenControllerGetDeviceContext(device);",
    "  RtlZeroMemory(context, sizeof(*context));",
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
