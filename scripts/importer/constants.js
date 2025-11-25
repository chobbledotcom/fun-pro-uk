/**
 * Product display order mapping
 * For Fun Pro UK products
 */
const PRODUCT_ORDER = {
  'batak-lite': 1,
  'batak-pro': 2,
  'ballnado-grabber': 3,
  'prize-crane-arcade-grabber': 4,
  'cash-grabber-machine-hire': 5,
  'roll-and-bowl-game-hire': 10,
  'interactive-game-hire': 15
};

/**
 * Find and replace patterns to apply to all generated markdown files
 * Format: { "search": "replacement" }
 *
 * These patterns fix old ASP.NET links to new static site paths
 */
const FIND_REPLACES = {
  // Fix .php.html extensions in markdown links
  ".php.html)": "/)",
  // Fix .html extensions in markdown links (only at end of link, not in frontmatter)
  // Note: We only fix .html) for markdown links and .html# for anchors
  // We don't fix .html" as it would corrupt frontmatter layout values
  ".html)": "/)",
  ".html#": "/#",

  // Fix category paths
  "](../../batak/": "](/products/batak",
  "](../../../batak/": "](/products/batak",
  "](../../interactive-game-hire/": "](/products/",
  "](../../../interactive-game-hire/": "](/products/",
  "](../../arcade-games/": "](/category/arcade-games/",
  "](../../prize-games": "](/category/prize-games",
  "](../../pub-games": "](/category/pub-games",
  "](../../roll-and-bowl": "](/products/roll-and-bowl",
  "](../../fun-days": "](/category/fun-days",
  "](../../corporate-entertainment": "](/products/corporate-entertainment",
  "](../../all-products": "](/all-products",

  // Fix page paths
  "](../../../pages/": "](/pages/",
  "](../../pages/": "](/pages/",
  "](../pages/": "](/pages/",

  // Fix news/blog paths
  "](../../../news/": "](/blog/",
  "](../../news/": "](/blog/",
  "](../news/": "](/blog/",

  // Fix category paths from products
  "](../../category/": "](/category/",
  "](../category/": "](/category/",

  // Fix product paths with old ID structure (e.g., /43/batak-pro.html)
  "/43/": "/",
  "/2/": "/",
  "/4/": "/",
  "/5/": "/",
  "/6/": "/",
  "/7/": "/",
  "/8/": "/",
  "/9/": "/",
  "/10/": "/",
  "/11/": "/",
  "/12/": "/",
  "/13/": "/",
  "/14/": "/",
  "/15/": "/",
  "/16/": "/",
  "/17/": "/",
  "/18/": "/",
  "/19/": "/",
  "/20/": "/",
  "/35/": "/",
  "/39/": "/",
  "/61/": "/",
  "/81/": "/",

  // Fix Controls prefix
  "](../../../Controls/": "](",
  "](../../Controls/": "](",
  "](../Controls/": "](",

  // Fix relative paths starting with ../
  "](../": "](/",

  // Clean up double slashes (but not in https://)
  "](//)": "](/)",

  // Fix mailto and tel links that got corrupted
  "mailto:info@funprouk.co.uk": "mailto:info@funprouk.co.uk",
  "tel:02477220701": "tel:02477220701",
  "tel:+02477220701": "tel:+442477220701"
};

module.exports = {
  PRODUCT_ORDER,
  FIND_REPLACES
};
