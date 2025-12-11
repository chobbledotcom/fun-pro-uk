/**
 * Town/city names used to identify location-based pages
 * If a page filename contains one of these towns, it goes to the locations collection
 */
const LOCATION_TOWNS = [
  'birmingham',
  'bristol',
  'coventry',
  'leicester',
  'london',
  'manchester',
  'milton-keynes',
  'northampton',
  'nottingham',
];

/**
 * Categories that should be imported as "events" instead of "categories"
 * These are event types rather than product categories
 */
const EVENT_CATEGORIES = [
  'staff-wellbeing-days',
  'company-award-ceremonies',
  'circus-skills-workshop',
];

/**
 * Check if a slug/filename represents a location page
 * @param {string} slug - The page slug to check
 * @returns {boolean} True if this is a location page
 */
const isLocationPage = (slug) => {
  return LOCATION_TOWNS.some(town => slug.includes(town));
};

/**
 * Extract town name from a location page slug
 * @param {string} slug - The page slug
 * @returns {string|null} The matched town name or null
 */
const extractTownFromSlug = (slug) => {
  // Sort by length descending to match longer names first (e.g., 'milton-keynes' before 'keynes')
  const sortedTowns = [...LOCATION_TOWNS].sort((a, b) => b.length - a.length);
  return sortedTowns.find(town => slug.includes(town)) || null;
};

/**
 * Strip town name and common words from slug to get the base filename
 * @param {string} slug - The original slug (e.g., 'corporate-event-hire-birmingham')
 * @param {string} town - The town to remove
 * @returns {string} The cleaned slug (e.g., 'corporate-event-hire')
 */
const stripTownFromSlug = (slug, town) => {
  // Remove the town name
  let cleaned = slug.replace(town, '');
  
  // Remove common connector words and clean up dashes
  // Handle patterns like "-in-", "-hire-in-", etc.
  cleaned = cleaned
    .replace(/-in-/g, '-')      // "hire-in-" -> "hire-"
    .replace(/-in$/g, '')       // trailing "-in"
    .replace(/^in-/g, '')       // leading "in-"
    .replace(/--+/g, '-')       // multiple dashes to single
    .replace(/^-+/, '')         // leading dashes
    .replace(/-+$/, '');        // trailing dashes
  
  return cleaned;
};

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
  // Note: .html extensions in markdown links are now handled by fixHtmlLinks() in find-replace.js
  // which uses regex to properly handle [text](path.html "title") patterns

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

  // Convert mailto links to contact page
  "[info@funprouk.co.uk](mailto:info@funprouk.co.uk)": "[contact us](/contact/)",
  "[info@funprouk.com](mailto:info@funprouk.com)": "[contact us](/contact/)",
  "tel:02477220701": "tel:02477220701",
  "tel:+02477220701": "tel:+442477220701"
};

/**
 * Check if a category slug should be imported as an event
 * @param {string} slug - The category slug to check
 * @returns {boolean} True if this should be an event
 */
const isEventCategory = (slug) => {
  return EVENT_CATEGORIES.includes(slug);
};

module.exports = {
  PRODUCT_ORDER,
  FIND_REPLACES,
  LOCATION_TOWNS,
  EVENT_CATEGORIES,
  isLocationPage,
  extractTownFromSlug,
  stripTownFromSlug,
  isEventCategory
};
