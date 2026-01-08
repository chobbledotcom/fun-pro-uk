import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildDir } from "./consts.js";
import { prep } from "./prepare-dev.js";

const root = path.resolve(import.meta.dirname, "..");
const build = path.join(root, buildDir);
const template = path.join(build, "template");
const dev = path.join(build, "dev");

prep();

// Copy test directory from template (excluded by default in prep)
const templateTestDir = path.join(template, "test");
const devTestDir = path.join(dev, "test");

if (fs.existsSync(templateTestDir)) {
  console.log("Copying test directory...");
  fs.rmSync(devTestDir, { recursive: true, force: true });
  execSync(`cp -r "${templateTestDir}" "${devTestDir}"`);
}

console.log("Running tests...");

// Run the template's test suite in the dev directory
execSync("bun test", { cwd: dev, stdio: "inherit" });
