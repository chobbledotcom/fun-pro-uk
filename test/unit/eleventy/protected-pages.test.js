import { describe, expect, test } from "bun:test";
import { webcrypto } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildProtectedAssetLink,
  configureProtectedPages,
  createAssetEncryptionHook,
  createProtectedTransform,
  isInlineMimeType,
  mimeTypeForAsset,
  resolvePagePassword,
  writeEncryptedAssets,
} from "#eleventy/protected-pages.js";
import {
  createMockEleventyConfig,
  createTempDir,
  expectAsyncThrows,
  withTempDirAsync,
  wrapHtml,
} from "#test/test-utils.js";
import {
  decryptWithKey,
  deriveAesGcmKey,
  getRandomBytes,
  parsePayload,
} from "#utils/protected-crypto.js";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

const SALT = getRandomBytes(16);
const ITERATIONS = 1000;
const LABELS = {
  heading: "Staff area",
  label: "Password",
  submit: "Open",
  loading: "Opening…",
  error: "Wrong password",
};

/**
 * Set environment variables for the duration of `run` (sync or async),
 * restoring the previous values afterwards without try/catch.
 */
const withEnv = (values, run) => {
  const keys = Object.keys(values);
  const previous = keys.map((key) => process.env[key]);
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
  const restore = () => {
    for (const [index, key] of keys.entries()) {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }
  };
  const outcome = run();
  if (!(outcome instanceof Promise)) {
    restore();
    return outcome;
  }
  return outcome.then(
    (value) => {
      restore();
      return value;
    },
    (error) => {
      restore();
      throw error;
    },
  );
};

const writePage = (dir, frontMatter) => {
  const filePath = path.join(dir, "rams.md");
  writeFileSync(filePath, `---\n${frontMatter}\n---\n\n# Body\n`);
  return filePath;
};

const runTransform = (inputPath, content, env = {}) =>
  withEnv(env, async () => {
    const transform = createProtectedTransform({
      salt: SALT,
      iterations: ITERATIONS,
      labels: LABELS,
    });
    return transform.call({ inputPath }, content, "/rams/index.html");
  });

describe("protected-pages", () => {
  describe("resolvePagePassword", () => {
    test("reads the default environment variable", () => {
      const password = withEnv(
        { PROTECTED_PAGES_PASSWORD: "s3cret" },
        () => resolvePagePassword(undefined, "page"),
      );
      expect(password).toBe("s3cret");
    });

    test("prefers the passwordEnv front matter override", () => {
      const password = withEnv(
        { RAMS_PASSWORD: "rams s3cret" },
        () => resolvePagePassword("RAMS_PASSWORD", "page"),
      );
      expect(password).toBe("rams s3cret");
    });

    test("fails fast when no password environment variable is set", () => {
      const missing = () => {
        delete process.env.PROTECTED_PAGES_PASSWORD;
        return resolvePagePassword(undefined, "src/pages/rams.md");
      };
      expect(missing).toThrow(/PROTECTED_PAGES_PASSWORD/);
      expect(missing).toThrow(/src\/pages\/rams\.md/);
    });

    test("rejects a non-string passwordEnv front matter value", () => {
      expect(() => resolvePagePassword(123, "page")).toThrow(/passwordEnv/);
    });
  });

  describe("createProtectedTransform", () => {
    test("leaves pages without protected front matter untouched", async () => {
      await withTempDirAsync("protected-unneeded", async (dir) => {
        const inputPath = writePage(dir, 'title: "About"');
        const content = wrapHtml(
          '<article id="content"><p>Plain page</p></article>',
        );
        const result = await runTransform(inputPath, content, {
          PROTECTED_PAGES_PASSWORD: "s3cret",
        });
        expect(result).toBe(content);
      });
    });

    test("encrypts protected page content and hides the plaintext", async () => {
      await withTempDirAsync("protected-encrypts", async (dir) => {
        const inputPath = writePage(dir, "protected: true");
        const content = wrapHtml(
          '<article id="content"><h1>Site RAMS</h1><p>Confidential</p></article>',
        );
        const result = await runTransform(inputPath, content, {
          PROTECTED_PAGES_PASSWORD: "s3cret",
        });

        expect(result).not.toContain("Confidential");
        expect(result).toContain("data-protected-gate");
        expect(result).toContain("data-protected-payload");
        expect(result).toContain("noindex");
      });
    });

    test("fails fast when the page-specific password env is missing", async () => {
      await withTempDirAsync("protected-override", async (dir) => {
        const inputPath = writePage(
          dir,
          'protected: true\npasswordEnv: "RAMS_PASSWORD"',
        );
        const attempt = () =>
          runTransform(
            inputPath,
            wrapHtml('<article id="content"><p>x</p></article>'),
            { PROTECTED_PAGES_PASSWORD: "default" },
          );
        const error = await expectAsyncThrows(attempt);
        expect(error.message).toMatch(/RAMS_PASSWORD/);
      });
    });

    test("skips non-HTML output without reading front matter", async () => {
      const transform = createProtectedTransform({
        salt: SALT,
        iterations: ITERATIONS,
        labels: LABELS,
      });
      const result = await transform.call(
        { inputPath: "/nonexistent/file.md" },
        "body { color: red; }",
        "/assets/css/style.css",
      );
      expect(result).toBe("body { color: red; }");
    });
  });

  describe("mimeTypeForAsset", () => {
    test("maps known extensions and falls back to octet-stream", () => {
      expect(mimeTypeForAsset("rams.pdf")).toBe("application/pdf");
      expect(mimeTypeForAsset("PHOTO.JPG")).toBe("image/jpeg");
      expect(mimeTypeForAsset("unknown.xyz")).toBe("application/octet-stream");
      expect(mimeTypeForAsset("noext")).toBe("application/octet-stream");
    });

    test("classifies inline-viewable types", () => {
      expect(isInlineMimeType("application/pdf")).toBe(true);
      expect(isInlineMimeType("image/png")).toBe(true);
      expect(isInlineMimeType("application/zip")).toBe(false);
    });
  });

  describe("buildProtectedAssetLink", () => {
    test("renders a stub link carrying name and mime type", () => {
      const link = buildProtectedAssetLink("rams.pdf", "Download our RAMS");
      expect(link).toContain('data-protected-asset="rams.pdf"');
      expect(link).toContain('data-protected-mime="application/pdf"');
      expect(link).toContain(">Download our RAMS</a>");
      expect(link).not.toContain("download=");
    });

    test("offers non-viewable files as downloads", () => {
      const link = buildProtectedAssetLink("notes.docx");
      expect(link).toContain(
        'data-protected-mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"',
      );
      expect(link).toContain('download="notes.docx"');
      expect(link).toContain(">notes.docx</a>");
    });

    test("escapes the file name and label", () => {
      const link = buildProtectedAssetLink("file.pdf", '<b>&"label</b>');
      expect(link).toContain("&lt;b&gt;&amp;&quot;label&lt;/b&gt;");
    });

    test("rejects empty names", () => {
      expect(() => buildProtectedAssetLink("")).toThrow(/protectedAsset/);
    });

    test("rejects path traversal and directories", () => {
      const attempts = [
        () => buildProtectedAssetLink("../secrets.pdf"),
        () => buildProtectedAssetLink("dir/file.pdf"),
        () => buildProtectedAssetLink("a\\b.pdf"),
        () => buildProtectedAssetLink(".hidden.pdf"),
      ];
      for (const attempt of attempts) {
        expect(attempt).toThrow(/plain file name/);
      }
    });
  });

  describe("writeEncryptedAssets", () => {
    test("is a no-op when the assets directory does not exist", async () => {
      const count = await writeEncryptedAssets({
        assetsDir: path.join(createTempDir("asset-noop"), "absent"),
        outputDir: createTempDir("asset-noop-out"),
        salt: SALT,
        iterations: ITERATIONS,
      });
      expect(count).toBe(0);
    });

    test("skips dotfiles like .gitkeep without needing a password", async () => {
      await withTempDirAsync("asset-dotfiles", async (tempDir) => {
        const assetsDir = path.join(tempDir, "in");
        const outputDir = path.join(tempDir, "out");
        mkdirSync(assetsDir);
        mkdirSync(outputDir);
        writeFileSync(path.join(assetsDir, ".gitkeep"), "");

        const count = await writeEncryptedAssets({
          assetsDir,
          outputDir,
          salt: SALT,
          iterations: ITERATIONS,
        });
        expect(count).toBe(0);
        expect(existsSync(path.join(outputDir, ".gitkeep.enc"))).toBe(false);
      });
    });

    test("encrypts each asset into a decryptable .enc payload", async () => {
      await withEnv(
        { PROTECTED_PAGES_PASSWORD: "asset password" },
        async () => {
          await withTempDirAsync("assets-encrypt", async (tempDir) => {
            const assetsDir = path.join(tempDir, "in");
            const outputDir = path.join(tempDir, "out");
            mkdirSync(assetsDir);
            mkdirSync(outputDir);
            const original = new TextEncoder().encode("RAMS document bytes");
            writeFileSync(path.join(assetsDir, "rams.pdf"), original);

            const count = await writeEncryptedAssets({
              assetsDir,
              outputDir,
              salt: SALT,
              iterations: ITERATIONS,
            });
            expect(count).toBe(1);

            const payload = parsePayload(
              readFileSync(path.join(outputDir, "rams.pdf.enc"), "utf8"),
            );
            const key = await deriveAesGcmKey(
              "asset password",
              payload.salt,
              payload.iterations,
            );
            const decrypted = await decryptWithKey(key, payload.iv, payload.ct);
            expect(Array.from(decrypted)).toEqual(Array.from(original));
          });
        },
      );
    });

    test("fails fast when the asset password environment variable is missing", async () => {
      await withTempDirAsync("assets-noenv", async (tempDir) => {
        const assetsDir = path.join(tempDir, "in");
        mkdirSync(assetsDir);
        writeFileSync(path.join(assetsDir, "rams.pdf"), "bytes");
        delete process.env.PROTECTED_PAGES_PASSWORD;

        const error = await expectAsyncThrows(() =>
          writeEncryptedAssets({
            assetsDir,
            outputDir: path.join(tempDir, "out"),
            salt: SALT,
            iterations: ITERATIONS,
          }),
        );
        expect(error.message).toMatch(/PROTECTED_PAGES_PASSWORD/);
      });
    });

    test("rejects subdirectories in the assets folder", async () => {
      await withEnv(
        { PROTECTED_PAGES_PASSWORD: "pw" },
        async () => {
          await withTempDirAsync("assets-subdir", async (tempDir) => {
            const assetsDir = path.join(tempDir, "in");
            mkdirSync(path.join(assetsDir, "nested"));

            const error = await expectAsyncThrows(() =>
              writeEncryptedAssets({
                assetsDir,
                outputDir: path.join(tempDir, "out"),
                salt: SALT,
                iterations: ITERATIONS,
              }),
            );
            expect(error.message).toMatch(/subdirectories/);
          });
        },
      );
    });
  });

  describe("configureProtectedPages", () => {
    test("registers the transform, shortcode and post-build encryption", async () => {
      const mockConfig = createMockEleventyConfig();
      configureProtectedPages(mockConfig);

      expect(Object.keys(mockConfig.transforms)).toContain("protectedPages");
      expect(Object.keys(mockConfig.shortcodes)).toContain("protectedAsset");
      expect(typeof mockConfig.eventHandlers["eleventy.after"]).toBe(
        "function",
      );

      const link = mockConfig.shortcodes.protectedAsset(
        "rams.pdf",
        "Download RAMS",
      );
      expect(link).toContain('data-protected-asset="rams.pdf"');
    });

    test("post-build hook is a no-op without an assets folder", async () => {
      const hook = createAssetEncryptionHook({
        assetsDir: path.join(createTempDir("hook-noop"), "absent"),
        outputDir: path.join(createTempDir("hook-noop"), "out"),
        salt: SALT,
        iterations: ITERATIONS,
      });
      expect(await hook()).toBe(0);
    });
  });
});
