#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = mkdtempSync(join(tmpdir(), "opencontroller-npm-cache-"));

const workspaces = [
  "packages/core",
  "packages/overlay",
  "packages/cli",
  "packages/native",
  "packages/native-linux-uinput",
  "packages/native-windows-virtual-gamepad",
  "packages/native-macos-driverkit",
];

const sourceAllowlist = new Map([
  [
    "packages/native-linux-uinput",
    new Set(["src/helper/opencontroller-uinput-bridge.c"]),
  ],
]);

let failures = 0;

try {
  for (const workspace of workspaces) {
    checkWorkspace(workspace);
  }
} finally {
  rmSync(cacheDir, { force: true, recursive: true });
}

if (failures > 0) {
  process.exitCode = 1;
}

function checkWorkspace(workspace) {
  const packageDir = resolve(root, workspace);
  const manifest = readJson(join(packageDir, "package.json"));
  const errors = [];

  if (manifest.private === true) {
    errors.push("package must not be private");
  }
  if (manifest.version !== readRootVersion()) {
    errors.push(`version ${manifest.version} does not match root version`);
  }
  if (manifest.license !== "MIT") {
    errors.push("license must be MIT");
  }
  if (manifest.type !== "module") {
    errors.push('type must be "module"');
  }
  if (
    manifest.homepage !== "https://github.com/SYMBaiEX/OpenController#readme"
  ) {
    errors.push("homepage must point to the GitHub README");
  }
  if (
    manifest.bugs?.url !== "https://github.com/SYMBaiEX/OpenController/issues"
  ) {
    errors.push("bugs.url must point to the GitHub issue tracker");
  }
  if (manifest.repository?.directory !== workspace) {
    errors.push(`repository.directory must be ${workspace}`);
  }
  if (manifest.publishConfig?.access !== "public") {
    errors.push('publishConfig.access must be "public"');
  }
  if (!manifest.files?.includes("dist")) {
    errors.push('files must include "dist"');
  }
  if (!manifest.files?.includes("README.md")) {
    errors.push('files must include "README.md"');
  }
  if (!manifest.files?.includes("LICENSE")) {
    errors.push('files must include "LICENSE"');
  }

  const pack = spawnSync(
    "npm",
    [
      "pack",
      "--workspace",
      workspace,
      "--dry-run",
      "--json",
      "--cache",
      cacheDir,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NPM_CONFIG_CACHE: cacheDir },
    },
  );

  if (pack.status !== 0) {
    errors.push(`npm pack failed:\n${pack.stderr || pack.stdout}`);
    report(workspace, manifest.name, errors);
    return;
  }

  const packResult = parsePackJson(pack.stdout, errors);
  if (!packResult) {
    report(workspace, manifest.name, errors);
    return;
  }

  const packedFiles = new Map(
    packResult.files.map((file) => [normalizePath(file.path), file]),
  );

  requirePackedFile(packedFiles, "package.json", errors);
  requirePackedFile(packedFiles, "README.md", errors);
  requirePackedFile(packedFiles, "LICENSE", errors);
  requireManifestPath(packageDir, packedFiles, manifest.main, "main", errors);
  requireManifestPath(packageDir, packedFiles, manifest.types, "types", errors);

  for (const target of collectExportTargets(manifest.exports)) {
    requireManifestPath(packageDir, packedFiles, target, "exports", errors);
  }

  for (const [name, target] of Object.entries(manifest.bin ?? {})) {
    const file = requireManifestPath(
      packageDir,
      packedFiles,
      target,
      `bin ${name}`,
      errors,
    );
    if (file && (file.mode & 0o111) === 0) {
      errors.push(`bin ${name} target ${target} is not executable`);
    }
  }

  for (const path of packedFiles.keys()) {
    validatePackedPath(workspace, path, errors);
  }

  report(workspace, manifest.name, errors, packResult);
}

function readRootVersion() {
  return readJson(join(root, "package.json")).version;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parsePackJson(stdout, errors) {
  try {
    const parsed = JSON.parse(stdout.trim());
    const result = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!result?.files || !Array.isArray(result.files)) {
      errors.push("npm pack JSON did not include a files array");
      return undefined;
    }
    return result;
  } catch (error) {
    errors.push(
      `could not parse npm pack JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return undefined;
  }
}

function collectExportTargets(exportsMap) {
  const targets = [];
  collect(exportsMap);
  return targets;

  function collect(value) {
    if (typeof value === "string") {
      targets.push(value);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const nested of Object.values(value)) {
      collect(nested);
    }
  }
}

function requireManifestPath(packageDir, packedFiles, target, label, errors) {
  if (!target) {
    errors.push(`${label} target is missing`);
    return undefined;
  }

  const path = normalizePath(target);
  if (!existsSync(resolve(packageDir, path))) {
    errors.push(`${label} target ${target} does not exist on disk`);
    return undefined;
  }

  return requirePackedFile(packedFiles, path, errors, `${label} target`);
}

function requirePackedFile(packedFiles, path, errors, label = "required file") {
  const normalized = normalizePath(path);
  const file = packedFiles.get(normalized);
  if (!file) {
    errors.push(`${label} ${normalized} is missing from npm pack output`);
  }
  return file;
}

function validatePackedPath(workspace, path, errors) {
  const allowedSources = sourceAllowlist.get(workspace) ?? new Set();
  if (path.startsWith("src/") && !allowedSources.has(path)) {
    errors.push(`unexpected source file in package: ${path}`);
  }
  if (path.includes("__tests__/") || path.includes("/test/")) {
    errors.push(`test file leaked into package: ${path}`);
  }
  if (path.endsWith(".tsbuildinfo")) {
    errors.push(`TypeScript build info leaked into package: ${path}`);
  }
  if (path.startsWith("node_modules/")) {
    errors.push(`node_modules leaked into package: ${path}`);
  }
  if (
    path === ".npmrc" ||
    path.endsWith(".env") ||
    path.includes("/.env") ||
    path.endsWith(".pem") ||
    path.endsWith(".key") ||
    path.endsWith(".p12") ||
    path.endsWith(".pfx")
  ) {
    errors.push(`sensitive local file leaked into package: ${path}`);
  }
}

function normalizePath(path) {
  return path.replace(/^\.\//, "").replaceAll("\\", "/");
}

function report(workspace, packageName, errors, packResult) {
  if (errors.length === 0) {
    console.log(
      `ok ${packageName} (${workspace}): ${packResult.entryCount} files, ${formatBytes(
        packResult.unpackedSize,
      )} unpacked`,
    );
    return;
  }

  failures += 1;
  console.error(`fail ${packageName ?? workspace}:`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}
