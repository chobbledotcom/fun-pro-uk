import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildProtectedAssetLink,
  buildProtectedDocumentsHtml,
  configureProtectedPages,
  createAssetEncryptionHook,
  createProtectedTransform,
  isInlineMimeType,
  mimeTypeForAsset,
  resolvePagePassword,
  writeEncryptedAssets,
} from "#eleventy/protected-pages.js";
import {
  PROTECTED_TEST_ITERATIONS,
  PROTECTED_TEST_LABELS,
  PROTECTED_TEST_SALT,
} from "#test/protected-pages-fixtures.js";
import {
  createMockEleventyConfig,
  createTempDir,
  expectAsyncThrows,
  withTempDirAsync,
  wrapHtml,
} from "#test/test-utils.js";
import { decryptPayload, parsePayload } from "#utils/protected-crypto.js";

const SALT = PROTECTED_TEST_SALT;
const ITERATIONS = PROTECTED_TEST_ITERATIONS;
const LABELS = PROTECTED_TEST_LABELS;

/**
 * Set environment variables for the duration of `run` (sync or async),
 * restoring the previous values afterwards. Always returns a promise; sync
 * callers are wrapped by the tests that consume the returned value.
 */
const withEnv = async (values, run) => {
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
  try {
    return await outcome;
  } finally {
    restore();
  }
};

const writePage = (dir, frontMatter) => {
  const filePath = path.join(dir, "rams.md");
  writeFileSync(filePath, `---\n${frontMatter}\n---\n\n# Body\n`);
  return filePath;
};

/** Create the src/protected-assets-like in/out folders used by asset tests. */
const setupAssetDirs = (tempDir) => {
  const assetsDir = path.join(tempDir, "in");
  const outputDir = path.join(tempDir, "out");
  mkdirSync(assetsDir);
  mkdirSync(outputDir);
  return { assetsDir, outputDir };
};

const runProtectedTransform = (inputPath, content, env = {}) =>
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
    test("reads the default environment variable", async () => {
      const password = await withEnv(
        { PROTECTED_PAGES_PASSWORD: "s3cret" },
        () => resolvePagePassword(undefined, "page"),
      );
      expect(password).toBe("s3cret");
    });

    test("normalises the environment password (trimmed, lowercased)", async () => {
      const password = await withEnv(
        { PROTECTED_PAGES_PASSWORD: "  FuNPro_Docs  " },
        () => resolvePagePassword(undefined, "page"),
      );
      expect(password).toBe("funpro_docs");
    });

    test("prefers the passwordEnv front matter override", async () => {
      const password = await withEnv({ RAMS_PASSWORD: "rams s3cret" }, () =>
        resolvePagePassword("RAMS_PASSWORD", "page"),
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
        const result = await runProtectedTransform(inputPath, content, {
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
        const result = await runProtectedTransform(inputPath, content, {
          PROTECTED_PAGES_PASSWORD: "s3cret",
        });

        expect(result).not.toContain("Confidential");
        expect(result).toContain("data-protected-gate");
        expect(result).toContain("data-protected-payload");
        expect(result).toContain("noindex");
      });
    });

    test("renders protected_intro front matter on the gate", async () => {
      await withTempDirAsync("protected-intro", async (dir) => {
        const inputPath = writePage(
          dir,
          'protected: true\nprotected_intro: "Enter the password we sent you"',
        );
        const result = await runProtectedTransform(
          inputPath,
          wrapHtml('<article id="content"><p>Confidential</p></article>'),
          { PROTECTED_PAGES_PASSWORD: "s3cret" },
        );

        expect(result).toContain("Enter the password we sent you");
        expect(result).toContain("protected-intro");
        expect(result).not.toContain("Confidential");
      });
    });

    test("fails fast when the page-specific password env is missing", async () => {
      await withTempDirAsync("protected-override", async (dir) => {
        const inputPath = writePage(
          dir,
          'protected: true\npasswordEnv: "RAMS_PASSWORD"',
        );
        const attempt = () =>
          runProtectedTransform(
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

    test("accepts subdirectory paths, downloading the base file name", () => {
      const link = buildProtectedAssetLink("Air Hockey/notes.docx");
      expect(link).toContain('data-protected-asset="Air Hockey/notes.docx"');
      expect(link).toContain('download="notes.docx"');
      expect(link).toContain(">notes.docx</a>");
    });

    test("rejects path traversal and absolute or hidden paths", () => {
      const attempts = [
        () => buildProtectedAssetLink("../secrets.pdf"),
        () => buildProtectedAssetLink("/protected-assets/rams.pdf"),
        () => buildProtectedAssetLink("dir/../../secrets.pdf"),
        () => buildProtectedAssetLink("a\\b.pdf"),
        () => buildProtectedAssetLink(".hidden.pdf"),
        () => buildProtectedAssetLink("Air Hockey//pat.pdf"),
        () => buildProtectedAssetLink("Air Hockey/"),
      ];
      for (const attempt of attempts) {
        expect(attempt).toThrow(/file path relative/);
      }
    });
  });

  describe("buildProtectedDocumentsHtml", () => {
    test("renders legacy string entries as a flat download list", () => {
      const html = buildProtectedDocumentsHtml([
        "demo.jpg",
        "/protected-assets/2026-air-hockey-risk-assessment.pdf",
      ]);

      expect(html).toContain('<div class="protected-documents">');
      expect(html).not.toContain("<h3>");
      expect(html).toContain('data-protected-asset="demo.jpg"');
      expect(html).toContain(
        'data-protected-asset="2026-air-hockey-risk-assessment.pdf"',
      );
      expect(html).toContain(">demo.jpg</a>");
    });

    test("keeps CMS subdirectory paths in the generated links", () => {
      const html = buildProtectedDocumentsHtml([
        {
          file: "/protected-assets/Air Hockey/2026-air-hockey-pat.pdf",
          title: "Air Hockey - PAT",
          section: "Air hockey",
        },
      ]);

      expect(html).toContain(
        'data-protected-asset="Air Hockey/2026-air-hockey-pat.pdf"',
      );
      expect(html).toContain(">Air Hockey - PAT</a>");
    });

    test("shows titles as link text and groups shared sections", () => {
      const html = buildProtectedDocumentsHtml([
        {
          file: "/protected-assets/air-hockey-risk-assessment.pdf",
          title: "Risk assessment",
          section: "Air hockey",
        },
        {
          file: "/protected-assets/air-hockey-pat.pdf",
          title: "PAT testing certificate",
          section: "Air hockey",
        },
        { file: "insurance.pdf", title: "Insurance certificate" },
      ]);

      expect(html.match(/<h3>/g)).toEqual(["<h3>"]);
      expect(html).toContain("<h3>Air hockey</h3>");
      expect(html).toContain(">Risk assessment</a>");
      expect(html).toContain(">PAT testing certificate</a>");
      expect(html).not.toContain("air-hockey-risk-assessment.pdf</a>");
      expect(html).toContain(">Insurance certificate</a>");
      expect(html.indexOf("Air hockey")).toBeLessThan(
        html.indexOf("Insurance certificate"),
      );
    });

    test("escapes section headings and titles", () => {
      const html = buildProtectedDocumentsHtml([
        { file: "a.pdf", title: "<b>&file</b>", section: "<i>Game</i>" },
      ]);
      expect(html).toContain("<h3>&lt;i&gt;Game&lt;/i&gt;</h3>");
      expect(html).toContain("&lt;b&gt;&amp;file&lt;/b&gt;");
    });

    test("rejects entries without a usable file", () => {
      const attempts = [
        () => buildProtectedDocumentsHtml([{ title: "No file" }]),
        () => buildProtectedDocumentsHtml([{ file: 7, title: "x" }]),
        () => buildProtectedDocumentsHtml([{ file: ".hidden.pdf" }]),
        () => buildProtectedDocumentsHtml([{ file: "a\\b.pdf" }]),
      ];
      for (const attempt of attempts) {
        expect(attempt).toThrow();
      }
    });

    test("skips blank entries left behind by the CMS", () => {
      const html = buildProtectedDocumentsHtml([
        {},
        { file: "" },
        { file: "  " },
        "",
        "  ",
        { file: "a.pdf", title: "Download" },
      ]);
      expect(html.match(/<li>/g)).toEqual(["<li>"]);
      expect(html).toContain('data-protected-asset="a.pdf"');
    });

    test("renders nothing when every entry is blank", () => {
      expect(buildProtectedDocumentsHtml([{}, "", { file: null }])).toBe("");
    });

    test("rejects non-string titles and sections", () => {
      expect(() =>
        buildProtectedDocumentsHtml([{ file: "a.pdf", title: 7 }]),
      ).toThrow(/"title" must be text/);
      expect(() =>
        buildProtectedDocumentsHtml([{ file: "a.pdf", section: true }]),
      ).toThrow(/"section" must be text/);
    });

    test("rejects input that is not a non-empty list", () => {
      expect(() => buildProtectedDocumentsHtml("demo.jpg")).toThrow(
        /protectedDocuments/,
      );
      expect(() => buildProtectedDocumentsHtml([])).toThrow(
        /protectedDocuments/,
      );
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
        const { assetsDir, outputDir } = setupAssetDirs(tempDir);
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
            const { assetsDir, outputDir } = setupAssetDirs(tempDir);
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
            const decrypted = await decryptPayload(payload, "asset password");
            expect(Array.from(decrypted)).toEqual(Array.from(original));
          });
        },
      );
    });

    test("fails fast when the asset password environment variable is missing", async () => {
      await withTempDirAsync("assets-noenv", async (tempDir) => {
        const { assetsDir, outputDir } = setupAssetDirs(tempDir);
        writeFileSync(path.join(assetsDir, "rams.pdf"), "bytes");
        delete process.env.PROTECTED_PAGES_PASSWORD;

        const error = await expectAsyncThrows(() =>
          writeEncryptedAssets({
            assetsDir,
            outputDir,
            salt: SALT,
            iterations: ITERATIONS,
          }),
        );
        expect(error.message).toMatch(/PROTECTED_PAGES_PASSWORD/);
      });
    });

    test("mirrors subdirectories into nested .enc paths", async () => {
      await withEnv({ PROTECTED_PAGES_PASSWORD: "pw" }, async () => {
        await withTempDirAsync("assets-subdir", async (tempDir) => {
          const { assetsDir, outputDir } = setupAssetDirs(tempDir);
          const original = new TextEncoder().encode("Air hockey PAT bytes");
          mkdirSync(path.join(assetsDir, "Air Hockey"));
          mkdirSync(path.join(assetsDir, "Air Hockey", "2026"));
          writeFileSync(
            path.join(assetsDir, "Air Hockey", "2026", "pat.pdf"),
            original,
          );

          const count = await writeEncryptedAssets({
            assetsDir,
            outputDir,
            salt: SALT,
            iterations: ITERATIONS,
          });
          expect(count).toBe(1);

          const payload = parsePayload(
            readFileSync(
              path.join(outputDir, "Air Hockey", "2026", "pat.pdf.enc"),
              "utf8",
            ),
          );
          const decrypted = await decryptPayload(payload, "pw");
          expect(Array.from(decrypted)).toEqual(Array.from(original));
        });
      });
    });

    test("distinguishes same-named files in different subdirectories", async () => {
      await withEnv({ PROTECTED_PAGES_PASSWORD: "pw" }, async () => {
        await withTempDirAsync("assets-collision", async (tempDir) => {
          const { assetsDir, outputDir } = setupAssetDirs(tempDir);
          mkdirSync(path.join(assetsDir, "Assault Course"));
          mkdirSync(path.join(assetsDir, "Axe Throwing"));
          const assault = new TextEncoder().encode("assault course blowers");
          const axe = new TextEncoder().encode("axe throwing blowers");
          writeFileSync(
            path.join(assetsDir, "Assault Course", "2026-blowers-pat.pdf"),
            assault,
          );
          writeFileSync(
            path.join(assetsDir, "Axe Throwing", "2026-blowers-pat.pdf"),
            axe,
          );

          const count = await writeEncryptedAssets({
            assetsDir,
            outputDir,
            salt: SALT,
            iterations: ITERATIONS,
          });
          expect(count).toBe(2);

          const decryptFile = async (relativePath) =>
            Array.from(
              await decryptPayload(
                parsePayload(
                  readFileSync(path.join(outputDir, relativePath), "utf8"),
                ),
                "pw",
              ),
            );
          expect(
            await decryptFile(
              path.join("Assault Course", "2026-blowers-pat.pdf.enc"),
            ),
          ).toEqual(Array.from(assault));
          expect(
            await decryptFile(
              path.join("Axe Throwing", "2026-blowers-pat.pdf.enc"),
            ),
          ).toEqual(Array.from(axe));
        });
      });
    });
  });

  describe("configureProtectedPages", () => {
    test("registers the transform, shortcode and post-build encryption", async () => {
      const mockConfig = createMockEleventyConfig();
      configureProtectedPages(mockConfig);

      expect(Object.keys(mockConfig.transforms)).toContain("protectedPages");
      expect(Object.keys(mockConfig.shortcodes)).toContain("protectedAsset");
      expect(Object.keys(mockConfig.shortcodes)).toContain(
        "protectedDocuments",
      );

      const documents = mockConfig.shortcodes.protectedDocuments([
        { file: "rams.pdf", title: "Download RAMS", section: "Safety" },
      ]);
      expect(documents).toContain("<h3>Safety</h3>");
      expect(documents).toContain(">Download RAMS</a>");
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
