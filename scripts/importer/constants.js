/**
 * Thumbnails for event pages (sourced from Pexels, free license)
 * Maps event slug to image path
 */
const EVENT_THUMBNAILS = {
  "brand-activation": "/images/events/brand-activation.jpg",
  "celebrations-and-parties": "/images/events/celebrations-and-parties.jpg",
  "christmas-entertainment": "/images/events/christmas-entertainment.jpg",
  "circus-skills-workshop": "/images/events/circus-skills-workshop.jpg",
  "college-entertainment": "/images/events/college-entertainment.jpg",
  "company-award-ceremonies": "/images/events/company-award-ceremonies.jpg",
  "conference-idea": "/images/events/conference-idea.jpg",
  "corporate-events": "/images/events/corporate-events.jpg",
  "educational-and-community": "/images/events/educational-and-community.jpg",
  "evening-entertainment": "/images/events/evening-entertainment.jpg",
  "exhibition-games": "/images/events/exhibition-games.jpg",
  "family-fun-days": "/images/events/family-fun-days.jpg",
  "fundraising-events": "/images/events/fundraising-events.jpg",
  "office-entertainment": "/images/events/office-entertainment.jpg",
  "school-entertainment": "/images/events/school-entertainment.jpg",
  "staff-wellbeing-days": "/images/events/staff-wellbeing-days.jpg",
  "summer-entertainment": "/images/events/summer-entertainment.jpg",
  "university-events": "/images/events/university-events.jpg",
};

/**
 * Town/city names used to identify location-based pages
 * If a page filename contains one of these towns, it goes to the locations collection
 */
const LOCATION_TOWNS = [
  "birmingham",
  "bristol",
  "coventry",
  "leeds",
  "leicester",
  "london",
  "manchester",
  "milton-keynes",
  "northampton",
  "nottingham",
  "sheffield",
];

/**
 * Categories that should be imported as "events" instead of "categories"
 * These are event types rather than product categories
 */
const EVENT_CATEGORIES = [
  "staff-wellbeing-days",
  "company-award-ceremonies",
  "circus-skills-workshop",
];

/**
 * Pages (from /pages/ directory) that should be imported as "events" instead of regular pages
 * These pages have product listings and represent event types
 */
const EVENT_PAGES = [
  "conference-idea",
  "branded-game-hire", // becomes brand-activation event
  "christmas-entertainment-game-hire", // becomes christmas-entertainment event
];

/**
 * Nested event category structure for navigation
 * Parent categories are displayed as dropdown headers
 * Child events are displayed as links under each parent
 *
 * Structure:
 * - slug: URL slug for the parent category (also used as eleventyNavigation key for children)
 * - title: Display name for navigation and page title
 * - oldSiteSlug: Slug from old site pages (if exists), or null for placeholder
 * - children: Array of child events with their own slugs and titles
 */
const EVENT_HIERARCHY = [
  {
    slug: "corporate-events",
    title: "Corporate Events",
    oldSiteSlug: "corporate-events",
    sourceType: "pages",
    order: 1,
    children: [
      // Keep original slugs to preserve existing content
      {
        slug: "company-award-ceremonies",
        title: "Award Ceremonies",
        oldSiteSlug: "company-award-ceremonies",
        sourceType: "category",
        order: 1,
      },
      {
        slug: "exhibition-games",
        title: "Exhibition Games",
        oldSiteSlug: "exhibition-game-hire",
        sourceType: "pages",
        order: 2,
      },
      {
        slug: "office-entertainment",
        title: "Office Entertainment",
        oldSiteSlug: "office-entertainment",
        sourceType: "pages",
        order: 3,
      },
      {
        slug: "staff-wellbeing-days",
        title: "Corporate Wellbeing Days",
        oldSiteSlug: "staff-wellbeing-days",
        sourceType: "category",
        order: 4,
      },
      {
        slug: "conference-idea",
        title: "Conference Production",
        oldSiteSlug: "conference-idea",
        sourceType: "pages",
        order: 5,
      },
    ],
  },
  {
    slug: "celebrations-and-parties",
    title: "Celebrations & Parties",
    oldSiteSlug: "celebrations-and-parties",
    sourceType: "pages",
    order: 2,
    children: [
      {
        slug: "summer-entertainment",
        title: "Summer Entertainment",
        oldSiteSlug: "summer-entertainment",
        sourceType: "pages",
        order: 2,
      },
      {
        slug: "evening-entertainment",
        title: "Evening Entertainment",
        oldSiteSlug: "evening-entertainment",
        sourceType: "pages",
        order: 3,
      },
    ],
  },
  {
    slug: "educational-and-community",
    title: "Educational & Community",
    oldSiteSlug: "educational-and-community",
    sourceType: "pages",
    order: 3,
    children: [
      {
        slug: "university-events",
        title: "University Events",
        oldSiteSlug: null,
        sourceType: null,
        order: 1,
      },
      {
        slug: "college-entertainment",
        title: "College Entertainment",
        oldSiteSlug: "college-and-university-entertainment",
        sourceType: "pages",
        order: 2,
      },
      {
        slug: "family-fun-days",
        title: "Family Fun Days",
        oldSiteSlug: "family-fun-day-entertainment",
        sourceType: "pages",
        order: 3,
      },
      {
        slug: "school-entertainment",
        title: "School Entertainment",
        oldSiteSlug: "school-fun-day-entertainment-hire",
        sourceType: "pages",
        order: 4,
      },
      {
        slug: "fundraising-events",
        title: "Fundraising Events",
        oldSiteSlug: "fundraising-event-ideas",
        sourceType: "pages",
        order: 5,
      },
      {
        slug: "circus-skills-workshop",
        title: "Circus Skills Workshop",
        oldSiteSlug: "circus-skills-workshop",
        sourceType: "category",
        order: 6,
      },
    ],
  },
  // "How We Help" events - these use a different navigation parent
  {
    slug: "how-we-help-events",
    title: "How We Help",
    oldSiteSlug: null, // No page for the parent itself
    sourceType: null,
    navParent: "How We Help", // Custom nav parent instead of "Event Type"
    skipParentPage: true, // Don't generate a page for this parent
    order: 4,
    children: [
      {
        slug: "brand-activation",
        title: "Brand Activation",
        oldSiteSlug: "branded-game-hire",
        sourceType: "pages",
        navParent: "How We Help",
        order: 5,
      },
      {
        slug: "christmas-entertainment",
        title: "Christmas Entertainment",
        oldSiteSlug: "christmas-entertainment-game-hire",
        sourceType: "pages",
        navParent: "How We Help",
        order: 6,
      },
    ],
  },
];

/**
 * Get all event slugs from the hierarchy (both parents and children)
 * Used to filter which pages should be treated as events
 * @returns {Object} Object with allSlugs, parentSlugs, childSlugs arrays
 */
const getEventSlugsFromHierarchy = () => {
  const parentSlugs = [];
  const childSlugs = [];
  const oldSiteSlugMap = {}; // Maps oldSiteSlug -> new slug

  for (const parent of EVENT_HIERARCHY) {
    parentSlugs.push(parent.slug);
    if (parent.oldSiteSlug) {
      oldSiteSlugMap[parent.oldSiteSlug] = parent.slug;
    }

    for (const child of parent.children) {
      childSlugs.push(child.slug);
      if (child.oldSiteSlug) {
        oldSiteSlugMap[child.oldSiteSlug] = child.slug;
      }
    }
  }

  return {
    allSlugs: [...parentSlugs, ...childSlugs],
    parentSlugs,
    childSlugs,
    oldSiteSlugMap,
  };
};

/**
 * Find event info from hierarchy by new slug or old site slug
 * @param {string} slug - Either the new slug or old site slug
 * @returns {Object|null} Event info with parent reference, or null if not found
 */
const findEventInHierarchy = (slug) => {
  for (const parent of EVENT_HIERARCHY) {
    // Check if this is a parent category
    if (parent.slug === slug || parent.oldSiteSlug === slug) {
      return {
        ...parent,
        isParent: true,
        parentSlug: null,
        parentTitle: null,
        additionalRedirects: parent.additionalRedirects || [],
      };
    }

    // Check children
    for (const child of parent.children) {
      if (child.slug === slug || child.oldSiteSlug === slug) {
        return {
          ...child,
          isParent: false,
          parentSlug: parent.slug,
          parentTitle: parent.title,
          additionalRedirects: child.additionalRedirects || [],
        };
      }
    }
  }

  return null;
};

/**
 * Check if a slug/filename represents a location page
 * @param {string} slug - The page slug to check
 * @returns {boolean} True if this is a location page
 */
const isLocationPage = (slug) => {
  return LOCATION_TOWNS.some((town) => slug.includes(town));
};

/**
 * Extract town name from a location page slug
 * @param {string} slug - The page slug
 * @returns {string|null} The matched town name or null
 */
const extractTownFromSlug = (slug) => {
  // Sort by length descending to match longer names first (e.g., 'milton-keynes' before 'keynes')
  const sortedTowns = [...LOCATION_TOWNS].sort((a, b) => b.length - a.length);
  return sortedTowns.find((town) => slug.includes(town)) || null;
};

/**
 * Strip town name and common words from slug to get the base filename
 * @param {string} slug - The original slug (e.g., 'corporate-event-hire-birmingham')
 * @param {string} town - The town to remove
 * @returns {string} The cleaned slug (e.g., 'corporate-event-hire')
 */
const stripTownFromSlug = (slug, town) => {
  // Remove the town name
  let cleaned = slug.replace(town, "");

  // Remove common connector words and clean up dashes
  // Handle patterns like "-in-", "-hire-in-", etc.
  cleaned = cleaned
    .replace(/-in-/g, "-") // "hire-in-" -> "hire-"
    .replace(/-in$/g, "") // trailing "-in"
    .replace(/^in-/g, "") // leading "in-"
    .replace(/--+/g, "-") // multiple dashes to single
    .replace(/^-+/, "") // leading dashes
    .replace(/-+$/, ""); // trailing dashes

  return cleaned;
};

/**
 * New navigation structure for the site
 * This replaces the extracted navigation from old site HTML
 */
const NAVIGATION_STRUCTURE = {
  // Top-level navigation items
  topLevel: [
    { key: "Home", order: 1, isDropdown: false },
    { key: "How we help", order: 2, isDropdown: true },
    { key: "What's your event?", order: 3, isDropdown: true },
    { key: "Entertainment hire", order: 4, isDropdown: true },
    { key: "About us", order: 5, isDropdown: true },
    { key: "News", order: 5, isDropdown: false },
  ],

  // Dropdown children
  dropdowns: {
    "How We Help": [
      {
        slug: "corporate-entertainment",
        text: "Corporate Entertainment",
        order: 1,
        type: "category",
      },
      {
        slug: "wedding-entertainment",
        text: "Luxury Wedding Entertainment",
        order: 2,
        type: "page",
      },
      {
        slug: "team-building-ideas",
        text: "Team Building Activities",
        order: 3,
        type: "page",
      },
      {
        slug: "event-management",
        text: "Event Management",
        order: 4,
        type: "page",
      },
      {
        slug: "brand-activation",
        text: "Brand Activation",
        order: 5,
        type: "event",
      },
      {
        slug: "christmas-entertainment",
        text: "Christmas Entertainment",
        order: 6,
        type: "event",
      },
    ],

    "What's your event?": [
      // Parent events
      {
        slug: "corporate-events",
        text: "Corporate Events",
        order: 1,
        type: "event",
      },
      {
        slug: "celebrations-and-parties",
        text: "Celebrations & Parties",
        order: 2,
        type: "event",
      },
      {
        slug: "educational-and-community",
        text: "Educational & Community",
        order: 3,
        type: "event",
      },
    ],

    "Entertainment Hire": [
      {
        slug: "arcade-games",
        text: "Arcade Games",
        order: 1,
        type: "category",
      },
      { slug: "prize-games", text: "Prize Games", order: 2, type: "category" },
      { slug: "pub-games", text: "Pub Games", order: 3, type: "category" },
      {
        slug: "grab-a-grand",
        text: "Grab A Grand",
        order: 4,
        type: "category",
      },
      { slug: "batak", text: "Batak", order: 5, type: "category" },
      {
        slug: "roll-and-bowl",
        text: "Roll & Bowl",
        order: 6,
        type: "category",
      },
      {
        slug: "fun-fair-stalls",
        text: "Fun Fair Stalls",
        order: 7,
        type: "category",
      },
      { slug: "fun-foods", text: "Fun Foods", order: 8, type: "category" },
      {
        slug: "christmas-grotto-hire",
        text: "Christmas Grotto Hire",
        order: 9,
        type: "category",
      },
      {
        slug: "circus-skills-workshop",
        text: "Circus Skills Workshop",
        order: 10,
        type: "category",
      },
      {
        slug: "photo-booths-and-magic-mirrors",
        text: "Photo Booths & Magic Mirrors",
        order: 11,
        type: "category",
      },
      {
        slug: "christmas-games",
        text: "Christmas Games",
        order: 12,
        type: "category",
      },
    ],

    "About Us": [
      { slug: "our-story", text: "Our Story", order: 1, type: "page" },
      { slug: "meet-the-team", text: "Meet the Team", order: 2, type: "page" },
      {
        slug: "delivery-areas",
        text: "Coverage Areas",
        order: 3,
        type: "page",
      },
      {
        slug: "safety-and-insurance",
        text: "Safety & Insurance",
        order: 4,
        type: "page",
      },
      { slug: "case-studies", text: "Case Studies", order: 5, type: "page" },
      { slug: "news", text: "News", order: 6, type: "page" },
    ],
  },
};

/**
 * Mapping for old site slugs to new navigation items
 * Handles cases where the slug on old site differs from the new slug
 */
const OLD_SLUG_TO_NEW = {
  // Keep about-corporate-entertainment-hire.md with original name (add redirect to our-story if needed)
  // Keep team-building-ideas.md with original name (no rename)
};

/**
 * Product display order mapping
 * For Fun Pro UK products
 */
const PRODUCT_ORDER = {
  "batak-lite": 1,
  "batak-pro": 2,
  "ballnado-grabber": 3,
  "prize-crane-arcade-grabber": 4,
  "cash-grabber-machine-hire": 5,
  "roll-and-bowl-game-hire": 10,
  "interactive-game-hire": 15,
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

  // Fix mailto and tel links that got corrupted
  "mailto:info@funprouk.co.uk": "mailto:info@funprouk.co.uk",
  "tel:02477220701": "tel:02477220701",
  "tel:+02477220701": "tel:+442477220701",

  // Fix contact page link
  "](/contact/)": "](/contact-fun-pro-uk/)",

  // Fix broken links to non-existent products (link to category instead)
  // These need to match the full path as it appears after other transforms
  "/category/arcade-games/2/lights-out-game/": "/categories/arcade-games/",
  "/category/interactive-game-hire/2/lights-out-game/":
    "/categories/interactive-game-hire/",
  "/arcade-games/lights-out-game/": "/categories/arcade-games/",
  "/interactive-game-hire/lights-out-game/":
    "/categories/interactive-game-hire/",
};

/**
 * Check if a category slug should be imported as an event
 * @param {string} slug - The category slug to check
 * @returns {boolean} True if this should be an event
 */
const isEventCategory = (slug) => {
  return EVENT_CATEGORIES.includes(slug);
};

/**
 * Check if a page slug should be imported as an event
 * Checks both EVENT_PAGES list and EVENT_HIERARCHY oldSiteSlug values
 * @param {string} slug - The page slug to check
 * @returns {boolean} True if this should be an event
 */
const isEventPage = (slug) => {
  // Check the legacy EVENT_PAGES list
  if (EVENT_PAGES.includes(slug)) {
    return true;
  }

  // Check if slug matches any oldSiteSlug in the hierarchy
  for (const parent of EVENT_HIERARCHY) {
    if (parent.oldSiteSlug === slug) {
      return true;
    }
    for (const child of parent.children) {
      if (child.oldSiteSlug === slug) {
        return true;
      }
    }
  }

  return false;
};

module.exports = {
  PRODUCT_ORDER,
  FIND_REPLACES,
  LOCATION_TOWNS,
  EVENT_CATEGORIES,
  EVENT_PAGES,
  EVENT_HIERARCHY,
  EVENT_THUMBNAILS,
  NAVIGATION_STRUCTURE,
  OLD_SLUG_TO_NEW,
  isLocationPage,
  extractTownFromSlug,
  stripTownFromSlug,
  isEventCategory,
  isEventPage,
  getEventSlugsFromHierarchy,
  findEventInHierarchy,
};
