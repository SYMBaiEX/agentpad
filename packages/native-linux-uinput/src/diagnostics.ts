import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";

export const linuxUinputDeviceCandidates = [
  "/dev/uinput",
  "/dev/input/uinput",
] as const;

export type LinuxUinputDeviceDiagnostic = {
  path: string;
  exists: boolean;
  writable: boolean;
  characterDevice?: boolean;
  mode?: string;
  uid?: number;
  gid?: number;
  error?: string;
};

export type LinuxUinputUdevRule = {
  name: string;
  path: string;
  rule: string;
  description: string;
};

export type LinuxUinputDiagnostics = {
  platform: NodeJS.Platform;
  supportedPlatform: boolean;
  ok: boolean;
  selectedDevicePath?: string;
  moduleLoaded?: boolean;
  devices: LinuxUinputDeviceDiagnostic[];
  udevRules: LinuxUinputUdevRule[];
  recommendations: string[];
};

export type DiagnoseLinuxUinputOptions = {
  platform?: NodeJS.Platform;
  devicePaths?: readonly string[];
  access?: (path: string, mode?: number) => Promise<void>;
  stat?: (path: string) => Promise<MinimalStats>;
  readFile?: (path: string, encoding: "utf8") => Promise<string>;
  udevGroup?: string;
};

type MinimalStats = {
  mode: number;
  uid: number;
  gid: number;
  isCharacterDevice?: () => boolean;
};

export async function diagnoseLinuxUinput(
  options: DiagnoseLinuxUinputOptions = {},
): Promise<LinuxUinputDiagnostics> {
  const platform = options.platform ?? process.platform;
  const udevRules = createLinuxUinputUdevRules(
    options.udevGroup === undefined ? {} : { group: options.udevGroup },
  );

  if (platform !== "linux") {
    return {
      platform,
      supportedPlatform: false,
      ok: false,
      devices: [],
      udevRules,
      recommendations: [
        "@opencontroller/native-linux-uinput only creates virtual devices on Linux.",
      ],
    };
  }

  const devicePaths = options.devicePaths ?? linuxUinputDeviceCandidates;
  const accessFn = options.access ?? access;
  const statFn = options.stat ?? stat;
  const readFileFn = options.readFile ?? readFile;

  const [devices, moduleLoaded] = await Promise.all([
    Promise.all(
      devicePaths.map((path) => inspectDevice(path, accessFn, statFn)),
    ),
    inspectModuleLoaded(readFileFn),
  ]);
  const selectedDevice = devices.find(
    (device) => device.exists && device.writable && device.characterDevice,
  );
  const recommendations = createRecommendations(devices, moduleLoaded);

  return {
    platform,
    supportedPlatform: true,
    ok: Boolean(selectedDevice),
    ...(selectedDevice ? { selectedDevicePath: selectedDevice.path } : {}),
    ...(moduleLoaded === undefined ? {} : { moduleLoaded }),
    devices,
    udevRules,
    recommendations,
  };
}

export function formatLinuxUinputDiagnostics(
  diagnostics: LinuxUinputDiagnostics,
): string {
  const lines = [
    "OpenController Linux uinput Doctor",
    "",
    `Platform: ${diagnostics.platform}`,
    `Supported: ${diagnostics.supportedPlatform ? "yes" : "no"}`,
    `Ready: ${diagnostics.ok ? "yes" : "no"}`,
  ];

  if (diagnostics.moduleLoaded !== undefined) {
    lines.push(
      `uinput module loaded: ${diagnostics.moduleLoaded ? "yes" : "no"}`,
    );
  }
  if (diagnostics.selectedDevicePath) {
    lines.push(`Selected device: ${diagnostics.selectedDevicePath}`);
  }

  if (diagnostics.devices.length > 0) {
    lines.push("", "Devices:");
    for (const device of diagnostics.devices) {
      lines.push(
        `  ${device.path}: ${device.exists ? "exists" : "missing"}, ${
          device.writable ? "writable" : "not writable"
        }, ${device.characterDevice ? "character device" : "not character device"}`,
      );
      if (device.mode) {
        lines.push(
          `    mode=${device.mode} uid=${device.uid} gid=${device.gid}`,
        );
      }
      if (device.error) {
        lines.push(`    ${device.error}`);
      }
    }
  }

  if (diagnostics.recommendations.length > 0) {
    lines.push("", "Recommendations:");
    for (const recommendation of diagnostics.recommendations) {
      lines.push(`  - ${recommendation}`);
    }
  }

  lines.push("", "Optional udev rules:");
  for (const rule of diagnostics.udevRules) {
    lines.push(`  ${rule.name}: ${rule.rule}`);
  }

  return lines.join("\n");
}

export function createLinuxUinputUdevRules(options: { group?: string } = {}) {
  const group = options.group ?? "input";
  return [
    {
      name: "desktop-uaccess",
      path: "/etc/udev/rules.d/70-opencontroller-uinput.rules",
      rule: 'KERNEL=="uinput", SUBSYSTEM=="misc", OPTIONS+="static_node=uinput", TAG+="uaccess", MODE="0660"',
      description: "Desktop-oriented rule for logind/seat-managed user access.",
    },
    {
      name: "input-group",
      path: "/etc/udev/rules.d/70-opencontroller-uinput.rules",
      rule: `KERNEL=="uinput", SUBSYSTEM=="misc", OPTIONS+="static_node=uinput", GROUP="${group}", MODE="0660"`,
      description: `Group-oriented rule for systems where users are explicitly added to ${group}.`,
    },
  ] satisfies LinuxUinputUdevRule[];
}

async function inspectDevice(
  path: string,
  accessFn: (path: string, mode?: number) => Promise<void>,
  statFn: (path: string) => Promise<MinimalStats>,
): Promise<LinuxUinputDeviceDiagnostic> {
  try {
    const stats = await statFn(path);
    const writable = await canAccess(path, constants.W_OK, accessFn);
    return {
      path,
      exists: true,
      writable,
      characterDevice: stats.isCharacterDevice?.() ?? false,
      mode: `0${(stats.mode & 0o777).toString(8)}`,
      uid: stats.uid,
      gid: stats.gid,
      ...(writable
        ? {}
        : { error: "Current process cannot write this device." }),
    };
  } catch (error) {
    return {
      path,
      exists: false,
      writable: false,
      characterDevice: false,
      error: errorMessage(error),
    };
  }
}

async function inspectModuleLoaded(
  readFileFn: (path: string, encoding: "utf8") => Promise<string>,
): Promise<boolean | undefined> {
  try {
    const modules = await readFileFn("/proc/modules", "utf8");
    return modules.split("\n").some((line) => line.startsWith("uinput "));
  } catch {
    return undefined;
  }
}

async function canAccess(
  path: string,
  mode: number,
  accessFn: (path: string, mode?: number) => Promise<void>,
): Promise<boolean> {
  try {
    await accessFn(path, mode);
    return true;
  } catch {
    return false;
  }
}

function createRecommendations(
  devices: LinuxUinputDeviceDiagnostic[],
  moduleLoaded: boolean | undefined,
): string[] {
  const recommendations: string[] = [];
  const existingDevices = devices.filter((device) => device.exists);
  const writableDevices = existingDevices.filter((device) => device.writable);

  if (moduleLoaded === false) {
    recommendations.push("Load the uinput module with: sudo modprobe uinput");
  }
  if (existingDevices.length === 0) {
    recommendations.push(
      "No uinput device node was found. Load the module or create a persistent udev rule.",
    );
  }
  if (existingDevices.length > 0 && writableDevices.length === 0) {
    recommendations.push(
      "Grant write access to /dev/uinput using a reviewed udev rule, input group, or sudo for testing.",
    );
  }
  if (existingDevices.some((device) => !device.characterDevice)) {
    recommendations.push(
      "A uinput path exists but is not a character device; inspect the device node before using it.",
    );
  }
  if (recommendations.length === 0) {
    recommendations.push("Linux uinput looks ready for OpenController.");
  }

  return recommendations;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
