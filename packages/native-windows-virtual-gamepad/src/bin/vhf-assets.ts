#!/usr/bin/env bun
import { createWindowsVhfInf, formatWindowsVhfHidDescriptorForC } from "../vhf";

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`OpenController Windows VHF Assets

Usage:
  opencontroller-windows-vhf-assets --descriptor-c
  opencontroller-windows-vhf-assets --inf

These assets are driver-authoring inputs. They do not install a driver.`);
  process.exit(0);
}

if (args.has("--inf")) {
  console.log(createWindowsVhfInf());
} else {
  console.log(formatWindowsVhfHidDescriptorForC());
}
