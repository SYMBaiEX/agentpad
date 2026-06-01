import { describe, expect, test } from "bun:test";
import { constants } from "node:fs";
import {
  createLinuxUinputUdevRules,
  diagnoseLinuxUinput,
  formatLinuxUinputDiagnostics,
} from "../diagnostics";

describe("linux uinput diagnostics", () => {
  test("reports non-Linux platforms as unsupported", async () => {
    const diagnostics = await diagnoseLinuxUinput({
      platform: "darwin",
    });

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.supportedPlatform).toBe(false);
    expect(diagnostics.recommendations.join("\n")).toContain("Linux");
  });

  test("detects a writable uinput device", async () => {
    const diagnostics = await diagnoseLinuxUinput({
      platform: "linux",
      devicePaths: ["/dev/uinput"],
      access: async (_path, mode) => {
        if (mode !== constants.W_OK) {
          throw new Error("unexpected mode");
        }
      },
      stat: async () => ({
        mode: 0o20660,
        uid: 0,
        gid: 999,
        isCharacterDevice: () => true,
      }),
      readFile: async () => "uinput 20480 0 - Live 0x00000000\n",
    });

    expect(diagnostics.ok).toBe(true);
    expect(diagnostics.selectedDevicePath).toBe("/dev/uinput");
    expect(diagnostics.moduleLoaded).toBe(true);
    expect(formatLinuxUinputDiagnostics(diagnostics)).toContain("Ready: yes");
  });

  test("recommends module and permission fixes", async () => {
    const diagnostics = await diagnoseLinuxUinput({
      platform: "linux",
      devicePaths: ["/dev/uinput"],
      access: async () => {
        throw new Error("EACCES");
      },
      stat: async () => ({
        mode: 0o20600,
        uid: 0,
        gid: 0,
        isCharacterDevice: () => true,
      }),
      readFile: async () => "",
    });

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.moduleLoaded).toBe(false);
    expect(diagnostics.recommendations.join("\n")).toContain("modprobe");
    expect(diagnostics.recommendations.join("\n")).toContain("Grant write");
  });

  test("provides explicit udev rule templates", () => {
    const rules = createLinuxUinputUdevRules({ group: "input" });

    expect(rules[0]?.rule).toContain('TAG+="uaccess"');
    expect(rules[1]?.rule).toContain('GROUP="input"');
    expect(rules.every((rule) => rule.path.includes("opencontroller"))).toBe(
      true,
    );
  });
});
