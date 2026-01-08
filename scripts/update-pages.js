import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMPLATE_REPO = "https://github.com/chobbledotcom/chobble-template.git";
const TEMPLATE_RAW_URL =
  "https://raw.githubusercontent.com/chobbledotcom/chobble-template/refs/heads/main/.pages.yml";

function fetchPages() {
  console.log("Fetching .pages.yml from chobble-template...");
  const result = spawnSync("curl", ["-sL", TEMPLATE_RAW_URL], {
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to fetch .pages.yml: ${result.stderr}`);
  }

  const updated = result.stdout.replace(/src\//g, "");
  fs.writeFileSync(".pages.yml", updated);
  console.log("Updated .pages.yml from chobble-template (with src/ removed)");
}

async function customisePages() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chobble-template-"));

  console.log("Cloning chobble-template...");
  const cloneResult = spawnSync("git", ["clone", "--depth", "1", TEMPLATE_REPO, tempDir], {
    stdio: "inherit",
  });

  if (cloneResult.status !== 0) {
    throw new Error("Failed to clone chobble-template");
  }

  console.log("Installing dependencies...");
  const installResult = spawnSync("bun", ["install"], {
    cwd: tempDir,
    stdio: "inherit",
  });

  if (installResult.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error("Failed to install dependencies");
  }

  console.log("\nStarting CMS customisation TUI...\n");

  await new Promise((resolve, reject) => {
    const proc = spawn("bun", ["run", "customise-cms"], {
      cwd: tempDir,
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`customise-cms exited with code ${code}`));
      }
    });

    proc.on("error", reject);
  });

  const pagesPath = path.join(tempDir, "src", ".pages.yml");
  if (!fs.existsSync(pagesPath)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error("No .pages.yml found after customisation");
  }

  const content = fs.readFileSync(pagesPath, "utf-8");
  const updated = content.replace(/src\//g, "");
  fs.writeFileSync(".pages.yml", updated);

  console.log("\nCleaning up...");
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("Updated .pages.yml with your customisations (with src/ removed)");
}

async function updatePages(options = {}) {
  const { customise = false } = options;

  if (customise) {
    await customisePages();
  } else {
    fetchPages();
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const customise = args.includes("--customise") || args.includes("-c");

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun run update-pages [options]

Options:
  --customise, -c  Run the interactive CMS customisation TUI
  --help, -h       Show this help message

Without options, fetches the latest .pages.yml from chobble-template.
With --customise, clones chobble-template and runs the customise-cms TUI
to let you select which collections to include.`);
    process.exit(0);
  }

  updatePages({ customise }).catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}

export { updatePages, fetchPages, customisePages };
