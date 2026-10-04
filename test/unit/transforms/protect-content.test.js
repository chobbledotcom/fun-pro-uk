import { describe, expect, test } from "bun:test";
import {
  PROTECTED_TEST_ITERATIONS,
  PROTECTED_TEST_LABELS,
  PROTECTED_TEST_SALT,
} from "#test/protected-pages-fixtures.js";
import { wrapHtml } from "#test/test-utils.js";
import { injectGate, readGateStrings } from "#transforms/protect-content.js";
import { loadDOM } from "#utils/lazy-dom.js";
import {
  decryptPayload,
  deriveAesGcmKey,
  parsePayload,
} from "#utils/protected-crypto.js";

const LABELS = PROTECTED_TEST_LABELS;
const SALT = PROTECTED_TEST_SALT;
const ITERATIONS = PROTECTED_TEST_ITERATIONS;
const INPUT_PATH = "src/pages/rams.md";

const protect = async (body, labels = LABELS, intro) => {
  const key = await deriveAesGcmKey("build password", SALT, ITERATIONS);
  const dom = await loadDOM(wrapHtml(body));
  await injectGate(dom.window.document, {
    key,
    salt: SALT,
    iterations: ITERATIONS,
    labels,
    intro,
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
  return new TextDecoder().decode(await decryptPayload(payload, password));
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
      expect(html).toContain('type="text"');
      expect(html).not.toContain('type="password"');
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
        await protect('<article id="content"><h1>Secret RAMS</h1></article>'),
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

  describe("injectGate with protected_intro", () => {
    test("shows the intro on the gate before the password form", async () => {
      const html = await protect(
        '<article id="content"><p>Secret</p></article>',
        LABELS,
        "Enter the password from your booking confirmation.",
      );

      expect(html).toContain("Enter the password from your booking");
      expect(html.indexOf("protected-intro")).toBeGreaterThan(
        html.indexOf("<h2>Staff area</h2>"),
      );
      expect(html.indexOf("protected-intro")).toBeLessThan(
        html.indexOf("data-protected-form"),
      );
    });

    test("renders intro markdown without allowing raw HTML", async () => {
      const html = await protect(
        '<article id="content"><p>Secret</p></article>',
        LABELS,
        "Bring **your password**\n\n<script>alert(1)</script>",
      );

      expect(html).toContain("<strong>your password</strong>");
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    test("keeps the intro out of the encrypted payload", async () => {
      const decrypted = await decryptContent(
        await protect(
          '<article id="content"><p>Secret</p></article>',
          LABELS,
          "Public intro text",
        ),
      );

      expect(decrypted).toContain("<p>Secret</p>");
      expect(decrypted).not.toContain("Public intro text");
    });

    test("skips the intro element when none is provided", async () => {
      const html = await protect(
        '<article id="content"><p>Secret</p></article>',
      );
      expect(html).not.toContain("protected-intro");
    });

    test("throws when the intro front matter is not text", async () => {
      const gate = protect(
        '<article id="content"><p>Secret</p></article>',
        LABELS,
        42,
      );
      await expect(gate).rejects.toThrow(/protected_intro/);
    });
  });
});
