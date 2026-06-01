#!/usr/bin/env bun
import {
  diagnoseLinuxUinput,
  formatLinuxUinputDiagnostics,
} from "../diagnostics";

const json = process.argv.includes("--json");
const check = process.argv.includes("--check");

diagnoseLinuxUinput()
  .then((diagnostics) => {
    if (json) {
      console.log(JSON.stringify(diagnostics, null, 2));
    } else {
      console.log(formatLinuxUinputDiagnostics(diagnostics));
    }

    if (check && !diagnostics.ok) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
