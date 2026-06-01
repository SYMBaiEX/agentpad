#!/usr/bin/env bun
import {
  type WindowsVhfReportProfile,
  createWindowsVhfDriverHeader,
  createWindowsVhfDriverSource,
  createWindowsVhfHostBridgeHeader,
  createWindowsVhfHostBridgeSource,
  createWindowsVhfInf,
  formatWindowsVhfHidDescriptorForC,
  formatWindowsVhfPlayStationHidDescriptorForC,
} from "../vhf";

const args = new Set(process.argv.slice(2));
const flags = parseFlags(process.argv.slice(2));
const reportProfile = parseReportProfile(flags["report-profile"]);

if (args.has("--help") || args.has("-h")) {
  console.log(`OpenController Windows VHF Assets

Usage:
  opencontroller-windows-vhf-assets --descriptor-c
  opencontroller-windows-vhf-assets --driver-c
  opencontroller-windows-vhf-assets --driver-h
  opencontroller-windows-vhf-assets --host-c
  opencontroller-windows-vhf-assets --host-h
  opencontroller-windows-vhf-assets --inf

Options:
  --report-profile <generic|playstation>

These assets are driver-authoring inputs. They do not install a driver.`);
  process.exit(0);
}

if (args.has("--inf")) {
  console.log(createWindowsVhfInf());
} else if (args.has("--driver-c")) {
  console.log(createWindowsVhfDriverSource({ reportProfile }));
} else if (args.has("--driver-h")) {
  console.log(createWindowsVhfDriverHeader({ reportProfile }));
} else if (args.has("--host-c")) {
  console.log(createWindowsVhfHostBridgeSource({ reportProfile }));
} else if (args.has("--host-h")) {
  console.log(createWindowsVhfHostBridgeHeader({ reportProfile }));
} else if (reportProfile === "playstation") {
  console.log(formatWindowsVhfPlayStationHidDescriptorForC());
} else {
  console.log(formatWindowsVhfHidDescriptorForC());
}

function parseFlags(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
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
      parsed[rawKey] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = true;
    }
  }
  return parsed;
}

function parseReportProfile(
  value: string | boolean | undefined,
): WindowsVhfReportProfile {
  if (value === undefined || value === false) {
    return "generic";
  }
  if (value === "generic" || value === "playstation") {
    return value;
  }
  throw new Error(
    "opencontroller-windows-vhf-assets: --report-profile must be generic or playstation",
  );
}
