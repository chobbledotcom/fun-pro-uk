/**
 * DOM transform that puts a page's content behind a password gate.
 *
 * The plugin (protected-pages.js) decides which pages are protected and
 * derives the encryption key; this module performs the DOM surgery:
 * it encrypts the rendered <article id="content"> markup into a JSON
 * payload, replaces it with a password form, and marks the page
 * noindex so gated pages stay out of search engines.
 *
 * The optional `protected_intro` front matter (markdown) is rendered into
 * the gate itself, above the password form, so it is visible before the
 * page is unlocked — it must not contain anything confidential.
 *
 * The client counterpart is #public/ui/protected-pages.js.
 */
import MarkdownIt from "markdown-it";
import { encodePayload, encryptWithKey } from "#utils/protected-crypto.js";

const CONTENT_SELECTOR = "article#content";
const ROBOTS_META_SELECTOR = "meta[name='robots']";
const NOINDEX_CONTENT = "noindex, nofollow";
const PASSWORD_INPUT_ID = "protected-page-password";
const GATE_LABEL_KEYS = ["heading", "label", "submit", "loading", "error"];

/**
 * Renders the gate intro. Raw HTML is disabled because the intro is public
 * (it sits outside the encrypted payload), unlike the page body which is
 * only readable after unlocking.
 */
const introMarkdown = new MarkdownIt({ html: false });

/**
 * Validate and extract the gate UI labels from the merged strings data
 * (strings-base.json defaults + user strings.json). Fails fast so a broken
 * strings file cannot silently produce an unusable gate.
 * @param {import("#data/strings.js").default} stringsData - The merged strings data
 * @returns {Record<string, string>}
 */
const readGateStrings = (stringsData) => {
  if (!stringsData.protected_pages) {
    throw new Error(
      'strings-base.json is missing the "protected_pages" section required for password-protected pages.',
    );
  }
  const labels = GATE_LABEL_KEYS.map((key) => [
    key,
    stringsData.protected_pages[key],
  ]);
  const missing = labels
    .filter(([, value]) => typeof value !== "string" || value === "")
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `strings-base.json protected_pages is missing label(s): ${missing.join(", ")}.`,
    );
  }
  return Object.fromEntries(labels);
};

/**
 * Ensure search engines do not index gated pages. Updates an existing robots
 * meta (e.g. from a no_index front matter flag) or appends a new one.
 * @param {import("happy-dom").Document} document
 */
const ensureNoindexMeta = (document) => {
  const existing = document.querySelector(ROBOTS_META_SELECTOR);
  if (existing) {
    existing.setAttribute("content", NOINDEX_CONTENT);
    return;
  }
  const meta = document.createElement("meta");
  meta.setAttribute("name", "robots");
  meta.setAttribute("content", NOINDEX_CONTENT);
  document.head.appendChild(meta);
};

/**
 * Build the password form with label, input and submit button.
 * @param {import("happy-dom").Document} document
 * @param {Record<string, string>} labels
 * @returns {import("happy-dom").HTMLElement}
 */
const buildGateForm = (document, labels) => {
  const form = document.createElement("form");
  form.setAttribute("data-protected-form", "");
  form.setAttribute("data-error-label", labels.error);

  const label = document.createElement("label");
  label.setAttribute("for", PASSWORD_INPUT_ID);
  label.textContent = labels.label;
  form.appendChild(label);

  const input = document.createElement("input");
  input.id = PASSWORD_INPUT_ID;
  input.setAttribute("type", "text");
  input.setAttribute("name", "password");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "none");
  input.setAttribute("spellcheck", "false");
  input.required = true;
  form.appendChild(input);

  const button = document.createElement("button");
  button.setAttribute("type", "submit");
  button.className = "button";
  button.textContent = labels.submit;
  button.setAttribute("data-loading-label", labels.loading);
  form.appendChild(button);

  return form;
};

/**
 * Build the password gate markup shown before the content is decrypted.
 * @param {import("happy-dom").Document} document
 * @param {Record<string, string>} labels
 * @param {string} [introHtml] - Rendered `protected_intro` markdown
 * @returns {import("happy-dom").HTMLElement}
 */
const buildGateElement = (document, labels, introHtml) => {
  const gate = document.createElement("div");
  gate.className = "protected-gate";
  gate.setAttribute("data-protected-gate", "");

  const heading = document.createElement("h2");
  heading.textContent = labels.heading;
  gate.appendChild(heading);

  if (introHtml) {
    const intro = document.createElement("div");
    intro.className = "protected-intro";
    intro.innerHTML = introHtml;
    gate.appendChild(intro);
  }

  gate.appendChild(buildGateForm(document, labels));
  return gate;
};

/**
 * Build the script tag carrying the encrypted payload.
 * @param {import("happy-dom").Document} document
 * @param {string} payloadJson
 * @returns {import("happy-dom").HTMLScriptElement}
 */
const buildPayloadScript = (document, payloadJson) => {
  const script = document.createElement("script");
  script.setAttribute("type", "application/json");
  script.setAttribute("data-protected-payload", "");
  script.textContent = payloadJson;
  return script;
};

/**
 * Encrypt the page's #content markup and replace it with the gate.
 * @param {import("happy-dom").Document} document
 * @param {object} options
 * @param {CryptoKey} options.key - AES-GCM key derived from the page password
 * @param {Uint8Array<ArrayBuffer>} options.salt - PBKDF2 salt shared by this build
 * @param {number} options.iterations - PBKDF2 iteration count
 * @param {Record<string, string>} options.labels - Gate UI labels
 * @param {unknown} options.intro - `protected_intro` front matter (markdown)
 * @param {string} options.inputPath - Source file path for error messages
 */
const injectGate = async (
  document,
  { key, salt, iterations, labels, intro, inputPath },
) => {
  const content = document.querySelector(CONTENT_SELECTOR);
  if (!content) {
    throw new Error(
      `Cannot protect ${inputPath}: no <article id="content"> was found. Password-protected pages must use a layout that extends base.html.`,
    );
  }
  if (!content.innerHTML.trim()) {
    throw new Error(`Cannot protect ${inputPath}: the page content is empty.`);
  }
  if (typeof intro !== "undefined" && typeof intro !== "string") {
    throw new Error(
      `Cannot protect ${inputPath}: "protected_intro" front matter must be markdown text shown before the password box.`,
    );
  }
  const introHtml = intro?.trim() ? introMarkdown.render(intro) : "";

  const { iv, ct } = await encryptWithKey(
    key,
    new TextEncoder().encode(content.innerHTML),
  );
  const payloadJson = encodePayload({ salt, iterations, iv, ct });

  content.replaceChildren(
    buildGateElement(document, labels, introHtml),
    buildPayloadScript(document, payloadJson),
  );
  ensureNoindexMeta(document);
};

export { injectGate, readGateStrings };
