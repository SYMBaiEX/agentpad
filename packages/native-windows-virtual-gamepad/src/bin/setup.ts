#!/usr/bin/env bun
import {
  type PrepareWindowsVhfSetupOptions,
  formatWindowsVhfSetupPlan,
  prepareWindowsVhfSetup,
} from "../vhf";

type Flags = Record<string, string | boolean>;

const flags = parseFlags(process.argv.slice(2));

if (flags.help || flags.h) {
  printHelp();
  process.exit(0);
}

try {
  const options: PrepareWindowsVhfSetupOptions = {};
  const outputDirectory = stringFlag(flags, "output");
  const hostBridgePath = stringFlag(flags, "host-bridge-path");
  const devicePath = stringFlag(flags, "device-path");

  if (outputDirectory) {
    options.outputDirectory = outputDirectory;
  }
  if (hostBridgePath) {
    options.hostBridgePath = hostBridgePath;
  }
  if (devicePath) {
    options.devicePath = devicePath;
  }

  const plan = await prepareWindowsVhfSetup(options);
  if (booleanFlag(flags, "json")) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(formatWindowsVhfSetupPlan(plan));
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

function printHelp(): void {
  console.log(`OpenController Windows VHF Setup

Usage:
  opencontroller-windows-vhf-setup
  opencontroller-windows-vhf-setup --output ./opencontroller-windows-vhf
  opencontroller-windows-vhf-setup --json

Options:
  --output <dir>              Directory for generated driver and host files
  --host-bridge-path <path>   Final reviewed host bridge executable path
  --device-path <path>        Windows device path exposed by the driver
  --json                      Print the setup plan as JSON

This command writes source templates and reviewed commands only. It does not
install drivers, sign packages, or make privileged system changes.`);
}
