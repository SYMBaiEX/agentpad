import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ControllerState,
  type NativeProcessBridgeSpawner,
  createController,
} from "@opencontroller/core";
import { createNativeBridgeStateMessage } from "@opencontroller/core/bridge";
import {
  hidGamepadReportDescriptor,
  hidGamepadReportDescriptorWithRumble,
  hidGamepadReportId,
  hidGamepadRumbleReportId,
  hidPlayStationExtendedReportByteLength,
  hidPlayStationExtendedReportDescriptor,
  hidPlayStationExtendedReportDescriptorWithRumble,
  hidPlayStationExtendedReportId,
  xInputButtonBits,
} from "@opencontroller/core/hid";
import {
  createWindowsVhfDriverHeader,
  createWindowsVhfDriverSource,
  createWindowsVhfDriverSourceFiles,
  createWindowsVhfHostBridgeAdapter,
  createWindowsVhfHostBridgeHeader,
  createWindowsVhfHostBridgeSource,
  createWindowsVhfHostBridgeSourceFiles,
  createWindowsVhfInf,
  decodeWindowsVhfInputReport,
  decodeWindowsVhfRumbleReport,
  defaultWindowsVhfHostBridgePath,
  encodeWindowsVhfInputReport,
  encodeWindowsVhfPlayStationInputReport,
  encodeWindowsVhfRumbleReport,
  formatWindowsVhfHidDescriptorForC,
  formatWindowsVhfInputReportForC,
  formatWindowsVhfPlayStationHidDescriptorForC,
  formatWindowsVhfPlayStationInputReportForC,
  formatWindowsVhfSetupPlan,
  prepareWindowsVhfSetup,
  windowsVhfHidReportDescriptor,
  windowsVhfHidReportDescriptorWithRumble,
  windowsVhfInputReportBytesFromNativeBridgeMessage,
  windowsVhfInputReportFromNativeBridgeMessage,
  windowsVhfPlayStationHidReportDescriptor,
  windowsVhfPlayStationHidReportDescriptorWithRumble,
  windowsVhfPlayStationInputReportByteLength,
  windowsVhfPlayStationInputReportBytesFromNativeBridgeMessage,
  windowsVhfPlayStationInputReportFromNativeBridgeMessage,
  windowsVhfPlayStationInputReportId,
  windowsVhfRumbleReportByteLength,
} from "../vhf";

describe("windows VHF helpers", () => {
  test("reuses the canonical HID gamepad descriptor", () => {
    expect(Array.from(windowsVhfHidReportDescriptor)).toEqual(
      Array.from(hidGamepadReportDescriptor),
    );
    expect(Array.from(windowsVhfHidReportDescriptorWithRumble)).toEqual(
      Array.from(hidGamepadReportDescriptorWithRumble),
    );
    expect(Array.from(windowsVhfPlayStationHidReportDescriptor)).toEqual(
      Array.from(hidPlayStationExtendedReportDescriptor),
    );
    expect(
      Array.from(windowsVhfPlayStationHidReportDescriptorWithRumble),
    ).toEqual(Array.from(hidPlayStationExtendedReportDescriptorWithRumble));
  });

  test("creates VHF rumble output report bytes", () => {
    const bytes = encodeWindowsVhfRumbleReport({
      weakMotor: 0.5,
      strongMotor: 1,
      leftTriggerMotor: 0,
      rightTriggerMotor: 0.25,
    });
    const report = decodeWindowsVhfRumbleReport(bytes);

    expect(bytes.byteLength).toBe(windowsVhfRumbleReportByteLength);
    expect(report.reportId).toBe(hidGamepadRumbleReportId);
    expect(report.weakMotor).toBe(128);
    expect(report.strongMotor).toBe(255);
    expect(report.rightTriggerMotor).toBe(64);
  });

  test("creates VHF input report bytes from native bridge messages", () => {
    const state: ControllerState = {
      id: "player-1",
      profile: "xbox",
      connected: true,
      buttons: {
        A: true,
      },
      analogButtons: {
        LT: 0.25,
        RT: 0.5,
      },
      sticks: {
        left: { x: 1, y: -1 },
        right: { x: -1, y: 1 },
      },
      dpad: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      touchpad: {
        pressed: false,
        contacts: [],
      },
      motion: {
        acceleration: { x: 0, y: 0, z: 0 },
        gyroscope: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
      },
      updatedAt: 1,
    };

    const message = createNativeBridgeStateMessage(state, {
      includeState: false,
    });
    const report = windowsVhfInputReportFromNativeBridgeMessage(message);
    const bytes = windowsVhfInputReportBytesFromNativeBridgeMessage(message);
    const decoded = decodeWindowsVhfInputReport(bytes);

    expect(report.reportId).toBe(hidGamepadReportId);
    expect(report.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(report.leftTrigger).toBe(64);
    expect(report.rightTrigger).toBe(128);
    expect(decoded).toEqual(report);
  });

  test("creates PlayStation VHF input report bytes from native bridge messages", () => {
    const state: ControllerState = {
      id: "player-1",
      profile: "playstation",
      connected: true,
      buttons: {
        CROSS: true,
        CIRCLE: false,
        SQUARE: false,
        TRIANGLE: false,
        L1: false,
        R1: false,
        L2: false,
        R2: false,
        SHARE: false,
        OPTIONS: false,
        PS: false,
        L3: false,
        R3: false,
        TOUCHPAD: false,
        DPAD_UP: false,
        DPAD_DOWN: false,
        DPAD_LEFT: false,
        DPAD_RIGHT: false,
      },
      analogButtons: {
        L2: 0,
        R2: 0.5,
      },
      sticks: {
        left: { x: 0, y: 0 },
        right: { x: 0, y: 0 },
      },
      dpad: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      touchpad: {
        pressed: true,
        contacts: [
          {
            id: 4,
            active: true,
            x: 0.25,
            y: 0.75,
            pressure: 0.5,
          },
        ],
      },
      motion: {
        acceleration: { x: 0, y: 0, z: 1 },
        gyroscope: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
      },
      updatedAt: 1,
    };
    const message = createNativeBridgeStateMessage(state, {
      includeState: false,
    });
    const report =
      windowsVhfPlayStationInputReportFromNativeBridgeMessage(message);
    const bytes =
      windowsVhfPlayStationInputReportBytesFromNativeBridgeMessage(message);

    expect(bytes.byteLength).toBe(windowsVhfPlayStationInputReportByteLength);
    expect(windowsVhfPlayStationInputReportByteLength).toBe(
      hidPlayStationExtendedReportByteLength,
    );
    expect(report.reportId).toBe(windowsVhfPlayStationInputReportId);
    expect(windowsVhfPlayStationInputReportId).toBe(
      hidPlayStationExtendedReportId,
    );
    expect(report.touchpadPressed).toBe(true);
    expect(report.touchpadContacts[0]).toEqual({
      id: 4,
      active: true,
      x: 16384,
      y: 49151,
      pressure: 128,
    });
  });

  test("formats descriptor and report arrays for WDK driver source", () => {
    const report = {
      reportId: hidGamepadReportId,
      buttons: xInputButtonBits.A,
      leftTrigger: 0,
      rightTrigger: 128,
      leftStickX: 32767,
      leftStickY: 32767,
      rightStickX: 0,
      rightStickY: 0,
    };

    const descriptor = formatWindowsVhfHidDescriptorForC();
    const inputReport = formatWindowsVhfInputReportForC(report);

    expect(descriptor).toContain(
      "static const UCHAR OpenControllerHidReportDescriptor[]",
    );
    expect(descriptor).toContain("0x05, 0x01");
    expect(descriptor).toContain("0x85, 0x02");
    expect(descriptor).toContain("0x91, 0x02");
    expect(inputReport).toContain(
      "static const UCHAR OpenControllerSampleInputReport[]",
    );
    expect(
      decodeWindowsVhfInputReport(encodeWindowsVhfInputReport(report)),
    ).toEqual(report);
  });

  test("formats PlayStation descriptor and report arrays for WDK driver source", () => {
    const report = {
      reportId: hidPlayStationExtendedReportId,
      buttons: xInputButtonBits.A,
      leftTrigger: 0,
      rightTrigger: 128,
      leftStickX: 0,
      leftStickY: 0,
      rightStickX: 0,
      rightStickY: 0,
      touchpadPressed: true,
      touchpadContacts: [
        { id: 1, active: true, x: 65535, y: 0, pressure: 255 },
        { id: 0, active: false, x: 0, y: 0, pressure: 0 },
      ],
      accelerationX: 0,
      accelerationY: 0,
      accelerationZ: 32767,
      gyroscopeX: 0,
      gyroscopeY: 0,
      gyroscopeZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
    } as const;

    const descriptor = formatWindowsVhfPlayStationHidDescriptorForC();
    const inputReport = formatWindowsVhfPlayStationInputReportForC(report);

    expect(descriptor).toContain(
      "static const UCHAR OpenControllerPlayStationHidReportDescriptor[]",
    );
    expect(descriptor).toContain("0x85, 0x03");
    expect(inputReport).toContain(
      "static const UCHAR OpenControllerPlayStationSampleInputReport[]",
    );
    expect(encodeWindowsVhfPlayStationInputReport(report).byteLength).toBe(47);
  });

  test("creates an INF template that loads VHF as a lower filter", () => {
    const inf = createWindowsVhfInf();

    expect(inf).toContain("Class=HIDClass");
    expect(inf).toContain("[Standard.NTamd64]");
    expect(inf).toContain("Root\\OpenControllerVhfGamepad");
    expect(inf).toContain('HKR,,"LowerFilters",0x00010000,"vhf"');
    expect(inf).toContain("OpenControllerVhfGamepad.sys");
  });

  test("creates WDK VHF driver source templates", () => {
    const header = createWindowsVhfDriverHeader();
    const source = createWindowsVhfDriverSource();
    const files = createWindowsVhfDriverSourceFiles();

    expect(header).toContain("#include <vhf.h>");
    expect(header).toContain("IOCTL_OPENCONTROLLERVHFGAMEPAD_SUBMIT_REPORT");
    expect(header).toContain(
      "IOCTL_OPENCONTROLLERVHFGAMEPAD_POP_RUMBLE_REPORT",
    );
    expect(header).toContain("VHFHANDLE VhfHandle");
    expect(header).toContain("RumbleReport[5]");
    expect(header).toContain("WDFSPINLOCK RumbleLock");
    expect(header).toContain("EVT_VHF_ASYNC_OPERATION");
    expect(source).toContain("VHF_CONFIG_INIT");
    expect(source).toContain("VhfCreate(&vhfConfig");
    expect(source).toContain("VhfStart(context->VhfHandle)");
    expect(source).toContain("WdfDeviceInitSetIoType");
    expect(source).toContain("WdfDeviceCreateSymbolicLink");
    expect(source).toContain("DECLARE_CONST_UNICODE_STRING(symbolicLinkName");
    expect(source).toContain("OpenControllerVhfGamepad");
    expect(source).toContain("VhfReadReportSubmit(context->VhfHandle");
    expect(source).toContain("OpenControllerInputReportLength = 13");
    expect(source).toContain("OpenControllerRumbleReportLength = 5");
    expect(source).toContain("OpenControllerRumbleReportId = 2");
    expect(source).toContain("EvtVhfAsyncOperationWriteReport");
    expect(source).toContain("OpenControllerEvtVhfWriteReport");
    expect(source).toContain("VhfAsyncOperationComplete");
    expect(source).toContain("WdfSpinLockCreate");
    expect(source).toContain("STATUS_NO_MORE_ENTRIES");
    expect(Object.keys(files)).toEqual([
      "OpenControllerVhfGamepad.h",
      "OpenControllerVhfGamepad.c",
    ]);
  });

  test("creates PlayStation WDK VHF driver source templates", () => {
    const header = createWindowsVhfDriverHeader({
      reportProfile: "playstation",
    });
    const source = createWindowsVhfDriverSource({
      reportProfile: "playstation",
    });

    expect(header).toContain("InputReport[47]");
    expect(source).toContain("OpenControllerInputReportLength = 47");
    expect(source).toContain("OpenControllerInputReportId = 3");
    expect(source).toContain("0x85, 0x03");
    expect(source).toContain("0x95, 0x22");
  });

  test("creates Windows host bridge source templates for VHF IOCTL writes", () => {
    const header = createWindowsVhfHostBridgeHeader();
    const source = createWindowsVhfHostBridgeSource();
    const files = createWindowsVhfHostBridgeSourceFiles();

    expect(header).toContain("#include <windows.h>");
    expect(header).toContain("OPENCONTROLLER_HID_REPORT_BYTES 13");
    expect(header).toContain("OPENCONTROLLER_RUMBLE_REPORT_BYTES 5");
    expect(header).toContain("OPENCONTROLLER_RUMBLE_REPORT_ID 2");
    expect(header).toContain("IOCTL_OPENCONTROLLERVHFHOSTBRIDGE_SUBMIT_REPORT");
    expect(header).toContain(
      "IOCTL_OPENCONTROLLERVHFHOSTBRIDGE_POP_RUMBLE_REPORT",
    );
    expect(header).toContain("OPENCONTROLLERVHFHOSTBRIDGE_DEFAULT_DEVICE_PATH");
    expect(header).toContain("OpenControllerVhfGamepad");
    expect(source).toContain("CreateFileA");
    expect(source).toContain("GENERIC_READ | GENERIC_WRITE");
    expect(source).toContain("CreateThread");
    expect(source).toContain("opencontroller_feedback_thread");
    expect(source).toContain("DeviceIoControl");
    expect(source).toContain("hidReportBase64");
    expect(source).toContain("reportBase64");
    expect(source).toContain("opencontroller_pop_rumble_report");
    expect(source).toContain("opencontroller_print_rumble_feedback");
    expect(source).toContain("opencontroller.bridge.feedback");
    expect(source).toContain("hid-gamepad-rumble");
    expect(source).toContain("opencontroller_timestamp_ms");
    expect(source).toContain("GetSystemTimeAsFileTime");
    expect(source).toContain("OPENCONTROLLER_CONTROLLER_ID");
    expect(source).toContain("opencontroller_line_matches_controller_id");
    expect(source).toContain("--controller-id");
    expect(source).toContain("opencontroller_extract_hid_report_base64");
    expect(source).toContain("opencontroller_extract_xinput_report_base64");
    expect(source).toContain("opencontroller_decode_xinput_report");
    expect(source).toContain("opencontroller_encode_hid_report");
    expect(source).toContain("OPENCONTROLLER_VHF_DEVICE_PATH");
    expect(Object.keys(files)).toEqual([
      "OpenControllerVhfHostBridge.h",
      "OpenControllerVhfHostBridge.c",
    ]);
  });

  test("creates PlayStation Windows host bridge source templates", () => {
    const header = createWindowsVhfHostBridgeHeader({
      reportProfile: "playstation",
    });
    const source = createWindowsVhfHostBridgeSource({
      reportProfile: "playstation",
    });

    expect(header).toContain("OPENCONTROLLER_HID_REPORT_BYTES 47");
    expect(header).toContain("OPENCONTROLLER_HID_REPORT_ID 3");
    expect(header).toContain("OPENCONTROLLER_PROFILE_HID_REPORT 1");
    expect(source).toContain("profileHidReportBase64");
    expect(source).toContain(
      [
        "if (opencontroller_extract_profile_hid_report_base64(line, hidReport) != 0) {",
        "      if (opencontroller_extract_hid_report_base64(line, hidReport) != 0) {",
      ].join("\n"),
    );
    expect(source).toContain(
      "memset(output, 0, OPENCONTROLLER_HID_REPORT_BYTES)",
    );
  });

  test("prepares a reviewed Windows VHF setup kit", async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), "opencontroller-vhf-"),
    );

    try {
      const plan = await prepareWindowsVhfSetup({
        outputDirectory,
        platform: "linux",
        hostBridgePath:
          "C:\\OpenController\\bin\\OpenControllerVhfHostBridge.exe",
        devicePath: "\\\\.\\OpenControllerTestGamepad",
      });
      const readme = await readFile(plan.readmePath, "utf8");
      const hostBridgeHeader = await readFile(
        plan.hostBridgeHeaderPath,
        "utf8",
      );
      const formatted = formatWindowsVhfSetupPlan(plan);

      expect(plan.platform).toBe("linux");
      expect(plan.outputDirectory).toBe(outputDirectory);
      expect(plan.files).toContain(plan.infPath);
      expect(plan.files).toContain(plan.hostBridgeSourcePath);
      expect(plan.installCommand).toContain("pnputil /add-driver");
      expect(plan.nativeTestCommand).toContain(
        "opencontroller native test --backend windows-vhf",
      );
      expect(plan.nativeTestCommand).toContain("--id player-1");
      expect(plan.nativeTestCommand).toContain("OpenControllerTestGamepad");
      expect(readme).toContain("No privileged system changes were made");
      expect(readme).toContain("captures HID rumble output reports");
      expect(readme).toContain("Do not install");
      expect(hostBridgeHeader).toContain("OpenControllerTestGamepad");
      expect(formatted).toContain("OpenController Windows VHF Setup");
      expect(formatted).toContain("No privileged system changes were made.");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("prepares a PlayStation Windows VHF setup kit", async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), "opencontroller-vhf-playstation-"),
    );

    try {
      const plan = await prepareWindowsVhfSetup({
        outputDirectory,
        platform: "linux",
        driver: {
          reportProfile: "playstation",
        },
        hostBridge: {
          reportProfile: "playstation",
        },
      });
      const driverHeader = await readFile(plan.driverHeaderPath, "utf8");
      const hostBridgeHeader = await readFile(
        plan.hostBridgeHeaderPath,
        "utf8",
      );
      const hostBridgeSource = await readFile(
        plan.hostBridgeSourcePath,
        "utf8",
      );

      expect(driverHeader).toContain("InputReport[47]");
      expect(hostBridgeHeader).toContain("OPENCONTROLLER_HID_REPORT_BYTES 47");
      expect(hostBridgeHeader).toContain("OPENCONTROLLER_HID_REPORT_ID 3");
      expect(hostBridgeSource).toContain("profileHidReportBase64");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("wraps the VHF host bridge as a native process adapter", async () => {
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
    const adapter = createWindowsVhfHostBridgeAdapter({
      hostBridgePath: "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
      controllerId: "windows-player",
      devicePath: "\\\\.\\OpenControllerVhfGamepad",
      waitForExitMs: 50,
      spawn,
    });
    const controller = await createController({
      id: "windows-player",
      profile: "xbox",
      adapter,
      replay: false,
    });

    await controller.press("A", 1);
    await controller.disconnect();

    const capabilities = controller.capabilities();
    expect(capabilities.supportsVirtualDevice).toBe(true);
    expect(capabilities.virtualDeviceKind).toBe("os-virtual-gamepad");
    expect(capabilities.supportsRumble).toBe(true);
    expect(capabilities.feedbackTypes).toEqual(["rumble"]);
    expect(capabilities.reportFormats).toContain("hid-gamepad-rumble");
    expect(
      defaultWindowsVhfHostBridgePath("C:\\Users\\agent\\AppData\\Local"),
    ).toBe(
      "C:\\Users\\agent\\AppData\\Local\\OpenController\\bin\\OpenControllerVhfHostBridge.exe",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe(
      "C:\\OpenController\\OpenControllerVhfHostBridge.exe",
    );
    expect(calls[0]?.args).toEqual([]);
    expect(calls[0]?.env?.OPENCONTROLLER_CONTROLLER_ID).toBe("windows-player");
    expect(calls[0]?.env?.OPENCONTROLLER_VHF_DEVICE_PATH).toBe(
      "\\\\.\\OpenControllerVhfGamepad",
    );
    expect(writes.some((line) => line.includes('"hidReportBase64"'))).toBe(
      true,
    );
    expect(writes.at(-1)).toContain("opencontroller.bridge.disconnect");
  });
});
