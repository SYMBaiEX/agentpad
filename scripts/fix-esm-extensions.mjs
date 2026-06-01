#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const roots = process.argv.slice(2);

if (roots.length === 0) {
  console.error("Usage: node scripts/fix-esm-extensions.mjs <dist-dir> [...]");
  process.exitCode = 1;
} else {
  for (const root of roots) {
    await rewriteDirectory(resolve(root));
  }
}

async function rewriteDirectory(root) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      await rewriteDirectory(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      await rewriteFile(entryPath);
    }
  }
}

async function rewriteFile(filePath) {
  const original = await readFile(filePath, "utf8");
  const rewritten = original
    .replace(
      /\b(from\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${resolveRelativeSpecifier(filePath, specifier)}${suffix}`,
    )
    .replace(
      /\b(import\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${resolveRelativeSpecifier(filePath, specifier)}${suffix}`,
    )
    .replace(
      /\b(import\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g,
      (_match, prefix, specifier, suffix) =>
        `${prefix}${resolveRelativeSpecifier(filePath, specifier)}${suffix}`,
    );

  if (rewritten !== original) {
    await writeFile(filePath, rewritten);
  }
}

function resolveRelativeSpecifier(filePath, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }
  if (hasExplicitExtension(specifier)) {
    return specifier;
  }

  const base = resolve(dirname(filePath), specifier);
  if (existsSync(`${base}.js`)) {
    return `${specifier}.js`;
  }
  if (isDirectoryWithIndex(base)) {
    return `${specifier}/index.js`;
  }

  return specifier;
}

function hasExplicitExtension(specifier) {
  const lastSegment = specifier.split("/").at(-1) ?? "";
  return /\.[A-Za-z0-9]+$/.test(lastSegment);
}

function isDirectoryWithIndex(path) {
  try {
    return existsSync(path) && existsSync(join(path, "index.js"));
  } catch {
    return false;
  }
}
