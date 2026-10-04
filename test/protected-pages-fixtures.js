/**
 * Shared fixtures for the protected-pages test suites (transform, build
 * plugin, client decryption, crypto round-trips). Importing this module
 * also patches globalThis.crypto when happy-dom registered one without
 * `subtle`, which password crypto requires.
 */
import { webcrypto } from "node:crypto";
import { getRandomBytes } from "#utils/protected-crypto.js";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

/** Gate UI labels used by the protected-pages test suites. */
export const PROTECTED_TEST_LABELS = {
  heading: "Staff area",
  label: "Password",
  submit: "Open",
  loading: "Opening…",
  error: "Wrong password",
};

export const PROTECTED_TEST_SALT = getRandomBytes(16);
export const PROTECTED_TEST_ITERATIONS = 1000;
