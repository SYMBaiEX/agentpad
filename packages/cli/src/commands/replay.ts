import { readFile } from "node:fs/promises";
import type { ReplayEvent } from "@agentpad/core";

export async function replayCommand(path: string | undefined): Promise<void> {
  if (!path) {
    throw new Error("Usage: agentpad replay ./replays/session/events.jsonl");
  }

  const raw = await readFile(path, "utf8");
  const events = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReplayEvent);
  const commands = events.filter((event) => event.type === "command");
  const errors = events.filter((event) => event.type === "error");
  const states = events.filter((event) => event.type === "state");

  console.log("AgentPad Replay Summary");
  console.log(`  file: ${path}`);
  console.log(`  events: ${events.length}`);
  console.log(`  commands: ${commands.length}`);
  console.log(`  states: ${states.length}`);
  console.log(`  errors: ${errors.length}`);

  const first = events[0];
  const last = events.at(-1);
  if (first && last) {
    console.log(`  first timestamp: ${first.timestamp}`);
    console.log(`  last timestamp: ${last.timestamp}`);
  }
}
