#!/usr/bin/env bun
import {
  createMacosDriverKitAssetManifest,
  createMacosDriverKitEntitlements,
  createMacosDriverKitInfoPlist,
  createMacosHostAppEntitlements,
  formatMacosDriverKitHidDescriptorForCpp,
} from "../driverkit";

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`OpenController macOS DriverKit Assets

Usage:
  opencontroller-macos-driverkit-assets --descriptor-cpp
  opencontroller-macos-driverkit-assets --info-plist
  opencontroller-macos-driverkit-assets --dext-entitlements
  opencontroller-macos-driverkit-assets --host-entitlements
  opencontroller-macos-driverkit-assets --manifest

These assets are DriverKit authoring inputs. They do not install a dext.`);
  process.exit(0);
}

if (args.has("--info-plist")) {
  console.log(createMacosDriverKitInfoPlist());
} else if (args.has("--dext-entitlements")) {
  console.log(createMacosDriverKitEntitlements());
} else if (args.has("--host-entitlements")) {
  console.log(createMacosHostAppEntitlements());
} else if (args.has("--manifest")) {
  console.log(JSON.stringify(createMacosDriverKitAssetManifest(), null, 2));
} else {
  console.log(formatMacosDriverKitHidDescriptorForCpp());
}
