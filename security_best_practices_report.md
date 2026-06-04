# OpenController Security And Release Readiness Report

Generated: 2026-06-04

## Executive Summary

No open critical or high severity code findings were found in the current
JavaScript/TypeScript security pass. The repo is publish-ready from a code,
test, and package-content standpoint, but npm publication is blocked by account
setup: the `@opencontroller` npm scope does not exist yet, and the npm account
currently has 2FA disabled.

Release validation passes with `bun run release:check`: lint, TypeScript
project references, 92 tests, build, `bun audit`, and npm package dry-run
validation.

## Fixed Findings

### SBP-001: Raw HTML Rendering In Published Overlay Server

- Severity: Medium
- Location: `packages/overlay/src/server/overlay-server.ts:105`,
  `packages/overlay/src/server/overlay-server.ts:150`,
  `packages/overlay/src/server/overlay-server.ts:293`,
  `packages/overlay/src/server/overlay-server.ts:337`
- Evidence: the overlay server previously embedded raw JSON in a `<script>` and
  rendered dynamic SVG markup through `innerHTML`.
- Impact: if future controller state or theme inputs crossed a trust boundary,
  this could become a DOM/script injection path in the published overlay package.
- Fix: initial state/theme JSON is now script-escaped, and overlay rendering now
  uses SVG DOM APIs plus `replaceChildren`.

### SBP-002: Raw HTML Rendering In Agent Fighter Telemetry Panel

- Severity: Medium
- Location: `examples/agent-fighter/src/controller-panel.js:115`,
  `examples/agent-fighter/src/controller-panel.js:125`,
  `examples/agent-fighter/src/controller-panel.js:192`,
  `examples/agent-fighter/src/controller-panel.js:256`
- Evidence: the panel previously rendered agent model/action/rationale/log text
  with string templates and `innerHTML`.
- Impact: generated agent text is displayed in the browser, so text-node
  rendering is safer than relying on manual escaping.
- Fix: the panel now builds DOM nodes and inserts text through text nodes.

### SBP-003: npm Tarballs Missing License Text And Metadata Enforcement

- Severity: Low
- Location: `scripts/check-npm-packages.mjs:59`,
  `scripts/check-npm-packages.mjs:81`,
  `scripts/check-npm-packages.mjs:119`
- Evidence: workspace tarballs included `README.md` and `package.json`, but not
  package-local `LICENSE` files. The pack check did not enforce homepage or bug
  tracker metadata.
- Impact: package consumers should receive clear license text and GitHub issue
  links directly from npm package pages.
- Fix: each publishable package now includes `LICENSE`, `homepage`, and `bugs`
  metadata; `pack:check` enforces those fields.

### SBP-004: CI Missing Lint And Dependency Audit Gates

- Severity: Low
- Location: `.github/workflows/ci.yml:9`, `.github/workflows/ci.yml:21`,
  `.github/workflows/ci.yml:25`
- Evidence: CI previously ran typecheck, tests, build, and pack checks, but not
  lint or dependency audit.
- Impact: formatting/lint regressions and known vulnerable dependency updates
  could slip past CI.
- Fix: CI now uses read-only default permissions and runs `bun run lint` and
  `bun audit`.

### SBP-005: npm Bin Metadata Would Be Auto-Corrected During Publish

- Severity: Low
- Location: `packages/cli/package.json:17`,
  `packages/native-linux-uinput/package.json:44`,
  `packages/native-windows-virtual-gamepad/package.json:47`,
  `packages/native-macos-driverkit/package.json:42`
- Evidence: npm dry-run publish warned that it would auto-correct bin metadata
  for platform packages.
- Impact: package command entry points should not rely on npm publish-time
  normalization, especially for setup and doctor commands.
- Fix: bin targets are now normalized to npm's package metadata format and all
  package dry-run publishes are warning-free.

## Current Open Release Blockers

### PUB-001: npm Scope Does Not Exist

- Severity: Release blocker
- Evidence: `npm access list packages @opencontroller --json` returns
  `E404 Scope not found`.
- Impact: publishing `@opencontroller/*` packages cannot succeed until the
  `opencontroller` npm organization/scope exists and the publishing account has
  access.
- Fix: create the `opencontroller` npm organization/scope, or rename packages to
  an owned scope such as `@symbaiex/*`.

### PUB-002: npm 2FA Is Disabled

- Severity: Release blocker
- Evidence: `npm profile get --json` returns `"tfa": false`.
- Impact: npm direct publishing currently requires either account 2FA or a
  granular access token that is allowed to publish.
- Fix: enable npm 2FA or create a short-lived granular publish token with the
  required scope/package access.

## Repository Security Settings

- GitHub repository visibility: public.
- GitHub secret scanning: enabled.
- GitHub secret scanning push protection: enabled.
- GitHub private vulnerability reporting: enabled.
- GitHub Dependabot security updates: enabled.

## Verification

- `bun run release:check`: passed.
- `npm publish --workspace packages/core --access public --dry-run --json`:
  passed.
- `npm publish --workspace packages/overlay --access public --dry-run --json`:
  passed.
- `npm publish --workspace packages/cli --access public --dry-run --json`:
  passed.
- `npm publish --workspace packages/native --access public --dry-run --json`:
  passed.
- `npm publish --workspace packages/native-linux-uinput --access public --dry-run --json`:
  passed.
- `npm publish --workspace packages/native-windows-virtual-gamepad --access public --dry-run --json`:
  passed.
- `npm publish --workspace packages/native-macos-driverkit --access public --dry-run --json`:
  passed.
- Consumer install smoke from local tarballs: passed for all publishable
  packages, including `@opencontroller/core`, `@opencontroller/native`,
  `@opencontroller/overlay/server`, and the installed `opencontroller` CLI.
- High-confidence local secret scan: no matches.
- Dangerous frontend sink scan for `packages/` and `examples/`: no remaining
  `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML`,
  `document.write`, `eval`, or `new Function` matches outside built `dist`
  output.
