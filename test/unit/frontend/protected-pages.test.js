import { describe, expect, test, afterAll } from "bun:test";
import { webcrypto } from "node:crypto";
import { encrypt, generateKeyText, decodeBase64 } from "#utils/aes-encrypt.js";
import {
  deriveAesGcmKey,
  encodePayload,
  encryptWithKey,
  getRandomBytes,
} from "#utils/protected-crypto.js";

// The happy-dom global registration may provide a crypto object without
// subtle; password crypto needs the real WebCrypto implementation.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

const LABELS = {
  heading: "Staff area",
  label: "Password",
  submit: "Open",
  loading: "Opening…",
  error: "Wrong password, try again",
};
const PASSWORD = "open sesame";
const SALT = getRandomBytes(16);
const ITERATIONS = 1000;
const PAYLOAD_SELECTOR = "script[data-protected-payload]";
const STORE_KEY = "protected-pages-password";

const EMAIL_KEY_TEXT = generateKeyText();
const EMAIL_KEY_BYTES = decodeBase64(EMAIL_KEY_TEXT);
const MAILTO = "mailto:staff@funpro-uk.test";
const SECRET_HTML = `<h1>Confidential RAMS</h1><a href="#${encrypt(MAILTO, EMAIL_KEY_BYTES)}" data-decrypt-link="">${encrypt("Staff contact", EMAIL_KEY_BYTES)}</a><a href="#protected-file" data-protected-asset="rams.pdf" data-protected-mime="application/pdf">Download RAMS</a>;

let realFetch = globalThis.fetch;
let realCreateObjectURL = URL.createObjectURL;
let clientLoaded = false;

const buildEncryptedPayload = async () => {
  const key = await deriveAesGcmKey(PASSWORD, SALT, ITERATIONS);
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
        <input id="protected-page-password" type="password" name="password" autocomplete="current-password" required>
        <button type="submit" class="button" data-loading-label="${LABELS.loading}">${LABELS.submit}</button>
      </form></div>
      <script type="application/json" data-protected-payload="">${await buildEncryptedPayload()}</script>
    </article></main>
    <script type="module" src="/assets/js/bundle.js" data-decrypt-key="${EMAIL_KEY_TEXT}"></script>`;
  return document.querySelector("article#content");
};

const loadClient = async () => {
  if (!clientLoaded) {
    await import("#public/ui/protected-pages.js");
    clientLoaded = true;
  }
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
  const input = article.querySelector("input[type='password']");
  const button = article.querySelector("button[type='submit']");
  if (passwordValue !== null) input.value = passwordValue;
  button.disabled = false;
  article
    .querySelector("form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
};

describe("protected-pages client", () => {
  test("a stored wrong password fails silently and keeps the gate", async () => {
    window.sessionStorage.setItem(STORE_KEY, "nobody knows");
    const article = await setupProtectedPage();
    await loadClient();

    const gateKept = await waitFor(
      () => article.querySelector("[data-protected-gate]") !== null,
    );
    expect(gateKept).toBe(true);
    expect(article.querySelector(PAYLOAD_SELECTOR)).not.toBeNull();
    expect(article.textContent).not.toContain("Confidential RAMS");
  });

  test("submitting an empty password reserves the gate until input", async () => {
    const article = document.querySelector("article#content");
    await submitGate(article, "");
    const button = article.querySelector("button[type='submit']");
    expect(button.disabled).toBe(false);
    expect(article.querySelector(PAYLOAD_SELECTOR)).not.toBeNull();
  });

  test("a wrong typed password shows the error and keeps the gate", async () => {
    const article = document.querySelector("article#content");
    await submitGate(article, "definitely not it");

    const toasted = await waitFor(() =>
      Boolean(document.querySelector(".toast-notification")),
    );
    expect(toasted).toBe(true);
    expect(document.querySelector(".toast-notification").textContent).toBe(
      LABELS.error,
    );
    expect(article.querySelector("[data-protected-gate]")).not.toBeNull();
    expect(article.textContent).not.toContain("Confidential RAMS");
  });

  test("the correct password decrypts content, assets and mail links", async () => {
    const article = document.querySelector("article#content");
    const assetBytes = new TextEncoder().encode("%PDF-stub");
    const assetKey = await deriveAesGcmKey(PASSWORD, SALT, ITERATIONS);
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

    await submitGate(article, PASSWORD);

    const unlocked = await waitFor(
      () => article.querySelector("h1")?.textContent === "Confidential RAMS",
    );
    expect(unlocked).toBe(true);
    expect(article.querySelector(PAYLOAD_SELECTOR)).toBeNull();
    expect(article.querySelector("[data-protected-gate]")).toBeNull();
    expect(window.sessionStorage.getItem(STORE_KEY)).toBe(PASSWORD);

    const assetLinked = await waitFor(
      () => fetchedUrls.length > 0,
    );
    expect(assetLinked).toBe(true);
    const link = article.querySelector("a[data-protected-asset]");
    expect(fetchedUrls[0]).toBe("/protected-assets/rams.pdf.enc");
    expect(link.getAttribute("href")).toBe("blob:mock-decrypted");

    const mailRestored = await waitFor(
      () =>
        article.querySelector("a[data-decrypt-link]")?.getAttribute("href") ===
        MAILTO,
    );
    expect(mailRestored).toBe(true);
    expect(
      article.querySelector("a[data-decrypt-link]").textContent,
    ).toBe("Staff contact");
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
