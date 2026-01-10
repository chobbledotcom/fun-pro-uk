import { spawn } from "node:child_process";
import path from "node:path";

import { prep } from "./prepare-dev.js";

const dev = path.join(import.meta.dirname, "..", ".build", "dev");

prep();

console.log("Starting server...");

const watch = spawn("bun", [path.join(import.meta.dirname, "watch.js")], {
  stdio: "inherit",
});

const eleventy = spawn(
  "bun",
  ["./node_modules/@11ty/eleventy/cmd.cjs", "--serve", "--incremental"],
  {
    cwd: dev,
    stdio: "inherit",
  },
);

process.on("SIGINT", () => {
  console.log("\nStopping...");
  watch.kill();
  eleventy.kill();
  process.exit();
});
