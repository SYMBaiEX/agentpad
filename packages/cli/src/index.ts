#!/usr/bin/env bun
import { doctorCommand } from "./commands/doctor";
import { initCommand } from "./commands/init";
import { overlayCommand } from "./commands/overlay";
import { replayCommand } from "./commands/replay";
import { testCommand } from "./commands/test";

type Flags = Record<string, string | boolean>;

async function main(argv: string[]): Promise<void> {
  const [command = "help", ...rest] = argv;
  const flags = parseFlags(rest);

  switch (command) {
    case "init":
      await initCommand();
      return;
    case "doctor":
      await doctorCommand();
      return;
    case "test":
      await testCommand(stringFlags(flags));
      return;
    case "overlay":
      await overlayCommand(stringFlags(flags));
      return;
    case "replay":
      await replayCommand(rest.find((arg) => !arg.startsWith("--")));
      return;
    case "adapters":
      await doctorCommand();
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
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

function stringFlags(flags: Flags): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(flags)) {
    result[key] = typeof value === "string" ? value : undefined;
  }
  return result;
}

function printHelp(): void {
  console.log(`AgentPad CLI

Usage:
  agentpad init
  agentpad doctor
  agentpad test --profile xbox --adapter dry-run
  agentpad overlay --profile xbox --port 4317
  agentpad replay ./replays/session/events.jsonl
  agentpad adapters
`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
