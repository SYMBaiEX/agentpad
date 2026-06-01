#!/usr/bin/env bun
import {
  createWindowsVhfDriverHeader,
  createWindowsVhfDriverSource,
  createWindowsVhfHostBridgeHeader,
  createWindowsVhfHostBridgeSource,
  createWindowsVhfInf,
  formatWindowsVhfHidDescriptorForC,
} from "../vhf";

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`OpenController Windows VHF Assets

Usage:
  opencontroller-windows-vhf-assets --descriptor-c
  opencontroller-windows-vhf-assets --driver-c
  opencontroller-windows-vhf-assets --driver-h
  opencontroller-windows-vhf-assets --host-c
  opencontroller-windows-vhf-assets --host-h
  opencontroller-windows-vhf-assets --inf

These assets are driver-authoring inputs. They do not install a driver.`);
  process.exit(0);
}

if (args.has("--inf")) {
  console.log(createWindowsVhfInf());
} else if (args.has("--driver-c")) {
  console.log(createWindowsVhfDriverSource());
} else if (args.has("--driver-h")) {
  console.log(createWindowsVhfDriverHeader());
} else if (args.has("--host-c")) {
  console.log(createWindowsVhfHostBridgeSource());
} else if (args.has("--host-h")) {
  console.log(createWindowsVhfHostBridgeHeader());
} else {
  console.log(formatWindowsVhfHidDescriptorForC());
}
