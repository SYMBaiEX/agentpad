#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const publishOrder = [
  "packages/core",
  "packages/overlay",
  "packages/native-linux-uinput",
  "packages/native-windows-virtual-gamepad",
  "packages/native-macos-driverkit",
  "packages/native",
  "packages/cli",
];

const options = parseArgs(process.argv.slice(2));
const rootVersion = readJson(join(root, "package.json")).version;
const selectedWorkspaces =
  options.workspaces.length > 0
    ? publishOrder.filter((workspace) => options.workspaces.includes(workspace))
    : publishOrder;

for (const workspace of options.workspaces) {
  if (!publishOrder.includes(workspace)) {
    fail(`Unknown publish workspace: ${workspace}`, true);
  }
}

if (selectedWorkspaces.length === 0) {
  fail(
    `No publishable workspaces matched: ${options.workspaces.join(", ")}`,
    true,
  );
}

if (!options.dryRun && !options.confirm) {
  fail(
    "Publishing requires --confirm. Use --dry-run to preview package output.",
  );
}

for (const workspace of selectedWorkspaces) {
  verifyWorkspace(workspace);
}

console.log(
  `${options.dryRun ? "Dry-running" : "Publishing"} OpenController ${rootVersion}:`,
);
for (const workspace of selectedWorkspaces) {
  const manifest = readJson(join(root, workspace, "package.json"));
  console.log(`- ${manifest.name}@${manifest.version}`);
}

const cacheDir = mkdtempSync(
  join(tmpdir(), "opencontroller-npm-publish-cache-"),
);
let publishExitStatus = 0;

try {
  for (const workspace of selectedWorkspaces) {
    const manifest = readJson(join(root, workspace, "package.json"));
    const args = [
      "publish",
      "--workspace",
      workspace,
      "--access",
      "public",
      "--tag",
      options.tag,
    ];

    if (options.dryRun) {
      args.push("--dry-run");
    }
    if (options.otp) {
      args.push("--otp", options.otp);
    }

    console.log(`\n> npm ${args.join(" ")}`);
    const result = spawnSync("npm", args, {
      cwd: root,
      env: { ...process.env, NPM_CONFIG_CACHE: cacheDir },
      stdio: "inherit",
    });

    if (result.status !== 0) {
      console.error(
        `\nFailed while publishing ${manifest.name}@${manifest.version}.`,
      );
      console.error("If npm reports E403 for 2FA, rerun with --otp <code>.");
      publishExitStatus = result.status ?? 1;
      break;
    }
  }
} finally {
  rmSync(cacheDir, { force: true, recursive: true });
}

if (publishExitStatus !== 0) {
  process.exit(publishExitStatus);
}

function verifyWorkspace(workspace) {
  if (!publishOrder.includes(workspace)) {
    fail(`Unknown publish workspace: ${workspace}`);
  }

  const manifest = readJson(join(root, workspace, "package.json"));
  const errors = [];

  if (manifest.private === true) {
    errors.push("must not be private");
  }
  if (manifest.version !== rootVersion) {
    errors.push(
      `version ${manifest.version} does not match root ${rootVersion}`,
    );
  }
  if (manifest.publishConfig?.access !== "public") {
    errors.push('publishConfig.access must be "public"');
  }

  if (errors.length > 0) {
    fail(`${manifest.name ?? workspace}: ${errors.join("; ")}`);
  }
}

function parseArgs(args) {
  const parsed = {
    confirm: false,
    dryRun: false,
    otp: process.env.NPM_OTP ?? process.env.NPM_CONFIG_OTP,
    tag: "latest",
    workspaces: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--confirm":
      case "--confirm-publish":
        parsed.confirm = true;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--help":
      case "-h":
        usage();
        process.exit(0);
        break;
      case "--otp":
        index += 1;
        parsed.otp = readValue(args, index, arg);
        break;
      case "--tag":
        index += 1;
        parsed.tag = readValue(args, index, arg);
        break;
      case "--workspace":
      case "-w":
        index += 1;
        parsed.workspaces.push(readValue(args, index, arg));
        break;
      default:
        if (arg.startsWith("--otp=")) {
          parsed.otp = arg.slice("--otp=".length);
        } else if (arg.startsWith("--tag=")) {
          parsed.tag = arg.slice("--tag=".length);
        } else if (arg.startsWith("--workspace=")) {
          parsed.workspaces.push(arg.slice("--workspace=".length));
        } else {
          fail(`Unknown option: ${arg}`, true);
        }
    }
  }

  return parsed;
}

function readValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    fail(`${flag} requires a value`, true);
  }
  return value;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message, showUsage = false) {
  console.error(`error: ${message}`);
  if (showUsage) {
    usage();
  }
  process.exit(1);
}

function usage() {
  console.error(`Usage:
  node scripts/publish-npm-packages.mjs --dry-run
  node scripts/publish-npm-packages.mjs --confirm --otp <code>

Options:
  --dry-run              Run npm publish --dry-run for every package.
  --confirm              Required for a real publish.
  --otp <code>           npm two-factor authentication code.
  --tag <name>           npm dist-tag. Defaults to latest.
  -w, --workspace <path> Publish only selected workspace(s), preserving order.
`);
}
