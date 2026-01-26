import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rsync, fs } from "./utils.js";

describe("rsync", () => {
  let srcDir;
  let destDir;

  beforeEach(() => {
    srcDir = mkdtempSync(join(tmpdir(), "rsync-test-src-"));
    destDir = mkdtempSync(join(tmpdir(), "rsync-test-dest-"));
  });

  test("syncs all files by default", () => {
    writeFileSync(join(srcDir, "test.md"), "markdown");
    writeFileSync(join(srcDir, "test.scss"), "scss");
    writeFileSync(join(srcDir, "test.json"), "json");

    rsync(srcDir, destDir, {});

    expect(existsSync(join(destDir, "test.md"))).toBe(true);
    expect(existsSync(join(destDir, "test.scss"))).toBe(true);
    expect(existsSync(join(destDir, "test.json"))).toBe(true);
  });

  test("excludes files matching exclude patterns", () => {
    writeFileSync(join(srcDir, "test.md"), "markdown");
    writeFileSync(join(srcDir, "test.json"), "json");

    rsync(srcDir, destDir, { exclude: ["*.json"] });

    expect(existsSync(join(destDir, "test.md"))).toBe(true);
    expect(existsSync(join(destDir, "test.json"))).toBe(false);
  });

  test("include patterns filter to only matching files", () => {
    writeFileSync(join(srcDir, "test.md"), "markdown");
    writeFileSync(join(srcDir, "test.scss"), "scss");
    writeFileSync(join(srcDir, "test.json"), "json");
    writeFileSync(join(srcDir, "test.txt"), "text");

    rsync(srcDir, destDir, { include: ["*/", "**/*.md", "**/*.scss"] });

    expect(existsSync(join(destDir, "test.md"))).toBe(true);
    expect(existsSync(join(destDir, "test.scss"))).toBe(true);
    expect(existsSync(join(destDir, "test.json"))).toBe(false);
    expect(existsSync(join(destDir, "test.txt"))).toBe(false);
  });

  test("include patterns work with subdirectories", () => {
    mkdirSync(join(srcDir, "css"), { recursive: true });
    mkdirSync(join(srcDir, "data"), { recursive: true });
    writeFileSync(join(srcDir, "css", "theme.scss"), "scss");
    writeFileSync(join(srcDir, "data", "config.json"), "json");
    writeFileSync(join(srcDir, "README.md"), "markdown");

    rsync(srcDir, destDir, { include: ["*/", "**/*.md", "**/*.scss"] });

    expect(existsSync(join(destDir, "README.md"))).toBe(true);
    expect(existsSync(join(destDir, "css", "theme.scss"))).toBe(true);
    expect(existsSync(join(destDir, "data", "config.json"))).toBe(false);
  });

  test("update flag only syncs newer files", () => {
    writeFileSync(join(srcDir, "test.md"), "original");
    rsync(srcDir, destDir, {});

    // Make dest file newer
    const futureTime = Date.now() / 1000 + 10;
    writeFileSync(join(destDir, "test.md"), "modified in dest");
    const { utimesSync } = require("node:fs");
    utimesSync(join(destDir, "test.md"), futureTime, futureTime);

    // Update source
    writeFileSync(join(srcDir, "test.md"), "updated in src");

    // Rsync with update should NOT overwrite newer dest file
    rsync(srcDir, destDir, { update: true });

    const destContent = require("node:fs").readFileSync(join(destDir, "test.md"), "utf-8");
    expect(destContent).toBe("modified in dest");
  });

  test("incremental sync only copies changed files matching includes", () => {
    // Setup initial state
    mkdirSync(join(srcDir, "css"), { recursive: true });
    mkdirSync(join(srcDir, "data"), { recursive: true });
    writeFileSync(join(srcDir, "css", "theme.scss"), "original scss");
    writeFileSync(join(srcDir, "data", "config.json"), "original json");
    writeFileSync(join(srcDir, "page.md"), "original md");

    // Initial sync with includes
    rsync(srcDir, destDir, { include: ["*/", "**/*.md", "**/*.scss"] });

    // Verify initial state
    expect(existsSync(join(destDir, "css", "theme.scss"))).toBe(true);
    expect(existsSync(join(destDir, "page.md"))).toBe(true);
    expect(existsSync(join(destDir, "data", "config.json"))).toBe(false);

    // Wait a bit and modify files
    const srcScssPath = join(srcDir, "css", "theme.scss");
    const srcJsonPath = join(srcDir, "data", "config.json");
    writeFileSync(srcScssPath, "updated scss");
    writeFileSync(srcJsonPath, "updated json");

    // Force newer mtime on source files
    const futureTime = Date.now() / 1000 + 10;
    const { utimesSync } = require("node:fs");
    utimesSync(srcScssPath, futureTime, futureTime);
    utimesSync(srcJsonPath, futureTime, futureTime);

    // Sync with update flag (incremental)
    rsync(srcDir, destDir, { update: true, include: ["*/", "**/*.md", "**/*.scss"] });

    // SCSS should be updated, JSON should still not exist
    const destScssContent = require("node:fs").readFileSync(join(destDir, "css", "theme.scss"), "utf-8");
    expect(destScssContent).toBe("updated scss");
    expect(existsSync(join(destDir, "data", "config.json"))).toBe(false);
  });
});
