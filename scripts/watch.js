import fs from "node:fs";
import path from "node:path";

import { sync } from "./prepare-dev.js";

const root = path.resolve(import.meta.dirname, "..");

fs.watch(root, { recursive: true }, (_event, file) => {
  if (
    file &&
    (file.endsWith(".md") || file.endsWith(".scss") || file.endsWith(".json"))
  ) {
    if (
      !file.startsWith(".build") &&
      !file.startsWith("node_modules") &&
      !file.startsWith(".git")
    ) {
      sync();
    }
  }
});
