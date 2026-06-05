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
  hidGamepadLightReportId,
  hidGamepadReportDescriptor,
  hidGamepadReportDescriptorWithFeedback,
  hidGamepadReportDescriptorWithRumble,
  hidGamepadReportId,
  hidGamepadRumbleReportId,
  hidPlayStationExtendedReportByteLength,
  hidPlayStationExtendedReportDescriptor,
  hidPlayStationExtendedReportDescriptorWithFeedback,
  hidPlayStationExtendedReportDescriptorWithRumble,
  hidPlayStationExtendedReportId,
  hidSwitchExtendedReportByteLength,
  hidSwitchExtendedReportDescriptor,
  hidSwitchExtendedReportDescriptorWithFeedback,
  hidSwitchExtendedReportDescriptorWithRumble,
  hidSwitchExtendedReportId,
  xInputButtonBits,
} from "@opencontroller/core/hid";
import {
  createMacosDriverKitAssetManifest,
  createMacosDriverKitDriverHeader,
  createMacosDriverKitDriverSource,
  createMacosDriverKitDriverSourceFiles,
  createMacosDriverKitEntitlements,
  createMacosDriverKitHostBridgeAdapter,
  createMacosDriverKitInfoPlist,
  createMacosHostAppEntitlements,
  decodeMacosDriverKitInputReport,
  decodeMacosDriverKitLightReport,
  decodeMacosDriverKitPlayStationInputReport,
  decodeMacosDriverKitRumbleReport,
  decodeMacosDriverKitSwitchInputReport,
  defaultMacosDriverKitHostBridgePath,
  encodeMacosDriverKitInputReport,
  encodeMacosDriverKitLightReport,
  encodeMacosDriverKitPlayStationInputReport,
  encodeMacosDriverKitRumbleReport,
  encodeMacosDriverKitSwitchInputReport,
  formatMacosDriverKitHidDescriptorForCpp,
  formatMacosDriverKitInputReportForCpp,
  formatMacosDriverKitPlayStationHidDescriptorForCpp,
  formatMacosDriverKitPlayStationInputReportForCpp,
  formatMacosDriverKitSetupPlan,
  formatMacosDriverKitSwitchHidDescriptorForCpp,
  formatMacosDriverKitSwitchInputReportForCpp,
  macosDriverKitHidReportDescriptor,
  macosDriverKitHidReportDescriptorWithFeedback,
  macosDriverKitHidReportDescriptorWithRumble,
  macosDriverKitInputReportBytesFromNativeBridgeMessage,
  macosDriverKitInputReportFromNativeBridgeMessage,
  macosDriverKitLightReportByteLength,
  macosDriverKitPlayStationHidReportDescriptor,
  macosDriverKitPlayStationHidReportDescriptorWithFeedback,
  macosDriverKitPlayStationHidReportDescriptorWithRumble,
  macosDriverKitPlayStationInputReportByteLength,
  macosDriverKitPlayStationInputReportBytesFromNativeBridgeMessage,
  macosDriverKitPlayStationInputReportFromNativeBridgeMessage,
  macosDriverKitPlayStationInputReportId,
  macosDriverKitRumbleReportByteLength,
  macosDriverKitSwitchHidReportDescriptor,
  macosDriverKitSwitchHidReportDescriptorWithFeedback,
  macosDriverKitSwitchHidReportDescriptorWithRumble,
  macosDriverKitSwitchInputReportByteLength,
  macosDriverKitSwitchInputReportBytesFromNativeBridgeMessage,
  macosDriverKitSwitchInputReportFromNativeBridgeMessage,
  macosDriverKitSwitchInputReportId,
  prepareMacosDriverKitSetup,
} from "../driverkit";

describe("macOS DriverKit helpers", () => {
  test("reuses the canonical HID gamepad descriptor", () => {
    expect(Array.from(macosDriverKitHidReportDescriptor)).toEqual(
      Array.from(hidGamepadReportDescriptor),
    );
    expect(Array.from(macosDriverKitHidReportDescriptorWithRumble)).toEqual(
      Array.from(hidGamepadReportDescriptorWithRumble),
    );
    expect(Array.from(macosDriverKitHidReportDescriptorWithFeedback)).toEqual(
      Array.from(hidGamepadReportDescriptorWithFeedback),
    );
    expect(Array.from(macosDriverKitPlayStationHidReportDescriptor)).toEqual(
      Array.from(hidPlayStationExtendedReportDescriptor),
    );
    expect(
      Array.from(macosDriverKitPlayStationHidReportDescriptorWithRumble),
    ).toEqual(Array.from(hidPlayStationExtendedReportDescriptorWithRumble));
    expect(
      Array.from(macosDriverKitPlayStationHidReportDescriptorWithFeedback),
    ).toEqual(Array.from(hidPlayStationExtendedReportDescriptorWithFeedback));
    expect(Array.from(macosDriverKitSwitchHidReportDescriptor)).toEqual(
      Array.from(hidSwitchExtendedReportDescriptor),
    );
    expect(
      Array.from(macosDriverKitSwitchHidReportDescriptorWithRumble),
    ).toEqual(Array.from(hidSwitchExtendedReportDescriptorWithRumble));
    expect(
      Array.from(macosDriverKitSwitchHidReportDescriptorWithFeedback),
    ).toEqual(Array.from(hidSwitchExtendedReportDescriptorWithFeedback));
  });

  test("creates DriverKit rumble output report bytes", () => {
    const bytes = encodeMacosDriverKitRumbleReport({
      weakMotor: 0.5,
      strongMotor: 1,
      leftTriggerMotor: 0,
      rightTriggerMotor: 0.25,
    });
    const report = decodeMacosDriverKitRumbleReport(bytes);

    expect(bytes.byteLength).toBe(macosDriverKitRumbleReportByteLength);
    expect(report.reportId).toBe(hidGamepadRumbleReportId);
    expect(report.weakMotor).toBe(128);
    expect(report.strongMotor).toBe(255);
    expect(report.rightTriggerMotor).toBe(64);
  });

  test("creates DriverKit light output report bytes", () => {
    const bytes = encodeMacosDriverKitLightReport({
      red: 0.25,
      green: 0.5,
      blue: 1,
      brightness: 0.75,
      playerIndex: 2,
      playerLightMask: 0b0010,
    });
    const report = decodeMacosDriverKitLightReport(bytes);

    expect(bytes.byteLength).toBe(macosDriverKitLightReportByteLength);
    expect(report.reportId).toBe(hidGamepadLightReportId);
    expect(report.red).toBe(64);
    expect(report.green).toBe(128);
    expect(report.blue).toBe(255);
    expect(report.brightness).toBe(191);
    expect(report.playerLightMask).toBe(0b0010);
  });

  test("creates DriverKit input report bytes from native bridge messages", () => {
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
    const report = macosDriverKitInputReportFromNativeBridgeMessage(message);
    const bytes =
      macosDriverKitInputReportBytesFromNativeBridgeMessage(message);
    const decoded = decodeMacosDriverKitInputReport(bytes);

    expect(report.reportId).toBe(hidGamepadReportId);
    expect(report.buttons & xInputButtonBits.A).toBe(xInputButtonBits.A);
    expect(report.leftTrigger).toBe(64);
    expect(report.rightTrigger).toBe(128);
    expect(decoded).toEqual(report);
  });

  test("creates PlayStation DriverKit input report bytes from native bridge messages", () => {
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
      macosDriverKitPlayStationInputReportFromNativeBridgeMessage(message);
    const bytes =
      macosDriverKitPlayStationInputReportBytesFromNativeBridgeMessage(message);
    const decoded = decodeMacosDriverKitPlayStationInputReport(bytes);

    expect(bytes.byteLength).toBe(
      macosDriverKitPlayStationInputReportByteLength,
    );
    expect(macosDriverKitPlayStationInputReportByteLength).toBe(
      hidPlayStationExtendedReportByteLength,
    );
    expect(report.reportId).toBe(macosDriverKitPlayStationInputReportId);
    expect(macosDriverKitPlayStationInputReportId).toBe(
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
    expect(decoded).toEqual(report);
  });

  test("creates Switch DriverKit input report bytes from native bridge messages", () => {
    const state: ControllerState = {
      id: "player-1",
      profile: "switch",
      connected: true,
      buttons: {
        A: true,
        B: false,
        X: false,
        Y: false,
        L: false,
        R: false,
        ZL: false,
        ZR: true,
        MINUS: false,
        PLUS: true,
        HOME: false,
        CAPTURE: false,
        LS: false,
        RS: false,
        DPAD_UP: false,
        DPAD_DOWN: false,
        DPAD_LEFT: false,
        DPAD_RIGHT: false,
      },
      analogButtons: {
        ZL: 0,
        ZR: 0.5,
      },
      sticks: {
        left: { x: -1, y: 1 },
        right: { x: 0.5, y: -0.5 },
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
        acceleration: { x: 0.25, y: -0.25, z: 0.5 },
        gyroscope: { x: -0.5, y: 0.5, z: 1 },
        orientation: { x: 0, y: 0, z: 0 },
      },
      updatedAt: 1,
    };

    const message = createNativeBridgeStateMessage(state, {
      includeState: false,
    });
    const report =
      macosDriverKitSwitchInputReportFromNativeBridgeMessage(message);
    const bytes =
      macosDriverKitSwitchInputReportBytesFromNativeBridgeMessage(message);
    const decoded = decodeMacosDriverKitSwitchInputReport(bytes);

    expect(bytes.byteLength).toBe(macosDriverKitSwitchInputReportByteLength);
    expect(macosDriverKitSwitchInputReportByteLength).toBe(
      hidSwitchExtendedReportByteLength,
    );
    expect(report.reportId).toBe(macosDriverKitSwitchInputReportId);
    expect(macosDriverKitSwitchInputReportId).toBe(hidSwitchExtendedReportId);
    expect(report.buttons & xInputButtonBits.B).toBe(xInputButtonBits.B);
    expect(report.rightTrigger).toBe(128);
    expect(report.accelerationX).toBe(8192);
    expect(report.gyroscopeZ).toBe(32767);
    expect(decoded).toEqual(report);
  });

  test("formats descriptor and report arrays for DriverKit source", () => {
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

    const descriptor = formatMacosDriverKitHidDescriptorForCpp();
    const inputReport = formatMacosDriverKitInputReportForCpp(report);

    expect(descriptor).toContain(
      "static const uint8_t openControllerHidReportDescriptor[]",
    );
    expect(descriptor).toContain("0x05, 0x01");
    expect(descriptor).toContain("0x85, 0x02");
    expect(descriptor).toContain("0x91, 0x02");
    expect(inputReport).toContain(
      "static const uint8_t openControllerSampleInputReport[]",
    );
    expect(
      decodeMacosDriverKitInputReport(encodeMacosDriverKitInputReport(report)),
    ).toEqual(report);
  });

  test("formats PlayStation descriptor and report arrays for DriverKit source", () => {
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

    const descriptor = formatMacosDriverKitPlayStationHidDescriptorForCpp();
    const inputReport =
      formatMacosDriverKitPlayStationInputReportForCpp(report);

    expect(descriptor).toContain(
      "static const uint8_t openControllerPlayStationHidReportDescriptor[]",
    );
    expect(descriptor).toContain("0x85, 0x03");
    expect(inputReport).toContain(
      "static const uint8_t openControllerPlayStationSampleInputReport[]",
    );
    expect(encodeMacosDriverKitPlayStationInputReport(report).byteLength).toBe(
      47,
    );
  });

  test("formats Switch descriptor and report arrays for DriverKit source", () => {
    const report = {
      reportId: hidSwitchExtendedReportId,
      buttons: xInputButtonBits.B,
      leftTrigger: 0,
      rightTrigger: 128,
      leftStickX: 0,
      leftStickY: 0,
      rightStickX: 0,
      rightStickY: 0,
      accelerationX: 8192,
      accelerationY: -8192,
      accelerationZ: 16384,
      gyroscopeX: -16384,
      gyroscopeY: 16384,
      gyroscopeZ: 32767,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
    } as const;

    const descriptor = formatMacosDriverKitSwitchHidDescriptorForCpp();
    const inputReport = formatMacosDriverKitSwitchInputReportForCpp(report);

    expect(descriptor).toContain(
      "static const uint8_t openControllerSwitchHidReportDescriptor[]",
    );
    expect(descriptor).toContain("0x85, 0x04");
    expect(inputReport).toContain(
      "static const uint8_t openControllerSwitchSampleInputReport[]",
    );
    expect(encodeMacosDriverKitSwitchInputReport(report).byteLength).toBe(31);
  });

  test("creates DriverKit plist and entitlement templates", () => {
    const infoPlist = createMacosDriverKitInfoPlist();
    const dextEntitlements = createMacosDriverKitEntitlements();
    const hostEntitlements = createMacosHostAppEntitlements();

    expect(infoPlist).toContain("<string>DEXT</string>");
    expect(infoPlist).toContain("<string>AppleUserHIDDevice</string>");
    expect(infoPlist).toContain("<string>IOResources</string>");
    expect(dextEntitlements).toContain(
      "com.apple.developer.driverkit.family.hid.virtual.device",
    );
    expect(hostEntitlements).toContain(
      "com.apple.developer.system-extension.install",
    );
  });

  test("creates an asset manifest for host app packaging", () => {
    const manifest = createMacosDriverKitAssetManifest();

    expect(manifest.systemExtensionPath).toContain(
      "Contents/Library/SystemExtensions",
    );
    expect(manifest.reportProfile).toBe("generic");
    expect(manifest.inputReportByteLength).toBe(13);
    expect(manifest.inputReportId).toBe(1);
    expect(manifest.hidReportDescriptorWithRumbleBytes.length).toBeGreaterThan(
      manifest.hidReportDescriptorBytes.length,
    );
    expect(
      manifest.hidReportDescriptorWithFeedbackBytes.length,
    ).toBeGreaterThan(manifest.hidReportDescriptorWithRumbleBytes.length);
    expect(manifest.rumbleReportByteLength).toBe(
      macosDriverKitRumbleReportByteLength,
    );
    expect(manifest.lightReportByteLength).toBe(
      macosDriverKitLightReportByteLength,
    );
    expect(manifest.lightReportId).toBe(hidGamepadLightReportId);
    expect(manifest.requiredEntitlements).toContain(
      "com.apple.developer.driverkit.userclient-access",
    );
  });

  test("creates DriverKit C++ source templates", () => {
    const header = createMacosDriverKitDriverHeader();
    const source = createMacosDriverKitDriverSource();
    const files = createMacosDriverKitDriverSourceFiles();

    expect(header).toContain("class OpenControllerVirtualGamepadDriver");
    expect(header).toContain("newReportDescriptor() override");
    expect(header).toContain("setReport");
    expect(header).toContain("updateInputReport");
    expect(header).toContain("copyRumbleReport");
    expect(header).toContain("copyLightReport");
    expect(header).toContain("rumbleReport[5]");
    expect(header).toContain("lightReport[7]");
    expect(header).toContain("bool hasRumbleReport");
    expect(header).toContain("bool hasLightReport");
    expect(source).toContain(
      "OSDefineMetaClassAndStructors(OpenControllerVirtualGamepadDriver",
    );
    expect(source).toContain("OSData::withBytes");
    expect(source).toContain("kIOHIDVendorIDKey");
    expect(source).toContain("openControllerNeutralInputReport[13]");
    expect(source).toContain("openControllerInputReportId = 1");
    expect(source).toContain("openControllerRumbleReportId = 2");
    expect(source).toContain("openControllerRumbleReportLength = 5");
    expect(source).toContain("openControllerLightReportId = 5");
    expect(source).toContain("openControllerLightReportLength = 7");
    expect(source).toContain("kIOHIDReportTypeOutput");
    expect(source).toContain("report->readBytes");
    expect(source).toContain("hasRumbleReport = true");
    expect(source).toContain("hasLightReport = true");
    expect(source).toContain("copyRumbleReport");
    expect(source).toContain("copyLightReport");
    expect(source).toContain("CompleteReport");
    expect(Object.keys(files)).toEqual([
      "OpenControllerVirtualGamepadDriver.h",
      "OpenControllerVirtualGamepadDriver.cpp",
    ]);
  });

  test("creates PlayStation DriverKit C++ source templates", () => {
    const header = createMacosDriverKitDriverHeader({
      reportProfile: "playstation",
    });
    const source = createMacosDriverKitDriverSource({
      reportProfile: "playstation",
    });
    const manifest = createMacosDriverKitAssetManifest({
      reportProfile: "playstation",
    });

    expect(header).toContain("inputReport[47]");
    expect(source).toContain("openControllerNeutralInputReport[47]");
    expect(source).toContain("openControllerInputReportId = 3");
    expect(source).toContain("0x85, 0x03");
    expect(source).toContain("0x95, 0x22");
    expect(manifest.reportProfile).toBe("playstation");
    expect(manifest.inputReportByteLength).toBe(47);
    expect(manifest.inputReportId).toBe(3);
  });

  test("creates Switch DriverKit C++ source templates", () => {
    const header = createMacosDriverKitDriverHeader({
      reportProfile: "switch",
    });
    const source = createMacosDriverKitDriverSource({
      reportProfile: "switch",
    });
    const manifest = createMacosDriverKitAssetManifest({
      reportProfile: "switch",
    });

    expect(header).toContain("inputReport[31]");
    expect(source).toContain("openControllerNeutralInputReport[31]");
    expect(source).toContain("openControllerInputReportId = 4");
    expect(source).toContain("0x85, 0x04");
    expect(source).toContain("0x95, 0x09");
    expect(manifest.reportProfile).toBe("switch");
    expect(manifest.inputReportByteLength).toBe(31);
    expect(manifest.inputReportId).toBe(4);
  });

  test("prepares a reviewed macOS DriverKit setup kit", async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), "opencontroller-driverkit-"),
    );

    try {
      const plan = await prepareMacosDriverKitSetup({
        outputDirectory,
        platform: "linux",
        hostBridgePath:
          "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
        bundle: {
          appBundleIdentifier: "com.example.opencontroller.host",
          driverBundleIdentifier: "com.example.opencontroller.driver",
          driverClassName: "ExampleOpenControllerDriver",
          teamIdentifier: "TEAM42",
        },
      });
      const readme = await readFile(plan.readmePath, "utf8");
      const infoPlist = await readFile(plan.infoPlistPath, "utf8");
      const hostEntitlements = await readFile(
        plan.hostEntitlementsPath,
        "utf8",
      );
      const manifest = await readFile(plan.manifestPath, "utf8");
      const formatted = formatMacosDriverKitSetupPlan(plan);

      expect(plan.platform).toBe("linux");
      expect(plan.outputDirectory).toBe(outputDirectory);
      expect(plan.reportProfile).toBe("generic");
      expect(plan.files).toContain(plan.infoPlistPath);
      expect(plan.files).toContain(plan.driverSourcePath);
      expect(plan.doctorCommand).toBe(
        "opencontroller-macos-driverkit-doctor --check",
      );
      expect(plan.nativeTestCommand).toContain(
        "opencontroller native test --backend macos-driverkit",
      );
      expect(plan.nativeTestCommand).toContain("--id player-1");
      expect(plan.nativeTestCommand).toContain(
        "com.example.opencontroller.driver",
      );
      expect(readme).toContain("No privileged system changes were made");
      expect(readme).toContain("System Extension activation");
      expect(readme).toContain("rumble and light output support");
      expect(infoPlist).toContain("com.example.opencontroller.driver");
      expect(hostEntitlements).toContain("TEAM42");
      expect(manifest).toContain("com.example.opencontroller.host");
      expect(formatted).toContain("OpenController macOS DriverKit Setup");
      expect(formatted).toContain("No privileged system changes were made.");
      expect(formatted).toContain("Report profile: generic");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("prepares a PlayStation macOS DriverKit setup kit", async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), "opencontroller-driverkit-playstation-"),
    );

    try {
      const plan = await prepareMacosDriverKitSetup({
        outputDirectory,
        platform: "linux",
        driver: {
          reportProfile: "playstation",
        },
      });
      const readme = await readFile(plan.readmePath, "utf8");
      const header = await readFile(plan.driverHeaderPath, "utf8");
      const source = await readFile(plan.driverSourcePath, "utf8");
      const manifest = await readFile(plan.manifestPath, "utf8");

      expect(plan.reportProfile).toBe("playstation");
      expect(header).toContain("inputReport[47]");
      expect(source).toContain("openControllerNeutralInputReport[47]");
      expect(source).toContain("openControllerInputReportId = 3");
      expect(source).toContain("0x85, 0x03");
      expect(source).toContain("0x95, 0x22");
      expect(manifest).toContain('"reportProfile": "playstation"');
      expect(manifest).toContain('"inputReportByteLength": 47');
      expect(manifest).toContain('"inputReportId": 3');
      expect(readme).toContain("playstation HID report profile");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("prepares a Switch macOS DriverKit setup kit", async () => {
    const outputDirectory = await mkdtemp(
      join(tmpdir(), "opencontroller-driverkit-switch-"),
    );

    try {
      const plan = await prepareMacosDriverKitSetup({
        outputDirectory,
        platform: "linux",
        driver: {
          reportProfile: "switch",
        },
      });
      const readme = await readFile(plan.readmePath, "utf8");
      const header = await readFile(plan.driverHeaderPath, "utf8");
      const source = await readFile(plan.driverSourcePath, "utf8");
      const manifest = await readFile(plan.manifestPath, "utf8");

      expect(plan.reportProfile).toBe("switch");
      expect(header).toContain("inputReport[31]");
      expect(source).toContain("openControllerNeutralInputReport[31]");
      expect(source).toContain("openControllerInputReportId = 4");
      expect(source).toContain("0x85, 0x04");
      expect(source).toContain("0x95, 0x09");
      expect(manifest).toContain('"reportProfile": "switch"');
      expect(manifest).toContain('"inputReportByteLength": 31');
      expect(manifest).toContain('"inputReportId": 4');
      expect(readme).toContain("switch HID report profile");
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  test("wraps a DriverKit host bridge as a native process adapter", async () => {
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
    const adapter = createMacosDriverKitHostBridgeAdapter({
      hostBridgePath:
        "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
      appBundleIdentifier: "com.example.opencontroller.host",
      controllerId: "macos-player",
      driverBundleIdentifier: "com.example.opencontroller.driver",
      driverClassName: "ExampleOpenControllerDriver",
      waitForExitMs: 50,
      spawn,
    });
    const controller = await createController({
      id: "macos-player",
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
    expect(capabilities.supportsLights).toBe(true);
    expect(capabilities.feedbackTypes).toEqual(["rumble", "lights"]);
    expect(capabilities.reportFormats).toContain("hid-gamepad-rumble");
    expect(capabilities.reportFormats).toContain("hid-gamepad-lights");
    expect(
      defaultMacosDriverKitHostBridgePath(
        "/Users/agent/Library/Application Support",
      ),
    ).toBe(
      "/Users/agent/Library/Application Support/OpenController/bin/OpenControllerDriverKitHostBridge",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe(
      "/Applications/OpenController.app/Contents/MacOS/OpenControllerDriverKitHostBridge",
    );
    expect(calls[0]?.args).toEqual([]);
    expect(calls[0]?.env?.OPENCONTROLLER_CONTROLLER_ID).toBe("macos-player");
    expect(calls[0]?.env?.OPENCONTROLLER_DRIVERKIT_HOST_APP_BUNDLE_ID).toBe(
      "com.example.opencontroller.host",
    );
    expect(calls[0]?.env?.OPENCONTROLLER_DRIVERKIT_DRIVER_BUNDLE_ID).toBe(
      "com.example.opencontroller.driver",
    );
    expect(calls[0]?.env?.OPENCONTROLLER_DRIVERKIT_SERVICE_NAME).toBe(
      "ExampleOpenControllerDriver",
    );
    expect(writes[0]).toContain("opencontroller.bridge.connect");
    expect(writes[0]).toContain('"feedbackTypes":["rumble","lights"]');
    expect(writes[0]).toContain(
      '"deviceName":"OpenController Virtual HID Gamepad"',
    );
    expect(writes[0]).toContain('"vendorId":20291');
    expect(writes.some((line) => line.includes('"hidReportBase64"'))).toBe(
      true,
    );
    expect(writes.at(-1)).toContain("opencontroller.bridge.disconnect");
  });
});
