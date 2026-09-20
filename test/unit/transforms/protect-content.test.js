import { describe, expect, test } from "bun:test";
import { webcrypto } from "node:crypto";
import { injectGate, readGateStrings } from "#transforms/protect-content.js";
import { wrapHtml } from "#test/test-utils.js";
import { loadDOM } from "#utils/lazy-dom.js";
import {
  decryptWithKey,
  deriveAesGcmKey,
  getRandomBytes,
  parsePayload,
} from "#utils/protected-crypto.js";

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
  error: "Wrong password",
};
const SALT = getRandomBytes(16);
const ITERATIONS = 1000;
const INPUT_PATH = "src/pages/rams.md";

const protect = async (body, labels = LABELS) => {
  const key = await deriveAesGcmKey("build password", SALT, ITERATIONS);
  const dom = await loadDOM(wrapHtml(body));
  await injectGate(dom.window.document, {
    key,
    salt: SALT,
    iterations: ITERATIONS,
    labels,
    inputPath: INPUT_PATH,
  });
  return dom.serialize();
};

const decryptContent = async (gateHtml, password = "build password") => {
  const dom = await loadDOM(gateHtml);
  const payload = parsePayload(
    dom.window.document.querySelector("script[data-protected-payload]")
      .textContent,
  );
  const key = await deriveAesGcmKey(password, payload.salt, payload.iterations);
  return new TextDecoder().decode(
    await decryptWithKey(key, payload.iv, payload.ct),
  );
};

describe("protect-content", () => {
  describe("readGateStrings", () => {
    test("extracts the protected_pages labels", () => {
      expect(readGateStrings({ protected_pages: LABELS })).toEqual(LABELS);
    });

    test("throws when the strings section is missing", () => {
      expect(() => readGateStrings({})).toThrow(/protected_pages/);
    });

    test("throws when a label is missing or empty", () => {
      const incomplete = { ...LABELS, submit: "" };
      expect(() => readGateStrings({ protected_pages: incomplete })).toThrow(
        /submit/,
      );
    });
  });

  describe("injectGate", () => {
    test("replaces the article content with gate and encrypted payload", async () => {
      const html = await protect(
        '<article id="content"><h1>Secret RAMS</h1><p>Confidential</p></article>',
      );

      expect(html).not.toContain("Secret RAMS");
      expect(html).not.toContain("Confidential");
      expect(html).toContain("data-protected-gate");
      expect(html).toContain("data-protected-form");
      expect(html).toContain(`data-error-label="${LABELS.error}"`);
      expect(html).toContain('type="password"');
      expect(html).toContain("<h2>Staff area</h2>");
      expect(html).toContain(`data-loading-label="${LABELS.loading}"`);
      expect(html).toContain('<script type="application/json"');
      expect(html).toContain("data-protected-payload");
    });

    test("produces a payload that decrypts back to the original markup", async () => {
      const original =
        '<article id="content"><h1>Secret RAMS</h1><p>Line one</p></article>';
      const decrypted = await decryptContent(await protect(original));

      expect(decrypted).toContain("<h1>Secret RAMS</h1>");
      expect(decrypted).toContain("<p>Line one</p>");
    });

    test("fails authentication for the wrong password", async () => {
      const attempt = decryptContent(
        await protect(
          '<article id="content"><h1>Secret RAMS</h1></article>',
        ),
        "nope",
      );
      await expect(attempt).rejects.toThrow();
    });

    test("marks the page noindex for search engines", async () => {
      const html = await protect(
        '<article id="content"><p>Secret</p></article>',
      );
      expect(html).toMatch(
        /<meta name="robots" content="noindex, nofollow".*>/,
      );
    });

    test("hardens an existing robots meta instead of adding a second one", async () => {
      const html = await protect(
        `<head><meta name="robots" content="index"></head>
          <article id="content"><p>Secret</p></article>`,
      );
      const robotsMatches = html.match(/<meta name="robots"/g) || [];
      expect(robotsMatches.length).toBe(1);
      expect(html).toContain('content="noindex, nofollow"');
    });

    test("throws a helpful error when the layout has no content article", async () => {
      const gate = protect("<div>No article here</div>");
      await expect(gate).rejects.toThrow(/article id="content"/);
      await expect(gate).rejects.toThrow(INPUT_PATH);
    });

    test("throws when the page content is empty", async () => {
      const gate = protect('<article id="content"></article>');
      await expect(gate).rejects.toThrow(/content is empty/);
    });
  });
});
