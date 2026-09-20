/**
 * Password-based encryption helpers shared between the build
 * (Eleventy running on Bun/Node) and the browser bundle.
 *
 * Pages and documents are encrypted at build time with AES-256-GCM using a
 * key derived from a build-time secret (e.g. a GitHub Actions secret) via
 * PBKDF2-HMAC-SHA-256. The browser asks the visitor for the password,
 * re-derives the same key with the Web Crypto API and decrypts the content
 * locally; the password and the plaintext never reach the web server.
 *
 * Encrypted payloads are JSON documents ("ppg.v1") carrying the KDF
 * parameters plus base64-encoded salt, IV and ciphertext. The custom
 * URL-safe base64 codec from aes-base64.js is shared with the browser side.
 * Wrong passwords (and tampered payloads) fail authentication, so
 * crypto.subtle rejects — callers surface that to the visitor as
 * "incorrect password" instead of masking it.
 */
import { decodeBase64, encodeBase64 } from "#utils/aes-base64.js";

export const PBKDF2_ITERATIONS = 600_000; // OWASP-recommended count for PBKDF2-HMAC-SHA256
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const KEY_BITS = 256;
const PAYLOAD_VERSION = 1;
const KDF_ALGORITHM = "PBKDF2-SHA256";
const CIPHER_ALGORITHM = "AES-GCM-256";

/** @returns {SubtleCrypto} */
const getSubtle = () => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "The Web Crypto API (crypto.subtle) is unavailable. Password-protected pages require a secure context (HTTPS) and a modern browser.",
    );
  }
  return subtle;
};

/** @param {number} length @returns {Uint8Array} */
const getRandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));

/**
 * Derive an AES-GCM key from a password using PBKDF2-HMAC-SHA-256.
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} iterations
 * @returns {Promise<CryptoKey>}
 */
const deriveAesGcmKey = async (password, salt, iterations) => {
  const baseKey = await getSubtle().importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return getSubtle().deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
};

/**
 * Encrypt bytes with a derived AES-GCM key and a fresh random IV.
 * @param {CryptoKey} key
 * @param {Uint8Array} bytes
 * @returns {Promise<{iv: Uint8Array, ct: Uint8Array}>}
 */
const encryptWithKey = async (key, bytes) => {
  const iv = getRandomBytes(IV_BYTES);
  const encrypted = await getSubtle().encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes,
  );
  return { iv, ct: new Uint8Array(encrypted) };
};

/**
 * Decrypt bytes with a derived AES-GCM key. Rejects when the ciphertext
 * fails authentication (wrong password or tampered payload).
 * @param {CryptoKey} key
 * @param {Uint8Array} iv
 * @param {Uint8Array} ct
 * @returns {Promise<Uint8Array>}
 */
const decryptWithKey = async (key, iv, ct) => {
  const decrypted = await getSubtle().decrypt({ name: "AES-GCM", iv }, key, ct);
  return new Uint8Array(decrypted);
};

/**
 * Serialise an encrypted payload to the JSON wire format shared by
 * protected pages (embedded in a script tag) and protected assets (.enc files).
 * @param {{salt: Uint8Array, iterations: number, iv: Uint8Array, ct: Uint8Array}} payload
 * @returns {string}
 */
const encodePayload = ({ salt, iterations, iv, ct }) =>
  JSON.stringify({
    v: PAYLOAD_VERSION,
    kdf: KDF_ALGORITHM,
    cipher: CIPHER_ALGORITHM,
    iterations,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ct: encodeBase64(ct),
  });

/**
 * Parse and validate an encrypted payload (JSON text from a script tag,
 * a fetched .enc file, or a build-time serialised payload).
 * @param {string} jsonText
 * @returns {{salt: Uint8Array, iterations: number, iv: Uint8Array, ct: Uint8Array}}
 */
const parsePayload = (jsonText) => {
  const raw = JSON.parse(jsonText);
  const missing = ["salt", "iv", "ct"].filter(
    (field) => typeof raw?.[field] !== "string" || raw[field] === "",
  );
  if (missing.length > 0) {
    throw new Error(
      `Invalid protected payload: missing field(s) ${missing.join(", ")}.`,
    );
  }
  if (!Number.isInteger(raw.iterations) || raw.iterations < 1) {
    throw new Error("Invalid protected payload: iterations must be a positive integer.");
  }
  return {
    salt: decodeBase64(raw.salt),
    iterations: raw.iterations,
    iv: decodeBase64(raw.iv),
    ct: decodeBase64(raw.ct),
  };
};

export {
  deriveAesGcmKey,
  encodePayload,
  encryptWithKey,
  getRandomBytes,
  parsePayload,
  decryptWithKey,
  IV_BYTES,
  SALT_BYTES,
};
