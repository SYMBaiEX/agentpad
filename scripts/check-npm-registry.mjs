#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const workspaces = [
  "packages/core",
  "packages/overlay",
  "packages/native-linux-uinput",
  "packages/native-windows-virtual-gamepad",
  "packages/native-macos-driverkit",
  "packages/native",
  "packages/cli",
];

const nameWidth = Math.max(
  "Package".length,
  ...workspaces.map(
    (workspace) => readJson(join(root, workspace, "package.json")).name.length,
  ),
);
const localWidth = "0.0.0".length;
const publishedWidth = "Published".length;

const options = parseArgs(process.argv.slice(2));
const rows = [];

if (!options.json) {
  printHeader();
}

for (const workspace of workspaces) {
  const manifest = readJson(join(root, workspace, "package.json"));
  const published = await readPublishedVersion(manifest.name);
  const status = compareStatus(manifest.version, published.version);
  const row = {
    packageName: manifest.name,
    workspace,
    localVersion: manifest.version,
    publishedVersion: published.version,
    status: published.status === "missing" ? "missing" : status,
    error: published.error,
  };
  rows.push(row);

  if (!options.json) {
    printRow(row);
  }
}

if (options.json) {
  console.log(JSON.stringify(rows, null, 2));
}

const hasMismatch = rows.some((row) => row.status !== "synced");
if (hasMismatch) {
  process.exitCode = 1;
}

async function readPublishedVersion(packageName) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 404) {
      return {
        status: "missing",
        version: undefined,
        error: "package not found",
      };
    }

    if (!response.ok) {
      return {
        status: "missing",
        version: undefined,
        error: `registry returned HTTP ${response.status}`,
      };
    }

    const metadata = await response.json();
    const version = metadata?.["dist-tags"]?.latest;
    if (typeof version !== "string") {
      return {
        status: "missing",
        version: undefined,
        error: "registry metadata did not include dist-tags.latest",
      };
    }

    return {
      status: "published",
      version,
    };
  } catch (error) {
    return {
      status: "missing",
      version: undefined,
      error: `could not read npm registry metadata: ${formatError(error)}`,
    };
  }
}

function formatError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;
  if (cause instanceof Error) {
    return `${error.message}: ${cause.message}`;
  }
  if (isRecord(cause)) {
    const code = typeof cause.code === "string" ? ` ${cause.code}` : "";
    const message =
      typeof cause.message === "string" ? `: ${cause.message}` : "";
    return `${error.message}${code}${message}`;
  }

  return error.message;
}

function compareStatus(localVersion, publishedVersion) {
  if (publishedVersion === undefined) {
    return "missing";
  }
  if (localVersion === publishedVersion) {
    return "synced";
  }

  const comparison = compareSemver(localVersion, publishedVersion);
  if (comparison > 0) {
    return "local-ahead";
  }
  if (comparison < 0) {
    return "registry-ahead";
  }
  return "mismatch";
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    return a.localeCompare(b);
  }

  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function printHeader() {
  console.log(
    `${pad("Package", nameWidth)}  ${pad("Local", localWidth)}  ${pad(
      "Published",
      publishedWidth,
    )}  Status`,
  );
  console.log(
    `${"-".repeat(nameWidth)}  ${"-".repeat(localWidth)}  ${"-".repeat(
      publishedWidth,
    )}  ${"-".repeat("Status".length)}`,
  );
}

function printRow(row) {
  console.log(
    `${pad(row.packageName, nameWidth)}  ${pad(
      row.localVersion,
      localWidth,
    )}  ${pad(row.publishedVersion ?? "-", publishedWidth)}  ${row.status}`,
  );
}

function pad(value, length) {
  return value.padEnd(length, " ");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function parseArgs(args) {
  const parsed = {
    json: false,
  };

  for (const arg of args) {
    switch (arg) {
      case "--json":
        parsed.json = true;
        break;
      case "--help":
      case "-h":
        usage();
        process.exit(0);
        break;
      default:
        fail(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function fail(message) {
  console.error(`error: ${message}`);
  usage();
  process.exit(1);
}

function usage() {
  console.error(`Usage:
  node scripts/check-npm-registry.mjs
  node scripts/check-npm-registry.mjs --json

Checks local OpenController package versions against the live npm registry.
Exits non-zero when any package is missing or out of sync.
`);
}
