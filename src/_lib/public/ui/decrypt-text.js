/**
 * Client-side AES-CTR decryption for obfuscated email links.
 *
 * At build time, mailto: links are encrypted and marked with
 * data-decrypt-link. decryptMailLinks() restores them using the key
 * stored in the bundle script tag's data-decrypt-key attribute. It runs on
 * page load and is re-used by protected-pages.js after gated content is
 * decrypted into the DOM.
 */
import { onReady } from "#public/utils/on-ready.js";
import {
  BITS_PER_BYTE,
  BLOCK_BYTES,
  decodeBase64,
  NONCE_BYTES,
} from "#utils/aes-base64.js";

/** @param {string} keyText @returns {Promise<CryptoKey>} */
const importKey = (keyText) =>
  crypto.subtle.importKey(
    "raw",
    decodeBase64(keyText),
    { name: "AES-CTR" },
    false,
    ["decrypt"],
  );

/** @param {string} inputText @param {CryptoKey} key @returns {Promise<string>} */
const decrypt = async (inputText, key) => {
  const inputBytes = decodeBase64(inputText);
  const nonceBytes = inputBytes.slice(0, NONCE_BYTES);
  const codeBytes = inputBytes.slice(NONCE_BYTES);

  const counter = new Uint8Array(BLOCK_BYTES);
  counter.set(nonceBytes);

  const plainBytes = await crypto.subtle.decrypt(
    {
      name: "AES-CTR",
      counter,
      length: (BLOCK_BYTES - NONCE_BYTES) * BITS_PER_BYTE,
    },
    key,
    codeBytes,
  );

  return new TextDecoder().decode(plainBytes);
};

/**
 * Restore every obfuscated mailto: link under a root element.
 * @param {ParentNode} root - Element (or document) to scan
 * @returns {Promise<void>}
 */
const decryptMailLinks = async (root) => {
  const scriptTag = document.querySelector("script[data-decrypt-key]");
  if (!scriptTag) return;

  const keyText = scriptTag.getAttribute("data-decrypt-key");
  if (!keyText) return;
  if (!globalThis.crypto?.subtle) return;

  const links = root.querySelectorAll("a[data-decrypt-link]");
  if (links.length === 0) return;

  const key = await importKey(keyText);

  for (const link of links) {
    const [href, html] = await Promise.all([
      decrypt(link.getAttribute("href").replace(/^#/, ""), key),
      decrypt(link.textContent, key),
    ]);
    link.setAttribute("href", href);
    link.innerHTML = html;
  }
};

export { decryptMailLinks };

onReady(() => decryptMailLinks(document));
