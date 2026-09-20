/**
 * DOM transform that puts a page's content behind a password gate.
 *
 * The plugin (protected-pages.js) decides which pages are protected and
 * derives the encryption key; this module performs the DOM surgery:
 * it encrypts the rendered <article id="content"> markup into a JSON
 * payload, replaces it with a password form, and marks the page
 * noindex so gated pages stay out of search engines.
 *
 * The client counterpart is #public/ui/protected-pages.js.
 */
import { encodePayload, encryptWithKey } from "#utils/protected-crypto.js";

const CONTENT_SELECTOR = "article#content";
const ROBOTS_META_SELECTOR = "meta[name='robots']";
const NOINDEX_CONTENT = "noindex, nofollow";
const PASSWORD_INPUT_ID = "protected-page-password";
const GATE_LABEL_KEYS = ["heading", "label", "submit", "loading", "error"];

/**
 * Validate and extract the gate UI labels from the merged strings data
 * (strings-base.json defaults + user strings.json). Fails fast so a broken
 * strings file cannot silently produce an unusable gate.
 * @param {unknown} stringsData - The merged strings data
 * @returns {Record<string, string>}
 */
const readGateStrings = (stringsData) => {
  const section = stringsData?.protected_pages;
  if (!section) {
    throw new Error(
      'strings-base.json is missing the "protected_pages" section required for password-protected pages.',
    );
  }
  const labels = GATE_LABEL_KEYS.map((key) => [key, section[key]]);
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
 * @param {Document} document
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
 * Build the password gate markup shown before the content is decrypted.
 * @param {Document} document
 * @param {Record<string, string>} labels
 * @returns {HTMLElement}
 */
const buildGateElement = (document, labels) => {
  const gate = document.createElement("div");
  gate.className = "protected-gate";
  gate.setAttribute("data-protected-gate", "");

  const heading = document.createElement("h2");
  heading.textContent = labels.heading;
  gate.appendChild(heading);

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

  gate.appendChild(form);
  return gate;
};

/**
 * Build the script tag carrying the encrypted payload.
 * @param {Document} document
 * @param {string} payloadJson
 * @returns {HTMLScriptElement}
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
 * @param {Document} document
 * @param {object} options
 * @param {CryptoKey} options.key - AES-GCM key derived from the page password
 * @param {Uint8Array} options.salt - PBKDF2 salt shared by this build
 * @param {number} options.iterations - PBKDF2 iteration count
 * @param {Record<string, string>} options.labels - Gate UI labels
 * @param {string} options.inputPath - Source file path for error messages
 */
const injectGate = async (
  document,
  { key, salt, iterations, labels, inputPath },
) => {
  const content = document.querySelector(CONTENT_SELECTOR);
  if (!content) {
    throw new Error(
      `Cannot protect ${inputPath}: no <article id="content"> was found. Password-protected pages must use a layout that extends base.html.`,
    );
  }
  const html = content.innerHTML;
  if (!html.trim()) {
    throw new Error(`Cannot protect ${inputPath}: the page content is empty.`);
  }

  const { iv, ct } = await encryptWithKey(
    key,
    new TextEncoder().encode(html),
  );
  const payloadJson = encodePayload({ salt, iterations, iv, ct });

  content.replaceChildren(
    buildGateElement(document, labels),
    buildPayloadScript(document, payloadJson),
  );
  ensureNoindexMeta(document);
};

export { injectGate, readGateStrings };
