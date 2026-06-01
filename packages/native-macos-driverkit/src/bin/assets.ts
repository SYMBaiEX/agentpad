#!/usr/bin/env bun
import {
  type MacosDriverKitReportProfile,
  createMacosDriverKitAssetManifest,
  createMacosDriverKitDriverHeader,
  createMacosDriverKitDriverSource,
  createMacosDriverKitEntitlements,
  createMacosDriverKitInfoPlist,
  createMacosHostAppEntitlements,
  formatMacosDriverKitHidDescriptorForCpp,
  formatMacosDriverKitPlayStationHidDescriptorForCpp,
} from "../driverkit";

const args = new Set(process.argv.slice(2));
const flags = parseFlags(process.argv.slice(2));
const reportProfile = parseReportProfile(flags["report-profile"]);

if (args.has("--help") || args.has("-h")) {
  console.log(`OpenController macOS DriverKit Assets

Usage:
  opencontroller-macos-driverkit-assets --descriptor-cpp
  opencontroller-macos-driverkit-assets --driver-cpp
  opencontroller-macos-driverkit-assets --driver-h
  opencontroller-macos-driverkit-assets --info-plist
  opencontroller-macos-driverkit-assets --dext-entitlements
  opencontroller-macos-driverkit-assets --host-entitlements
  opencontroller-macos-driverkit-assets --manifest

Options:
  --report-profile <generic|playstation>

These assets are DriverKit authoring inputs. They do not install a dext.`);
  process.exit(0);
}

if (args.has("--info-plist")) {
  console.log(createMacosDriverKitInfoPlist());
} else if (args.has("--driver-cpp")) {
  console.log(createMacosDriverKitDriverSource({ reportProfile }));
} else if (args.has("--driver-h")) {
  console.log(createMacosDriverKitDriverHeader({ reportProfile }));
} else if (args.has("--dext-entitlements")) {
  console.log(createMacosDriverKitEntitlements());
} else if (args.has("--host-entitlements")) {
  console.log(createMacosHostAppEntitlements());
} else if (args.has("--manifest")) {
  console.log(
    JSON.stringify(
      createMacosDriverKitAssetManifest({ reportProfile }),
      null,
      2,
    ),
  );
} else if (reportProfile === "playstation") {
  console.log(formatMacosDriverKitPlayStationHidDescriptorForCpp());
} else {
  console.log(formatMacosDriverKitHidDescriptorForCpp());
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
): MacosDriverKitReportProfile {
  if (value === undefined || value === false) {
    return "generic";
  }
  if (value === "generic" || value === "playstation") {
    return value;
  }
  throw new Error(
    "opencontroller-macos-driverkit-assets: --report-profile must be generic or playstation",
  );
}
