import { afterAll, describe, expect, mock, test } from "bun:test";
import { decodeBase64, encrypt, generateKeyText } from "#utils/aes-encrypt.js";

// Mock notify.js to capture notification calls instead of DOM manipulation;
// earlier test files replace this module for the whole run, so relying on the
// real toast markup would be order-dependent. Allowlisted in
// test/unit/code-quality/mock-module-usage.test.js.
const mockShowNotification = mock();
mock.module("#public/utils/notify.js", () => ({
  showNotification: (...args) => mockShowNotification(...args),
}));

import {
  PROTECTED_TEST_ITERATIONS,
  PROTECTED_TEST_LABELS,
  PROTECTED_TEST_SALT,
} from "#test/protected-pages-fixtures.js";
import {
  deriveAesGcmKey,
  encodePayload,
  encryptWithKey,
  normalizePassword,
} from "#utils/protected-crypto.js";

const LABELS = {
  ...PROTECTED_TEST_LABELS,
  error: "Wrong password, try again",
};
const PASSWORD = "open sesame";
const SALT = PROTECTED_TEST_SALT;
const ITERATIONS = PROTECTED_TEST_ITERATIONS;
const PAYLOAD_SELECTOR = "script[data-protected-payload]";
const STORE_KEY = "protected-pages-password";

const EMAIL_KEY_TEXT = generateKeyText();
const EMAIL_KEY_BYTES = decodeBase64(EMAIL_KEY_TEXT);
const MAILTO = "mailto:staff@funpro-uk.test";
const SECRET_HTML = `<h1>Confidential RAMS</h1><a href="#${encrypt(MAILTO, EMAIL_KEY_BYTES)}" data-decrypt-link="">${encrypt("Staff contact", EMAIL_KEY_BYTES)}</a><a href="#protected-file" data-protected-asset="rams.pdf" data-protected-mime="application/pdf">Download RAMS</a><a href="#protected-file" data-protected-asset="Air Hockey/pat.pdf" data-protected-mime="application/pdf">Download PAT</a>`;

const realFetch = globalThis.fetch;
const realCreateObjectURL = URL.createObjectURL;
let clientModulePromise = null;

const buildEncryptedPayload = async () => {
  const key = await deriveAesGcmKey(
    normalizePassword(PASSWORD),
    SALT,
    ITERATIONS,
  );
  const { iv, ct } = await encryptWithKey(
    key,
    new TextEncoder().encode(SECRET_HTML),
  );
  return encodePayload({ salt: SALT, iterations: ITERATIONS, iv, ct });
};

const setupProtectedPage = async () => {
  // Mirrors the markup produced by the build-time gate (protect-content.js):
  // a data-attribute driven form plus an encrypted JSON payload script tag.
  document.body.innerHTML = `<main><article id="content">
      <div class="protected-gate" data-protected-gate=""><h2>${LABELS.heading}</h2>
      <form data-protected-form="" data-error-label="${LABELS.error}">
        <label for="protected-page-password">${LABELS.label}</label>
        <input id="protected-page-password" type="text" name="password" autocomplete="off" autocapitalize="none" spellcheck="false" required>
        <button type="submit" class="button" data-loading-label="${LABELS.loading}">${LABELS.submit}</button>
      </form></div>
      <script type="application/json" data-protected-payload="">${await buildEncryptedPayload()}</script>
    </article></main>
    <script type="module" src="/assets/js/bundle.js" data-decrypt-key="${EMAIL_KEY_TEXT}"></script>`;
  return document.querySelector("article#content");
};

const loadClient = async () => {
  if (clientModulePromise === null) {
    clientModulePromise = import("#public/ui/protected-pages.js");
  }
  await clientModulePromise;
  // onReady inits immediately on readyState !== "loading"; this covers the
  // case where the registered window is still marked as loading.
  if (document.readyState === "loading") {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }
};

const waitFor = async (predicate, timeoutMs = 3000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await Bun.sleep(25);
  }
  return false;
};

const submitGate = async (article, passwordValue) => {
  const input = article.querySelector("#protected-page-password");
  const button = article.querySelector("button[type='submit']");
  if (passwordValue !== null) input.value = passwordValue;
  button.disabled = false;
  article
    .querySelector("form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
};

describe("protected-pages client", () => {
  test("a stored wrong password fails silently and keeps the gate", async () => {
    mockShowNotification.mockReset();
    const article = await setupProtectedPage();
    await loadClient();

    const gateKept = await waitFor(
      () => article.querySelector("[data-protected-gate]") !== null,
    );
    expect(gateKept).toBe(true);
    expect(article.querySelector(PAYLOAD_SELECTOR)).not.toBeNull();
    expect(article.textContent).not.toContain("Confidential RAMS");
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("submitting an empty password reserves the gate until input", async () => {
    const article = document.querySelector("article#content");
    await submitGate(article, "");
    const button = article.querySelector("button[type='submit']");
    expect(button.disabled).toBe(false);
    expect(article.querySelector(PAYLOAD_SELECTOR)).not.toBeNull();
  });

  test("a wrong typed password shows the error and keeps the gate", async () => {
    mockShowNotification.mockReset();
    const article = document.querySelector("article#content");
    await submitGate(article, "definitely not it");

    const notified = await waitFor(
      () => mockShowNotification.mock.calls.length > 0,
    );
    expect(notified).toBe(true);
    expect(mockShowNotification).toHaveBeenCalledWith(LABELS.error);
    expect(article.querySelector("[data-protected-gate]")).not.toBeNull();
    expect(article.textContent).not.toContain("Confidential RAMS");
  });

  test("the correct password decrypts content, assets and mail links", async () => {
    const article = document.querySelector("article#content");
    const assetBytes = new TextEncoder().encode("%PDF-stub");
    const assetKey = await deriveAesGcmKey(
      normalizePassword(PASSWORD),
      SALT,
      ITERATIONS,
    );
    const { iv, ct } = await encryptWithKey(assetKey, assetBytes);
    const assetEncPayload = encodePayload({
      salt: SALT,
      iterations: ITERATIONS,
      iv,
      ct,
    });

    const fetchedUrls = [];
    globalThis.fetch = async (url) => {
      fetchedUrls.push(url);
      return { ok: true, text: async () => assetEncPayload };
    };
    URL.createObjectURL = () => "blob:mock-decrypted";

    // Typed with different case and padding: normalisation must make this
    // match the build-time password.
    await submitGate(article, `  ${PASSWORD.toUpperCase()}  `);

    const unlocked = await waitFor(
      () => article.querySelector("h1")?.textContent === "Confidential RAMS",
    );
    expect(unlocked).toBe(true);
    expect(article.querySelector(PAYLOAD_SELECTOR)).toBeNull();
    expect(article.querySelector("[data-protected-gate]")).toBeNull();
    expect(window.sessionStorage.getItem(STORE_KEY)).toBe(PASSWORD);

    const assetLinked = await waitFor(() => fetchedUrls.length > 1);
    expect(assetLinked).toBe(true);
    const link = article.querySelector("a[data-protected-asset]");
    expect(fetchedUrls).toContain("/protected-assets/rams.pdf.enc");
    expect(fetchedUrls).toContain("/protected-assets/Air%20Hockey/pat.pdf.enc");
    expect(link.getAttribute("href")).toBe("blob:mock-decrypted");

    const mailRestored = await waitFor(
      () =>
        article.querySelector("a[data-decrypt-link]")?.getAttribute("href") ===
        MAILTO,
    );
    expect(mailRestored).toBe(true);
    expect(article.querySelector("a[data-decrypt-link]").textContent).toBe(
      "Staff contact",
    );
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
    if (realCreateObjectURL === undefined) {
      delete URL.createObjectURL;
    } else {
      URL.createObjectURL = realCreateObjectURL;
    }
  });
});
