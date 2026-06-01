#!/usr/bin/env bun
import { buildLinuxUinputHelper } from "../linux-uinput";

const outputFlagIndex = process.argv.indexOf("--output");
const outputPath =
  outputFlagIndex >= 0 ? process.argv[outputFlagIndex + 1] : undefined;

buildLinuxUinputHelper(outputPath ? { outputPath } : {})
  .then((path) => {
    console.log(path);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
