import { describe, expect, test } from "bun:test";
import { withTestSite } from "#test/test-site-factory.js";

const CHRISTMAS_CATEGORY_URL = "/categories/christmas-game-hire/";
const MENU_IMAGES = [
  "events/corporate-events.jpg",
  "events/celebrations-and-parties.jpg",
  "events/educational-and-community.jpg",
  "products/retro-arcade-games/retro-arcade-games-1.jpg",
  "products/prize-wheel/prize-wheel-1.jpg",
  "products/shuffleboard-hire/shuffleboard-hire-1.jpg",
  "products/cash-grabber-machine-hire/cash-grabber-machine-hire-5.jpg",
  "products/batak-pro/batak-pro-6.jpg",
  "products/roll-and-bowl-donkey-derby/roll-and-bowl-donkey-derby-5.jpg",
  "products/hook-a-duck/hook-a-duck-1.jpg",
  "products/ice-cream-van-hire/ice-cream-van-hire-1.jpg",
  "products/christmas-grotto-1/christmas-grotto-1-1.jpg",
  "products/christmas-photo-booths/christmas-photo-booths-1.jpg",
  "products/magic-mirror/magic-mirror-3.jpg",
  "products/inflatable-assault-courses/inflatable-assault-courses-1.jpg",
  "home/about-us-right.png",
];

describe("mega menu", () => {
  test("Christmas category is available in responsive product navigation", async () => {
    await withTestSite({ images: MENU_IMAGES }, async (site) => {
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
