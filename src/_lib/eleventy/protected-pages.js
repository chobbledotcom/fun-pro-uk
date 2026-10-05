/**
 * Password protection for pages and document assets.
 *
 * CONTENT PAGES: add `protected: true` (and optionally
 * `passwordEnv: "OTHER_SECRET"`) to a page's front matter. During the build
 * the rendered <article id="content"> markup is encrypted with AES-GCM using
 * a password from a build-time environment variable (e.g. a GitHub Actions
 * repository secret). Visitors type the password in the browser; the page is
 * then decrypted locally with the Web Crypto API, so the plaintext content
 * never exists on the web server.
 *
 * DOCUMENT ASSETS: files placed in src/protected-assets/ (PDFs,
 * spreadsheets, ...) are encrypted to _site/protected-assets/<name>.enc at
 * the end of the build, so the original files are never uploaded. Reference
 * them from a protected page with
 * `{% protectedAsset "rams.pdf", "Download our RAMS (PDF)" %}`; the browser
 * decrypts the linked file with the password that unlocked the page.
 *
 * The password must be provided at build time, e.g.
 * `PROTECTED_PAGES_PASSWORD: ${{ secrets.PROTECTED_PAGES_PASSWORD }}` in the
 * deploy workflow, and is intentionally never written to any file in _site.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import strings from "#data/strings.js";
import { compact } from "#toolkit/fp/array.js";
import { groupBy } from "#toolkit/fp/grouping.js";
import { frozenSet } from "#toolkit/fp/set.js";
import { injectGate, readGateStrings } from "#transforms/protect-content.js";
import { loadDOM } from "#utils/lazy-dom.js";
import {
  deriveKeyCached,
  encodePayload,
  encryptWithKey,
  getRandomBytes,
  normalizePassword,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
} from "#utils/protected-crypto.js";

const DEFAULT_PASSWORD_ENV = "PROTECTED_PAGES_PASSWORD";
const PROTECTED_ASSETS_DIR = "protected-assets";

/** Extension → MIME type for documents decrypted in the browser. */
const ASSET_MIME_TYPES = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};
const DEFAULT_MIME_TYPE = "application/octet-stream";

/** MIME types the browser can display inline; the rest are offered as downloads. */
const INLINE_MIME_TYPES = frozenSet([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

/**
 * Resolve the build-time password for a protected page or asset.
 * @param {unknown} passwordEnv - Front matter `passwordEnv` value (optional)
 * @param {string} sourceDescription - Page path or asset description for errors
 * @returns {string}
 */
export const resolvePagePassword = (passwordEnv, sourceDescription) => {
  if (typeof passwordEnv !== "undefined" && typeof passwordEnv !== "string") {
    throw new Error(
      `${sourceDescription}: "passwordEnv" front matter must be the name of an environment variable.`,
    );
  }
  const envName = passwordEnv || DEFAULT_PASSWORD_ENV;
  const rawPassword = process.env[envName];
  if (!rawPassword) {
    throw new Error(
      `${sourceDescription} is marked as password-protected but the ${envName} environment variable is not set at build time. Set it as a secret in your deploy workflow (e.g. a GitHub Actions repository secret) and rebuild.`,
    );
  }
  return normalizePassword(rawPassword);
};

/**
 * Create the Eleventy transform encrypting protected pages' content.
 * Must be registered after the htmlTransform so images/links are
 * processed before the content gets encrypted.
 * @param {object} options
 * @param {Uint8Array<ArrayBuffer>} options.salt - PBKDF2 salt shared by this build
 * @param {number} options.iterations - PBKDF2 iteration count
 * @param {Record<string, string>} options.labels - Gate UI labels
 * @returns {(content: string, outputPath: string) => Promise<string>}
 */
export const createProtectedTransform = ({ salt, iterations, labels }) => {
  /** @param {unknown} outputPath @returns {boolean} */
  const isHtmlOutput = (outputPath) =>
    typeof outputPath === "string" && outputPath.endsWith(".html");

  /**
   * Eleventy page transform; `this.inputPath` is set by Eleventy.
   * Front matter is re-read per page (not memoised) so `--serve` incremental
   * rebuilds immediately pick up `protected`/`passwordEnv` changes.
   * @param {string} content
   * @param {string} outputPath
   * @this {{ inputPath: string }}
   */
  return async function protectPage(content, outputPath) {
    if (!isHtmlOutput(outputPath) || !content) return content;
    const { data: frontMatter } = matter(readFileSync(this.inputPath, "utf8"));
    if (frontMatter.protected !== true) return content;

    const password = resolvePagePassword(
      frontMatter.passwordEnv,
      `Protected page ${this.inputPath}`,
    );
    const key = await deriveKeyCached(password, salt, iterations);
    const dom = await loadDOM(content);
    await injectGate(dom.window.document, {
      key,
      salt,
      iterations,
      labels,
      intro: frontMatter.protected_intro,
      inputPath: this.inputPath,
    });
    return dom.serialize();
  };
};

/**
 * Encrypt every file in src/protected-assets/ to an authenticated payload
 * under the output directory (.enc suffixed). A missing source directory is
 * a no-op so sites without protected assets build normally.
 * @param {object} options
 * @param {string} options.assetsDir - Source directory (src/protected-assets)
 * @param {string} options.outputDir - Output directory (_site/protected-assets)
 * @param {Uint8Array<ArrayBuffer>} options.salt - PBKDF2 salt shared by this build
 * @param {number} [options.iterations] - PBKDF2 iteration count (for tests)
 * @returns {Promise<number>} Number of encrypted files written
 */
export const writeEncryptedAssets = async ({
  assetsDir,
  outputDir,
  salt,
  iterations = PBKDF2_ITERATIONS,
}) => {
  if (!existsSync(assetsDir)) return 0;

  const assetNames = readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => {
      if (entry.isFile()) return [entry.name];
      throw new Error(
        `Expected only plain files in ${assetsDir}, found "${entry.name}". Protected assets do not support subdirectories.`,
      );
    });

  if (assetNames.length === 0) return 0;

  const password = resolvePagePassword(
    undefined,
    `Protected assets in ${assetsDir}`,
  );
  const key = await deriveKeyCached(password, salt, iterations);

  for (const name of assetNames) {
    const assetPath = join(assetsDir, name);
    const { iv, ct } = await encryptWithKey(key, readFileSync(assetPath));
    const outputPath = join(outputDir, `${name}.enc`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, encodePayload({ salt, iterations, iv, ct }));
  }
  return assetNames.length;
};

/**
 * Resolve the MIME type for a protected asset file name.
 * @param {string} filename
 * @returns {string}
 */
export const mimeTypeForAsset = (filename) => {
  const extension = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase()
    : null;
  return ASSET_MIME_TYPES[extension] || DEFAULT_MIME_TYPE;
};

/**
 * Whether the browser can display a MIME type inline (vs. forcing a download).
 * @param {string} mimeType
 * @returns {boolean}
 */
export const isInlineMimeType = (mimeType) => INLINE_MIME_TYPES.has(mimeType);

/**
 * Escape a value for use in HTML text or attribute context.
 * @param {string} value
 * @returns {string}
 */
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Render the placeholder link for a protected document. The link includes
 * everything the client script needs to swap in a decrypted blob URL once
 * the page has been unlocked; non-inline-viewable file types carry a
 * download attribute so browsers offer to save them instead of wandering.
 * @param {string} name - File name inside src/protected-assets/
 * @param {string} [label] - Link text (defaults to the file name)
 * @returns {string}
 */
export const buildProtectedAssetLink = (name, label) => {
  if (!name?.trim()) {
    throw new Error(
      'The protectedAsset shortcode needs a file name from src/protected-assets/, e.g. {% protectedAsset "rams.pdf", "Download our RAMS (PDF)" %}.',
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes("..")) {
    throw new Error(
      `Protected asset name "${name}" must be a plain file name in src/${PROTECTED_ASSETS_DIR}/ (no directories or path tricks).`,
    );
  }
  const mimeType = mimeTypeForAsset(name);
  const safeName = escapeHtml(name);
  const safeLabel = escapeHtml(label || name);
  const downloadAttribute = isInlineMimeType(mimeType)
    ? ""
    : ` download="${safeName}"`;
  return (
    `<a href="#protected-file" data-protected-asset="${safeName}" ` +
    `data-protected-mime="${escapeHtml(mimeType)}"${downloadAttribute}>${safeLabel}</a>`
  );
};

/**
 * Extract the plain file name from a `protected_documents` entry value;
 * CMS uploads arrive as `/protected-assets/<name>` paths.
 * @param {string} value
 * @returns {string}
 */
const assetNameFromPath = (value) => value.split("/").pop();

/**
 * Read one optional string property off a `protected_documents` entry.
 * @param {object} entry - Front matter entry with file/title/section keys
 * @param {string} key - Property to read
 * @param {string} sourceDescription - Entry description for error messages
 * @returns {string} Trimmed value, or "" when absent
 */
const readEntryString = (entry, key, sourceDescription) => {
  const value = entry[key];
  if (typeof value === "undefined") return "";
  if (typeof value !== "string") {
    throw new Error(
      `${sourceDescription}: "${key}" must be text, not ${typeof value}.`,
    );
  }
  return value.trim();
};

/**
 * Check whether an object entry carries no information at all. The CMS list
 * widget leaves an empty item behind (e.g. `{}` or `{file: null}`) when an
 * editor removes a document; such entries are skipped instead of failing
 * the build.
 * @param {object} entry - Front matter entry
 * @returns {boolean} True when every value is absent or an empty string
 */
const isBlankDocumentEntry = (entry) =>
  Object.values(entry).every(
    (value) =>
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === ""),
  );

/**
 * Normalise one `protected_documents` entry: legacy entries are plain file
 * names or media paths, while the CMS now writes objects carrying a `file`
 * plus an optional display `title` and `section` heading. Entries with no
 * information at all return null and are dropped by the caller; entries
 * with content but no `file` still throw.
 * @param {unknown} entry - Front matter entry
 * @returns {{ file: string, title: string, section: string } | null}
 */
const normaliseDocumentEntry = (entry) => {
  if (typeof entry === "string") {
    const file = entry.trim();
    return file ? { file, title: "", section: "" } : null;
  }
  if (typeof entry !== "object" || entry === null) {
    throw new Error(
      `protected_documents entries must be a file or an object with a "file" key, got ${JSON.stringify(entry)}.`,
    );
  }
  if (isBlankDocumentEntry(entry)) return null;
  const file = readEntryString(entry, "file", "protected_documents entry");
  if (!file) {
    throw new Error(
      `protected_documents entries need a "file" key (the uploaded document), got ${JSON.stringify(entry)}.`,
    );
  }
  return {
    file,
    title: readEntryString(entry, "title", "protected_documents entry"),
    section: readEntryString(entry, "section", "protected_documents entry"),
  };
};

/**
 * Render the encrypted download list for a protected page's
 * `protected_documents` front matter. Entries sharing a `section` value are
 * grouped under one heading (e.g. a game or document type) in the order
 * sections first appear; the `title` becomes the link text visitors see
 * instead of the raw file name. Blank entries left behind by the CMS are
 * skipped, and the shortcode renders nothing when no documents remain.
 * @param {unknown} documents - `protected_documents` front matter value
 * @returns {string}
 */
export const buildProtectedDocumentsHtml = (documents) => {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error(
      "The protectedDocuments shortcode needs the protected_documents list, e.g. {% protectedDocuments protected_documents %}.",
    );
  }

  const normalised = compact(documents.map(normaliseDocumentEntry));
  if (normalised.length === 0) return "";

  const entries = normalised.map(({ file, title, section }) => {
    const name = assetNameFromPath(file);
    return {
      section,
      link: `<li>${buildProtectedAssetLink(name, title || name)}</li>`,
    };
  });

  const body = [...groupBy(entries, (entry) => entry.section)]
    .map(([section, groupEntries]) => {
      const links = groupEntries.map(({ link }) => link).join("");
      return `${section ? `<h3>${escapeHtml(section)}</h3>` : ""}<ul>${links}</ul>`;
    })
    .join("");
  return `<div class="protected-documents">${body}</div>`;
};

/**
 * Create the post-build hook encrypting protected documents.
 * @param {object} options
 * @param {string} options.assetsDir - Source directory (src/protected-assets)
 * @param {string} options.outputDir - Output directory (_site/protected-assets)
 * @param {Uint8Array<ArrayBuffer>} options.salt - PBKDF2 salt shared by this build
 * @param {number} options.iterations - PBKDF2 iteration count
 * @returns {() => Promise<number>} eleventy.after handler returning the file count
 */
export const createAssetEncryptionHook =
  ({ assetsDir, outputDir, salt, iterations }) =>
  () =>
    writeEncryptedAssets({ assetsDir, outputDir, salt, iterations });

/**
 * Register the password protection plugin: content transform, the
 * protectedAsset/protectedDocuments shortcodes, and post-build document
 * encryption.
 * @param {import("@11ty/eleventy").UserConfig} eleventyConfig
 */
export const configureProtectedPages = (eleventyConfig) => {
  const labels = readGateStrings(strings);
  const salt = getRandomBytes(SALT_BYTES);
  const iterations = PBKDF2_ITERATIONS;

  eleventyConfig.addTransform(
    "protectedPages",
    createProtectedTransform({ salt, iterations, labels }),
  );
  eleventyConfig.addShortcode("protectedAsset", buildProtectedAssetLink);
  eleventyConfig.addShortcode(
    "protectedDocuments",
    buildProtectedDocumentsHtml,
  );
  eleventyConfig.on(
    "eleventy.after",
    createAssetEncryptionHook({
      // Resolved from the build's working directory (like the image
      // pipeline) so embedded test sites build their own assets — or skip
      // encryption entirely when they have no protected-assets folder —
      // instead of encrypting this repository's documents.
      assetsDir: join(process.cwd(), "src", PROTECTED_ASSETS_DIR),
      outputDir: join(process.cwd(), "_site", PROTECTED_ASSETS_DIR),
      salt,
      iterations,
    }),
  );
};
