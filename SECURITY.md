# Security Policy

OpenController is a local-first controller runtime for agents, overlays, demos,
and native bridge prototyping. Security issues matter because controller input,
native helper processes, replay files, and demo agent integrations can cross
trust boundaries.

## Supported Versions

Security updates are handled for the latest released minor version. Before
`1.0.0`, breaking security fixes may ship in any minor or patch release.

## Reporting A Vulnerability

Please do not file public issues with exploit details.

Use GitHub private vulnerability reporting or GitHub Security Advisories for
`SYMBaiEX/OpenController` when available. If private reporting is unavailable,
open a public issue that says a security contact is needed without including
exploit details, secrets, or weaponized proof-of-concept code.

Please include:

- affected package and version
- affected platform and adapter/backend
- reproduction steps with harmless test inputs
- expected impact and any known mitigations

## Security Boundaries

OpenController is designed for local agents, accessibility tooling, testing,
research, emulators, stream overlays, and controlled single-player experiments.
It is not intended for anti-cheat bypasses, stealth automation, credential theft,
or online competitive game automation.

Native setup helpers generate reviewed assets, plans, and local commands. They
must not silently install unsigned drivers, alter system permissions, or perform
privileged changes without explicit user action.

Packages must not publish secrets, local environment files, private keys,
`node_modules`, or test fixtures.
