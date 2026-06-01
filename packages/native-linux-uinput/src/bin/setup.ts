#!/usr/bin/env bun
import {
  formatLinuxUinputSetupPlan,
  prepareLinuxUinputSetup,
} from "../linux-uinput";

const flags = parseFlags(process.argv.slice(2));

if (flags.help) {
  printHelp();
  process.exit(0);
}

prepareLinuxUinputSetup({
  ...(typeof flags.output === "string" ? { outputPath: flags.output } : {}),
  ...(typeof flags.cc === "string" ? { cc: flags.cc } : {}),
  ...(typeof flags["udev-group"] === "string"
    ? { udevGroup: flags["udev-group"] }
    : {}),
})
  .then((plan) => {
    if (flags.json) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.log(formatLinuxUinputSetupPlan(plan));
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

function parseFlags(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (!key) {
      continue;
    }
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`OpenController Linux uinput setup

Usage:
  opencontroller-linux-uinput-setup
  opencontroller-linux-uinput-setup --output ~/.opencontroller/bin/opencontroller-uinput-bridge
  opencontroller-linux-uinput-setup --udev-group input
  opencontroller-linux-uinput-setup --json

This builds the helper and prints reviewed udev-rule commands. It does not run
sudo or install permission rules automatically.`);
}
