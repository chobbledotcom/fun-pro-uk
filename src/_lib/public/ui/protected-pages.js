/**
 * Client-side decryption for password-protected pages.
 *
 * At build time the page's <article id="content"> markup was encrypted into
 * a JSON payload next to a password form. This script asks the visitor for
 * the password, re-derives the AES key locally (the password never leaves
 * the browser), decrypts the payload and swaps the gate for the real
 * content. It then hydrates links to encrypted documents
 * (a[data-protected-asset]) into viewable/downloadable blob URLs and
 * restores obfuscated mailto: links inside the decrypted content.
 */
import { encodeBase64 } from "#utils/aes-base64.js";
import {
  decryptWithKey,
  deriveAesGcmKey,
  parsePayload,
} from "#utils/protected-crypto.js";
import { memoize } from "#toolkit/fp/memoize.js";
import { showNotification } from "#public/utils/notify.js";
import { onReady } from "#public/utils/on-ready.js";
import { decryptMailLinks } from "#public/ui/decrypt-text.js";

const GATE_SELECTOR = "[data-protected-gate]";
const PAYLOAD_SELECTOR = "script[data-protected-payload]";
const FORM_SELECTOR = "[data-protected-form]";
const BUTTON_SELECTOR = "button[type='submit']";
const INPUT_SELECTOR = "input[type='password']";
const ASSET_SELECTOR = "a[data-protected-asset]";
const ASSET_BASE_URL = "/protected-assets/";
const STORAGE_KEY = "protected-pages-password";

/** Memoised so the page payload and its document links derive the key once. */
const getDerivedKey = memoize(
  async (password, salt, iterations) =>
    deriveAesGcmKey(password, salt, iterations),
  {
    cacheKey: ([password, salt, iterations]) =>
      `${password}\u0000${encodeBase64(salt)}\u0000${iterations}`,
  },
);

/**
 * Replace the gate with the decrypted content, remember the password so
 * other protected pages in the same tab don't ask again, then hydrate the
 * document links and mail links inside the restored markup.
 * @param {HTMLElement} article
 * @param {string} password
 * @returns {Promise<void>}
 */
const unlock = async (article, password) => {
  const payloadScript = article.querySelector(PAYLOAD_SELECTOR);
  if (!payloadScript) {
    throw new Error("Protected page payload is missing.");
  }
  const payload = parsePayload(payloadScript.textContent);
  const key = await getDerivedKey(password, payload.salt, payload.iterations);
  const html = new TextDecoder().decode(
    await decryptWithKey(key, payload.iv, payload.ct),
  );

  article.innerHTML = html;
  window.sessionStorage.setItem(STORAGE_KEY, password);

  /**
   * Fetch + decrypt one protected document into a blob URL.
   * @param {HTMLAnchorElement} link
   * @returns {Promise<void>}
   */
  const hydrateAsset = async (link) => {
    const name = link.getAttribute("data-protected-asset");
    const mime = link.getAttribute("data-protected-mime");
    const response = await fetch(`${ASSET_BASE_URL}${name}.enc`);
    if (!response.ok) {
      throw new Error(`Protected asset ${name} could not be loaded.`);
    }
    const assetPayload = parsePayload(await response.text());
    const bytes = await decryptWithKey(key, assetPayload.iv, assetPayload.ct);
    link.setAttribute(
      "href",
      URL.createObjectURL(new Blob([bytes], { type: mime })),
    );
  };

  for (const link of article.querySelectorAll(ASSET_SELECTOR)) {
    await hydrateAsset(link).catch(() =>
      link.setAttribute("data-protected-failed", ""),
    );
  }

  await decryptMailLinks(article);
};

/** Activate the gate on this page (if any). */
const initProtectedPages = () => {
  const gate = document.querySelector(GATE_SELECTOR);
  if (!gate) return;
  const article = gate.closest("article");
  if (!article) return;
  const form = article.querySelector(FORM_SELECTOR);
  if (!form) return;
  const button = form.querySelector(BUTTON_SELECTOR);
  const input = form.querySelector(INPUT_SELECTOR);
  const idleLabel = button.textContent;
  const loadingLabel = button.getAttribute("data-loading-label");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = input.value;
    if (!password) return;
    button.disabled = true;
    button.textContent = loadingLabel;

    unlock(article, password)
      .catch(() => showNotification(form.getAttribute("data-error-label")))
      .finally(() => {
        button.disabled = false;
        button.textContent = idleLabel;
      });
  });

  const storedPassword = window.sessionStorage.getItem(STORAGE_KEY);
  if (storedPassword) {
    unlock(article, storedPassword).catch(() => undefined);
  }
};

onReady(initProtectedPages);
