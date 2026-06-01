import { mkdir, writeFile } from "node:fs/promises";

export async function initCommand(): Promise<void> {
  await mkdir("agentpad", { recursive: true });
  await writeFile(
    "agentpad/actions.ts",
    `import { createActionMap, type Controller } from "@agentpad/core";

export function createDefaultActions(controller: Controller) {
  return createActionMap(controller, {
    interact: [{ type: "press", button: "A", durationMs: 100 }],
    dodge: [{ type: "press", button: "B", durationMs: 90 }],
    moveForward: [{ type: "stick", stick: "LEFT", x: 0, y: -1, durationMs: 300 }],
    stop: [{ type: "neutral" }]
  });
}
`,
  );
  console.log("Created agentpad/actions.ts");
}
