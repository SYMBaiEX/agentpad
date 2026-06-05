#!/usr/bin/env bun
import {
  type MacosDriverKitBundleOptions,
  type MacosDriverKitReportProfile,
  type PrepareMacosDriverKitSetupOptions,
  formatMacosDriverKitSetupPlan,
  prepareMacosDriverKitSetup,
} from "../driverkit";

type Flags = Record<string, string | boolean>;

const flags = parseFlags(process.argv.slice(2));

if (flags.help || flags.h) {
  printHelp();
  process.exit(0);
}

try {
  const options: PrepareMacosDriverKitSetupOptions = {};
  const bundle: MacosDriverKitBundleOptions = {};
  const outputDirectory = stringFlag(flags, "output");
  const hostBridgePath = stringFlag(flags, "host-bridge-path");
  const appBundleIdentifier = stringFlag(flags, "app-bundle-id");
  const driverBundleIdentifier = stringFlag(flags, "driver-bundle-id");
  const driverClassName = stringFlag(flags, "driver-class-name");
  const teamIdentifier = stringFlag(flags, "team-id");
  const reportProfile = reportProfileFlag(flags, "report-profile");

  if (outputDirectory) {
    options.outputDirectory = outputDirectory;
  }
  if (hostBridgePath) {
    options.hostBridgePath = hostBridgePath;
  }
  if (appBundleIdentifier) {
    bundle.appBundleIdentifier = appBundleIdentifier;
  }
  if (driverBundleIdentifier) {
    bundle.driverBundleIdentifier = driverBundleIdentifier;
  }
  if (driverClassName) {
    bundle.driverClassName = driverClassName;
  }
  if (teamIdentifier) {
    bundle.teamIdentifier = teamIdentifier;
  }
  if (Object.keys(bundle).length > 0) {
    options.bundle = bundle;
  }
  if (reportProfile) {
    options.driver = {
      ...(options.driver ?? {}),
      reportProfile,
    };
  }

  const plan = await prepareMacosDriverKitSetup(options);
  if (booleanFlag(flags, "json")) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(formatMacosDriverKitSetupPlan(plan));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (!rawKey) {
      continue;
    }
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      flags[rawKey] = next;
      index += 1;
    } else {
      flags[rawKey] = true;
    }
  }

  return flags;
}

function stringFlag(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function booleanFlag(flags: Flags, key: string): boolean {
  return flags[key] === true || flags[key] === "true";
}

function reportProfileFlag(
  flags: Flags,
  key: string,
): MacosDriverKitReportProfile | undefined {
  const value = flags[key];
  if (value === undefined || value === false) {
    return undefined;
  }
  if (value === "generic" || value === "playstation" || value === "switch") {
    return value;
  }
  throw new Error(`--${key} must be generic, playstation, or switch`);
}

function printHelp(): void {
  console.log(`OpenController macOS DriverKit Setup

Usage:
  opencontroller-macos-driverkit-setup
  opencontroller-macos-driverkit-setup --output ./opencontroller-macos-driverkit
  opencontroller-macos-driverkit-setup --json

Options:
  --output <dir>              Directory for generated DriverKit and host files
  --host-bridge-path <path>   Final reviewed host bridge executable path
  --app-bundle-id <id>        Host app bundle identifier
  --driver-bundle-id <id>     DriverKit extension bundle identifier
  --driver-class-name <name>  DriverKit IOUserHIDDevice class name
  --team-id <id>              Apple Developer Team ID used in entitlements
  --report-profile <name>     generic, playstation, or switch HID report profile
  --json                      Print the setup plan as JSON

This command writes source templates and reviewed commands only. It does not
sign, notarize, activate, or install a DriverKit system extension.`);
}
