import { createController } from "@opencontroller/core";

export async function doctorCommand(): Promise<void> {
  const controller = await createController({
    profile: "xbox",
    adapter: "dry-run",
    replay: false,
  });
  const capabilities = controller.capabilities();
  await controller.disconnect();

  const rows = [
    ["Runtime", ""],
    ["Bun", Bun.version],
    ["OS", `${process.platform} ${process.arch}`],
    ["", ""],
    ["Adapters", ""],
    ["dry-run", "ready"],
    ["websocket", "ready when target server is reachable"],
    ["", ""],
    ["Dry-run capabilities", JSON.stringify(capabilities)],
  ];

  printTable("OpenController Doctor", rows);
}

function printTable(title: string, rows: string[][]): void {
  console.log(title);
  console.log("");
  for (const [label, value] of rows) {
    if (!label && !value) {
      console.log("");
      continue;
    }
    if (value === "") {
      console.log(`${label}:`);
      continue;
    }
    console.log(`  ${label}: ${value}`);
  }
}
