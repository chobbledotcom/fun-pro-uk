import { describe, expect, test } from "bun:test";
import { webcrypto } from "node:crypto";
import { decodeBase64, encodeBase64 } from "#utils/aes-base64.js";
import {
  decryptWithKey,
  deriveAesGcmKey,
  encodePayload,
  encryptWithKey,
  getRandomBytes,
  parsePayload,
  IV_BYTES,
  PBKDF2_ITERATIONS,
  SALT_BYTES,
} from "#utils/protected-crypto.js";

// The happy-dom global registration may provide a crypto object without
// subtle; password crypto needs the real WebCrypto implementation.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

const TEST_ITERATIONS = 1000;

const encryptRoundTrip = async (password, bytes) => {
  const salt = getRandomBytes(SALT_BYTES);
  const key = await deriveAesGcmKey(password, salt, TEST_ITERATIONS);
  const { iv, ct } = await encryptWithKey(key, bytes);
  return parsePayload(
    encodePayload({ salt, iterations: TEST_ITERATIONS, iv, ct }),
  );
};

describe("protected-crypto", () => {
  test("round-trips bytes through a password-derived key", async () => {
    const original = crypto.getRandomValues(new Uint8Array(64));
    const payload = await encryptRoundTrip("correct horse", original);
    const key = await deriveAesGcmKey(
      "correct horse",
      payload.salt,
      payload.iterations,
    );
    const decrypted = await decryptWithKey(key, payload.iv, payload.ct);

    expect(Array.from(decrypted)).toEqual(Array.from(original));
  });

  test("round-trips an empty payload", async () => {
    const payload = await encryptRoundTrip("pw", new Uint8Array(0));
    const key = await deriveAesGcmKey("pw", payload.salt, payload.iterations);
    const decrypted = await decryptWithKey(key, payload.iv, payload.ct);
    expect(decrypted.byteLength).toBe(0);
  });

  test("rejects the wrong password", async () => {
    const original = new TextEncoder().encode("secret documents");
    const payload = await encryptRoundTrip("right password", original);
    const wrongKey = await deriveAesGcmKey(
      "wrong password",
      payload.salt,
      payload.iterations,
    );

    const attempt = decryptWithKey(wrongKey, payload.iv, payload.ct);
    await expect(attempt).rejects.toThrow();
  });

  test("rejects tampered ciphertext", async () => {
    const payload = await encryptRoundTrip("pw", new Uint8Array(32));
    payload.ct[0] ^= 0x01;
    const key = await deriveAesGcmKey("pw", payload.salt, payload.iterations);

    const attempt = decryptWithKey(key, payload.iv, payload.ct);
    await expect(attempt).rejects.toThrow();
  });

  test("serialised payload carries kdf metadata for the client", async () => {
    const salt = getRandomBytes(SALT_BYTES);
    const key = await deriveAesGcmKey("pw", salt, TEST_ITERATIONS);
    const { iv, ct } = await encryptWithKey(key, new Uint8Array([1, 2, 3]));
    const json = encodePayload({ salt, iterations: TEST_ITERATIONS, iv, ct });

    expect(JSON.parse(json)).toEqual({
      v: 1,
      kdf: "PBKDF2-SHA256",
      cipher: "AES-GCM-256",
      iterations: TEST_ITERATIONS,
      salt: encodeBase64(salt),
      iv: encodeBase64(iv),
      ct: encodeBase64(ct),
    });
  });

  test("payload base64 only uses the URL-safe alphabet", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    const encoded = encodeBase64(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(decodeBase64(encoded))).toEqual(Array.from(bytes));
  });

  test("parsePayload rejects payloads with missing fields", () => {
    expect(() => parsePayload(JSON.stringify({ iv: "xx", ct: "yy" }))).toThrow(
      /salt/,
    );
  });

  test("parsePayload rejects payloads with a bad iteration count", () => {
    const invalid = JSON.stringify({
      salt: "abcd",
      iv: "abcd",
      ct: "abcd",
      iterations: 0,
    });
    expect(() => parsePayload(invalid)).toThrow(/iterations/);
  });

  test("parsePayload rejects non-JSON input", () => {
    expect(() => parsePayload("not json at all")).toThrow();
  });

  test("exports the OWASP-recommended iteration count and byte sizes", () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    expect(SALT_BYTES).toBe(16);
    expect(IV_BYTES).toBe(12);
  });
});
