import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { prep } from "./prepare-dev.js";

const root = path.resolve(import.meta.dirname, "..");
const dev = path.join(root, ".build", "dev");
const output = path.join(root, "_site");

prep();

console.log("Building site...");

fs.rmSync(output, { recursive: true, force: true });

execSync("bun run build", { cwd: dev, stdio: "inherit" });

execSync(`mv "${path.join(dev, "_site")}" "${output}"`);

console.log("Built to _site/");
