import { describe, expect, test } from "bun:test";
import { withTestSite } from "#test/test-site-factory.js";

const CHRISTMAS_CATEGORY_URL = "/categories/christmas-game-hire/";

describe("mega menu", () => {
  test("Christmas category is available in responsive product navigation", async () => {
    // The shared nav images every test site needs are copied by the factory.
    await withTestSite({}, async (site) => {
      const doc = await site.getDoc("/index.html");
      const desktopLink = doc.querySelector(
        `#main-nav .mn-grid a[href="${CHRISTMAS_CATEGORY_URL}"]`,
      );
      const mobileLink = doc.querySelector(
        `#mobileNav a[href="${CHRISTMAS_CATEGORY_URL}"]`,
      );

      expect(desktopLink?.textContent.trim()).toBe("Christmas Game Hire");
      expect(mobileLink?.textContent.trim()).toBe("Christmas Game Hire");
    });
  });
});
