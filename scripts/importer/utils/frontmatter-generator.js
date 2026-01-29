const fs = require("fs");
const path = require("path");
const { PRODUCT_ORDER, EVENT_THUMBNAILS } = require("../constants");
const config = require("../config");

/**
 * Configuration for page-specific layouts and overrides
 * Navigation is now dynamically extracted from the old site
 */
const PAGE_CONFIG = {
  contact: {
    layout: "contact.html",
  },
  "contact-fun-pro-uk": {
    layout: "contact.html",
  },
  reviews: {
    layout: "reviews.html",
  },
  "delivery-areas": {
    layout: "locations",
  },
  testimonials: {
    layout: "reviews.html",
  },
  "event-type": {
    layout: "events",
    rename: "events",
  },
  "team-building-ideas": {
    subtitle: "Subtitle subtitle subtitle subtitle subtitle",
  },
  "event-management": {
    subtitle: "Subtitle subtitle subtitle subtitle subtitle",
  },
};

/**
 * Generate frontmatter for page content
 * Old URL: /pages/{slug}/ (for most pages)
 * New URL: /{slug}/ (at root, dynamically calculated from filename in pages collection)
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Page slug
 * @param {string} pageHeading - The H1 heading from page content
 * @param {Object} navInfo - Navigation info from extractNavigationFromHtml (optional)
 * @returns {string|Object} Frontmatter YAML, or { frontmatter, filename } if renamed
 */
const generatePageFrontmatter = (
  metadata,
  slug,
  pageHeading = null,
  navInfo = null,
) => {
  const { OLD_SLUG_TO_NEW } = require("../constants");
  const pageConfig = PAGE_CONFIG[slug] || {};
  const layout = pageConfig.layout || "page";
  const newSlug = pageConfig.rename || OLD_SLUG_TO_NEW[slug] || slug;

  // Pages that were already at root level on the old site don't need redirects
  const rootPages = ["contact", "reviews", "delivery-areas", "testimonials"];
  const needsRedirect = !rootPages.includes(slug);

  // No permalink - let it be dynamically calculated from file location
  // Pages collection will put them at /{slug}/
  let frontmatter = `---
meta_title: "${metadata.title || ""}"
meta_description: "${metadata.meta_description || ""}"
layout: ${layout}`;

  // Add subtitle if configured for this page
  if (pageConfig.subtitle) {
    frontmatter += `\nsubtitle: "${pageConfig.subtitle}"`;
  }

  // Add redirect_from for old /pages/ URLs
  // If renamed, also add redirect from the old slug at root level
  if (needsRedirect || pageConfig.rename) {
    const redirects = [];
    if (needsRedirect) {
      redirects.push(`/pages/${slug}/`);
    }
    // If renamed, add redirect from the old slug at root level
    if (pageConfig.rename) {
      redirects.push(`/${slug}/`);
    }
    frontmatter += `\nredirect_from:`;
    for (const redirect of redirects) {
      frontmatter += `\n  - "${redirect}"`;
    }
  }

  // Add navigation if extracted from old site
  if (navInfo) {
    // Use the link text from navigation as the key if available, otherwise use title or slug
    const navKey = navInfo.text || metadata.title || slug.replace(/-/g, " ");
    frontmatter += `
eleventyNavigation:
  key: "${escapeYamlString(navKey)}"`;
    // Only add parent if this is NOT a top-level item
    if (navInfo.parent) {
      frontmatter += `
  parent: "${escapeYamlString(navInfo.parent)}"`;
    }
    frontmatter += `
  order: ${navInfo.order}`;
  }

  frontmatter += "\n---";

  // If page is renamed, return object with custom filename
  if (pageConfig.rename) {
    return {
      frontmatter,
      filename: `${newSlug}.md`,
    };
  }

  return frontmatter;
};

/**
 * Escape special characters for YAML strings
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeYamlString = (str) => {
  if (!str) return "";
  return str.replace(/"/g, '\\"');
};

/**
 * Format FAQs as YAML for frontmatter
 * Uses literal block scalar (|) for multi-line answers to preserve paragraph breaks
 * @param {Array<Object>} faqs - FAQs array with question and answer properties
 * @returns {string} YAML formatted FAQs string (without leading newline)
 */
const formatFaqsYaml = (faqs) => {
  if (!faqs || faqs.length === 0) return "";

  let yaml = "faqs:";
  for (const faq of faqs) {
    const q = faq.question.replace(/"/g, '\\"');
    const answer = faq.answer || "";
    const isMultiLine = answer.includes("\n");

    yaml += `\n  - question: "${q}"`;

    if (isMultiLine) {
      // Use literal block scalar for multi-line answers
      // Indent each line by 6 spaces (2 for list, 4 for answer property)
      const indentedAnswer = answer
        .split("\n")
        .map((line) => "      " + line)
        .join("\n");
      yaml += `\n    answer: |\n${indentedAnswer}`;
    } else {
      // Single line - use quoted string
      const a = answer.replace(/"/g, '\\"');
      yaml += `\n    answer: "${a}"`;
    }
  }
  return yaml;
};

/**
 * Simple hash function to get a deterministic number from a string
 * Used for consistently assigning authors to blog posts
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Get a random author for blog posts based on slug
 * Uses deterministic hashing so the same post always gets the same author
 * @param {string} slug - Post slug to use as seed
 * @returns {string} Author path (e.g., "team/colin.md" or "team/liz.md")
 */
const getRandomAuthor = (slug) => {
  const authors = ["team/colin.md", "team/liz.md"];
  const index = simpleHash(slug) % authors.length;
  return authors[index];
};

/**
 * Generate frontmatter for blog/news content
 * Old URL: /news/{date}/{slug}/ (e.g., /news/2017-11-19/christmas-parties-are-go/)
 * New URL: dynamically calculated from file path (e.g., /news/2017-11-19-christmas-parties-are-go/)
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Post slug
 * @param {string} date - Post date
 * @param {string} blogHeading - The H1 heading from blog post content
 * @param {string} localImagePath - Local path to downloaded image
 * @returns {string} Frontmatter YAML
 */
const generateBlogFrontmatter = (
  metadata,
  slug,
  date,
  blogHeading = null,
  localImagePath = null,
  subtitle = null,
) => {
  // Use H1 heading for the post title (not the meta title from <title> tag)
  const postTitle =
    blogHeading || metadata.header_text || slug.replace(/-/g, " ");
  const author = getRandomAuthor(slug);

  // Old URL from the old site
  const oldUrl = `/news/${date}/${slug}/`;
  // New URL will be dynamically calculated: /news/{date}-{slug}/ (based on filename)
  const newUrl = `/news/${date}-${slug}/`;

  let frontmatter = `---
title: "${postTitle}"
subtitle: "${subtitle || ""}"
date: ${date}
author: "${author}"
meta_title: "${metadata.title || ""}"
meta_description: "${metadata.meta_description || ""}"`;

  // Add redirect_from if old URL differs from new URL
  if (oldUrl !== newUrl) {
    frontmatter += `\nredirect_from:\n  - "${oldUrl}"`;
  }

  // Add gallery with the downloaded image
  if (localImagePath) {
    frontmatter += `\ngallery:\n  - "${localImagePath}"`;
  }

  frontmatter += "\n---";
  return frontmatter;
};

/**
 * Format tabs as YAML for frontmatter
 * Uses literal block scalar (|) for multi-line body content
 * @param {Array<Object>} tabs - Tabs array with title, body, and optional image properties
 * @returns {string} YAML formatted tabs string (without leading newline)
 */
const formatTabsYaml = (tabs) => {
  if (!tabs || tabs.length === 0) return "";

  let yaml = "tabs:";
  for (const tab of tabs) {
    const title = (tab.title || "").replace(/"/g, '\\"');
    const body = tab.body || "";
    const image = tab.image || "";

    yaml += `\n  - title: "${title}"`;

    // Add image if present
    if (image) {
      yaml += `\n    image: "${image}"`;
    }

    // Always use literal block scalar for body content to preserve formatting
    // Indent each line by 4 spaces (2 for list item, 2 for body property content)
    const indentedBody = body
      .split("\n")
      .map((line) => "      " + line)
      .join("\n");
    yaml += `\n    body: |\n${indentedBody}`;
  }
  return yaml;
};

/**
 * Generate frontmatter for product content
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Product slug
 * @param {string} price - Product price
 * @param {string[]|string} categories - Product categories (array or single string)
 * @param {string} productName - Product name
 * @param {Object} images - Product images with local paths
 * @param {string} productHeading - The H1 heading from product content
 * @param {string[]} events - Product events (array of event paths)
 * @param {string} oldSitePath - Path from old site (e.g., "arcade-games/106/electronic-dart-board.html")
 * @param {Array<Object>} faqs - FAQs array with question and answer properties
 * @param {string} bodyContent - Markdown body content to include as a tab
 * @param {Object} multiDayPrices - Multi-day hire prices (price_2_days, price_3_days, etc.)
 * @param {Object} specs - Extracted specs (players, space_required, power, setup_time)
 * @param {Object} brandingPrices - Branding prices add-ons {intro, options: [{name, price}]}
 * @returns {string} Frontmatter YAML
 */
const generateProductFrontmatter = (
  metadata,
  slug,
  price,
  categories,
  productName,
  images = null,
  productHeading = null,
  events = [],
  oldSitePath = null,
  faqs = [],
  bodyContent = "",
  multiDayPrices = {},
  specs = {},
  brandingPrices = {},
) => {
  // Ensure categories is an array
  const categoryArray = Array.isArray(categories)
    ? categories
    : categories
      ? [categories]
      : [];
  const categoriesYaml =
    categoryArray.length > 0
      ? `[${categoryArray.map((c) => `"${c}"`).join(", ")}]`
      : "[]";

  // Ensure events is an array
  const eventsArray = Array.isArray(events) ? events : events ? [events] : [];
  const eventsYaml =
    eventsArray.length > 0
      ? `[${eventsArray.map((e) => `"${e}"`).join(", ")}]`
      : "[]";

  // Get product order, default to 50 if not in mapping
  const productOrder = PRODUCT_ORDER[slug] || 50;

  // Parse numeric price from string like "£395" -> 395
  const numericPrice = parseFloat((price || "0").replace(/[^0-9.]/g, "")) || 0;

  // Build options array with multi-day pricing
  const optionName = productName || metadata.title || "";
  const options = [];

  // Add base 1-day option
  options.push({
    name: "1 Day",
    unit_price: numericPrice,
    days: 1,
  });

  // Add multi-day options if available
  if (multiDayPrices.price_2_days) {
    const price2 =
      parseFloat(multiDayPrices.price_2_days.replace(/[^0-9.]/g, "")) || 0;
    options.push({ name: "2 Days", unit_price: price2, days: 2 });
  }
  if (multiDayPrices.price_3_days) {
    const price3 =
      parseFloat(multiDayPrices.price_3_days.replace(/[^0-9.]/g, "")) || 0;
    options.push({ name: "3 Days", unit_price: price3, days: 3 });
  }
  if (multiDayPrices.price_4_days) {
    const price4 =
      parseFloat(multiDayPrices.price_4_days.replace(/[^0-9.]/g, "")) || 0;
    options.push({ name: "4 Days", unit_price: price4, days: 4 });
  }
  if (multiDayPrices.price_5_days) {
    const price5 =
      parseFloat(multiDayPrices.price_5_days.replace(/[^0-9.]/g, "")) || 0;
    options.push({ name: "5 Days", unit_price: price5, days: 5 });
  }
  if (multiDayPrices.price_7_days) {
    const price7 =
      parseFloat(multiDayPrices.price_7_days.replace(/[^0-9.]/g, "")) || 0;
    options.push({ name: "7 Days", unit_price: price7, days: 7 });
  }

  // Generate options YAML
  const optionsYaml = options
    .map(
      (opt) =>
        `  - name: "${opt.name}"\n    unit_price: ${opt.unit_price}\n    days: ${opt.days}`,
    )
    .join("\n");

  // Use extracted specs or fall back to TBD
  const playersValue = specs.players || "TBD";
  const spaceValue = specs.space_required || "TBD";
  const powerValue = specs.power || "TBD";
  const setupValue = specs.setup_time || "TBD";
  const equipmentValue = specs.equipment_size || "TBD";
  const suitabilityValue = specs.suitability || "TBD";
  const accessValue = specs.access || "TBD";

  // Base frontmatter - no permalink, let it be dynamically calculated
  let frontmatter = `---
title: "${productName || metadata.title || ""}"
subtitle: "Subtitle subtitle subtitle subtitle subtitle subtitle"
price: "${price}"
order: ${productOrder}
meta_title: "${metadata.title || ""}"
meta_description: "${metadata.meta_description || ""}"
categories: ${categoriesYaml}
events: ${eventsYaml}
featured: true
features:
  - "Delivery, setup, and collection included"
  - "Public liability insurance included"
  - "Custom branding options available"
specs:
  - name: "Players"
    value: "${playersValue}"
  - name: "Space Required"
    value: "${spaceValue}"
  - name: "Power"
    value: "${powerValue}"
  - name: "Setup time"
    value: "${setupValue}"
  - name: "Equipment Size"
    value: "${equipmentValue}"
  - name: "Suitability"
    value: "${suitabilityValue}"
  - name: "Access"
    value: "${accessValue}"
filter_attributes:
  - name: "Guest Capacity"
    value: "TBD"
  - name: "Game Length"
    value: "TBD"
  - name: "Power Required"
    value: "TBD"${playersValue !== "TBD" ? `
  - name: "Player Count"
    value: "${playersValue}"` : ""}
options:
${optionsYaml}`;

  // Add redirect_from for old site URL
  if (oldSitePath) {
    const oldUrl = `/category/${oldSitePath.replace(/\.html$/, "").replace(/\\/g, "/")}/`;
    frontmatter += `\nredirect_from:\n  - "${oldUrl}"`;
  }

  // Preserve existing gallery (local paths managed by another script)
  if (images?.existingGallery && images.existingGallery.length > 0) {
    const galleryYaml = images.existingGallery
      .map((img) => `  - "${img}"`)
      .join("\n");
    frontmatter += `\ngallery:\n${galleryYaml}`;
  }

  // Add gallery_cloudinary with Cloudinary URLs from old site
  if (images?.gallery_cloudinary && images.gallery_cloudinary.length > 0) {
    const galleryYaml = images.gallery_cloudinary
      .map((img) => `  - "${img}"`)
      .join("\n");
    frontmatter += `\ngallery_cloudinary:\n${galleryYaml}`;
  }

  // Add FAQs if present
  const faqsYaml = formatFaqsYaml(faqs);
  if (faqsYaml) {
    frontmatter += "\n" + faqsYaml;
  }

  // Add add_ons (branding prices) if present
  if (brandingPrices?.options && brandingPrices.options.length > 0) {
    frontmatter += "\nadd_ons:";
    frontmatter += `\n  intro: |`;
    frontmatter += `\n    ## ${productName} Branding and Customisation Options`;
    frontmatter += `\n`;
    frontmatter += `\n    Make ${productName} a powerful marketing tool with full customisation options, including your brand logo, corporate colours, or event-specific designs. Personalising the game ensures a memorable experience for your guests while reinforcing your brand presence.`;
    frontmatter += `\n`;
    frontmatter += `\n    ### Branding Prices From`;
    frontmatter += `\n`;
    frontmatter += `\n    In-house branding available. We print, apply, and remove them after each event.`;
    frontmatter += `\n    (One time use only)`;
    frontmatter += "\n  options:";
    for (const option of brandingPrices.options) {
      frontmatter += `\n    - name: "${escapeYamlString(option.name)}"`;
      frontmatter += `\n      price: ${option.price}`;
    }
  }

  // Add tabs - "Why <Product Name>?" with content, plus 3 empty tabs
  // Each tab gets an image from the gallery (counting from the end)
  const gallery = images?.existingGallery || [];
  const getImageFromEnd = (index) => {
    // index 0 = last image, index 1 = second to last, etc.
    const idx = gallery.length - 1 - index;
    return idx >= 0 ? gallery[idx] : "";
  };

  const tabs = [
    {
      title: `Why ${productName}?`,
      body: (bodyContent && bodyContent.trim()) || "",
      image: getImageFromEnd(0), // last image
    },
    {
      title: "How It Works",
      body: "",
      image: getImageFromEnd(1), // second to last
    },
    {
      title: "Why It's A Crowd Favourite",
      body: "",
      image: getImageFromEnd(2), // third to last
    },
    {
      title: "Delivery",
      body: "",
      image: getImageFromEnd(3), // fourth to last
    },
  ];

  const tabsYaml = formatTabsYaml(tabs);
  if (tabsYaml) {
    frontmatter += "\n" + tabsYaml;
  }

  frontmatter += "\n---";
  return frontmatter;
};

/**
 * Generate frontmatter for category content
 * Categories don't need redirect_from since the URL structure stays the same:
 * Old: /category/{slug}/ -> New: /category/{slug}/ (dynamically calculated from filename)
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Category slug
 * @param {string} categoryHeading - The H1 heading from category content
 * @param {number} categoryIndex - Zero-based index of this category
 * @param {Object} navInfo - Navigation info from extractNavigationFromHtml (optional)
 * @param {Array<Object>} faqs - FAQs array with question and answer properties
 * @returns {string} Frontmatter YAML
 */
// Broken old-site URLs that should redirect to categories
// These were links to non-existent products on the old site
const BROKEN_CATEGORY_URLS = {
  "arcade-games": ["/category/arcade-games/2/lights-out-game/"],
  "interactive-game-hire": [
    "/category/interactive-game-hire/2/lights-out-game/",
  ],
};

const generateCategoryFrontmatter = (
  metadata,
  slug,
  categoryHeading = null,
  categoryIndex = 0,
  navInfo = null,
  faqs = [],
  metaTitle = null,
) => {
  // No permalink - let it be dynamically calculated
  // Old URL was /category/{slug}/, new URL is /categories/{slug}/ - need redirect
  const brokenUrls = BROKEN_CATEGORY_URLS[slug] || [];
  const allRedirects = [`/category/${slug}/`, ...brokenUrls];
  const redirectYaml = allRedirects.map((url) => `  - "${url}"`).join("\n");

  // Use provided metaTitle (from <title> tag), falling back to metadata.title
  const finalMetaTitle = metaTitle || metadata.title || "";

  // Generate a title-cased version of the slug as fallback
  const slugTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // For title, prefer navigation text (e.g., "Arcade Games"), then fall back to title-cased slug
  // Skip metadata.title if it looks like a meta title (contains | or is the same as metaTitle)
  const isMetaTitleStyle =
    metadata.title &&
    (metadata.title.includes("|") || metadata.title === finalMetaTitle);
  const displayTitle =
    navInfo?.text ||
    (isMetaTitleStyle ? slugTitle : metadata.title) ||
    slugTitle;

  let frontmatter = `---
title: "${displayTitle}"
meta_title: "${finalMetaTitle}"
meta_description: "${metadata.meta_description || ""}"
featured: true
redirect_from:
${redirectYaml}`;

  // Add navigation if extracted from old site navigation
  if (navInfo) {
    const navKey = navInfo.text || metadata.title || categoryHeading || "";
    frontmatter += `
eleventyNavigation:
  key: "${escapeYamlString(navKey)}"`;
    // Only add parent if this is NOT a top-level item
    if (navInfo.parent) {
      frontmatter += `
  parent: "${escapeYamlString(navInfo.parent)}"`;
    }
    frontmatter += `
  order: ${navInfo.order}`;
  }

  // Add FAQs if present
  const faqsYaml = formatFaqsYaml(faqs);
  if (faqsYaml) {
    frontmatter += "\n" + faqsYaml;
  }

  frontmatter += "\n---";
  return frontmatter;
};

/**
 * Generate frontmatter for review content
 * @param {string} name - Reviewer name
 * @param {string} productSlug - Product slug to link to
 * @returns {string} Frontmatter YAML
 */
const generateReviewFrontmatter = (name, productSlug) => {
  return `---
name: "${name}"
products: ["products/${productSlug}.md"]
---`;
};

/**
 * Generate frontmatter for event content
 * Events are similar to categories but don't need dates
 * Products are linked via the product's categories field, not stored on the event
 * Old URL: /category/{slug}/ or /pages/{slug}/ (depending on source)
 * New URL: /events/{slug}/ (dynamically calculated from file path)
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Event slug (the new slug, not the old site slug)
 * @param {string} eventHeading - The H1 heading from event content
 * @param {number} eventIndex - Zero-based index of this event
 * @param {Object} hierarchyInfo - Hierarchy info with isParent, parentTitle, order, title, oldSiteSlug
 * @param {string} sourceType - Source type: 'category' or 'pages' (to determine old URL)
 * @returns {string} Frontmatter YAML
 */
const generateEventFrontmatter = (
  metadata,
  slug,
  eventHeading = null,
  eventIndex = 0,
  hierarchyInfo = null,
  sourceType = null,
) => {
  // Use title from hierarchy info if available, otherwise fall back to metadata
  const title = hierarchyInfo?.title || metadata.title || "";

  // Check if this event has a placeholder thumbnail
  const thumbnail = EVENT_THUMBNAILS[slug] || null;

  let frontmatter = `---
title: "${escapeYamlString(title)}"
subtitle: "Subtitle subtitle subtitle subtitle subtitle"
meta_title: "${escapeYamlString(metadata.title || title)}"
meta_description: "${escapeYamlString(metadata.meta_description || "")}"
featured: true`;

  // Add thumbnail if available
  if (thumbnail) {
    frontmatter += `\nthumbnail: ${thumbnail}`;
  }

  // Add redirect_from for old site URLs
  // Collect all redirects: primary old site URL + any additional redirects
  const redirects = [];

  // Add the primary old site URL if source type is specified
  if (sourceType && hierarchyInfo?.oldSiteSlug) {
    const oldSiteSlug = hierarchyInfo.oldSiteSlug;
    const oldUrl =
      sourceType === "pages"
        ? `/pages/${oldSiteSlug}/`
        : `/category/${oldSiteSlug}/`;
    redirects.push(oldUrl);
  }

  // Add any additional redirects (for consolidated events)
  if (
    hierarchyInfo?.additionalRedirects &&
    hierarchyInfo.additionalRedirects.length > 0
  ) {
    for (const redirect of hierarchyInfo.additionalRedirects) {
      if (!redirects.includes(redirect)) {
        redirects.push(redirect);
      }
    }
  }

  // Output redirect_from if we have any redirects
  if (redirects.length > 0) {
    frontmatter += `\nredirect_from:`;
    for (const redirect of redirects) {
      frontmatter += `\n  - "${redirect}"`;
    }
  }

  // Add navigation based on hierarchy info
  if (hierarchyInfo) {
    const navKey = hierarchyInfo.title || title;

    frontmatter += `
eleventyNavigation:
  key: "${escapeYamlString(navKey)}"`;

    // Determine the parent:
    // - If navParent is set, use that (for "How We Help" events)
    // - Parent categories have "What's your event?" as their parent
    // - Child events have their parent category title as parent
    if (hierarchyInfo.navParent) {
      // Custom navigation parent (e.g., "How We Help" for brand-activation, christmas-entertainment)
      frontmatter += `
  parent: "${escapeYamlString(hierarchyInfo.navParent)}"`;
    } else if (hierarchyInfo.isParent) {
      // This is a parent category (e.g., "Corporate Events")
      // Its parent is "What's your event?" (the main dropdown)
      frontmatter += `
  parent: "What's your event?"`;
    } else if (hierarchyInfo.parentTitle) {
      // This is a child event (e.g., "Award Ceremonies")
      // Its parent is the parent category title (e.g., "Corporate Events")
      frontmatter += `
  parent: "${escapeYamlString(hierarchyInfo.parentTitle)}"`;
    }

    frontmatter += `
  order: ${hierarchyInfo.order || eventIndex + 1}`;
  }

  frontmatter += "\n---";
  return frontmatter;
};

/**
 * Find a location thumbnail image if it exists
 * @param {string} town - The town slug (e.g., 'birmingham')
 * @returns {string|null} Path to thumbnail image or null if not found
 */
const findLocationThumbnail = (town) => {
  const imagesDir = path.join(config.OUTPUT_BASE, "images", "locations");
  const extensions = [".png", ".jpg", ".jpeg", ".webp"];

  for (const ext of extensions) {
    const imagePath = path.join(imagesDir, `${town}${ext}`);
    if (fs.existsSync(imagePath)) {
      return `images/locations/${town}${ext}`;
    }
  }
  return null;
};

/**
 * Generate frontmatter for location content
 * Old URL: /pages/{original-slug}/ (e.g., /pages/corporate-event-hire-birmingham/)
 * New URL: dynamically calculated from file path (e.g., /locations/birmingham/corporate-event-hire/)
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Location page slug (original, e.g., 'corporate-event-hire-birmingham')
 * @param {string} locationHeading - The H1 heading from page content
 * @param {string} town - The matched town name
 * @param {string} strippedSlug - Slug with town name removed (e.g., 'corporate-event-hire')
 * @param {string} thumbnail - Thumbnail image path extracted from content (for sub-pages)
 * @param {boolean} hadRootLevelUrl - Whether page previously existed in pages/ dir (needs root-level redirect)
 * @returns {Object} Object with frontmatter and filename
 */
const generateLocationFrontmatter = (
  metadata,
  slug,
  locationHeading = null,
  town = null,
  strippedSlug = null,
  thumbnail = null,
  hadRootLevelUrl = false,
) => {
  // Use the heading or title for the location title
  const title = locationHeading || metadata.header_text || metadata.title || "";

  // Old URL from the old site (pages directory)
  const oldPagesUrl = `/pages/${slug}/`;

  // New URL will be dynamically calculated from file location
  // e.g., locations/birmingham/corporate-event-hire.md -> /locations/birmingham/corporate-event-hire/
  const newUrl =
    town && strippedSlug
      ? `/locations/${town}/${strippedSlug}/`
      : `/locations/${slug}/`;

  let frontmatter = `---
title: "${escapeYamlString(title)}"
meta_title: "${escapeYamlString(metadata.title || "")}"
meta_description: "${escapeYamlString(metadata.meta_description || "")}"`;

  // Add redirect_from for old /pages/ URL (always) and root-level URL (only if page existed there)
  if (oldPagesUrl !== newUrl || hadRootLevelUrl) {
    const redirects = [];
    if (oldPagesUrl !== newUrl) redirects.push(oldPagesUrl);
    // Only add root-level redirect if page previously existed in pages/ directory
    if (hadRootLevelUrl) redirects.push(`/${slug}/`);
    const redirectYaml = redirects.map((url) => `  - "${url}"`).join("\n");
    frontmatter += `\nredirect_from:\n${redirectYaml}`;
  }

  // For root location pages (slug equals town name), add thumbnail if available
  if (town && !strippedSlug) {
    const rootThumbnail = findLocationThumbnail(town);
    if (rootThumbnail) {
      frontmatter += `\nthumbnail: "${rootThumbnail}"`;
    }
  }

  // For sub-pages, add thumbnail if extracted from content
  if (town && strippedSlug && thumbnail) {
    frontmatter += `\nthumbnail: "${thumbnail}"`;
  }

  frontmatter += "\n---";

  // If town info provided, return object with custom filename in subfolder
  if (town && strippedSlug) {
    return {
      frontmatter,
      filename: `${town}/${strippedSlug}.md`,
    };
  }

  return frontmatter;
};

/**
 * Generate frontmatter and content for root location pages (e.g., locations/birmingham.md)
 * These are new pages (not imported from old site), so no redirect_from needed
 * URL will be dynamically calculated from file path: /locations/{town}/
 * @param {string} town - The town slug (e.g., 'birmingham', 'milton-keynes')
 * @returns {string} Complete page content with frontmatter
 */
const generateLocationRootFrontmatter = (town) => {
  // Convert slug to display name (e.g., 'milton-keynes' -> 'Milton Keynes')
  const townName = town
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Check for a thumbnail image
  const thumbnail = findLocationThumbnail(town);

  // No permalink - URL will be dynamically calculated from file location
  let frontmatter = `---
title: "${townName}"
meta_title: "Event Hire ${townName} | Fun Pro UK"
meta_description: "Professional event hire and entertainment services in ${townName}. Interactive games, photo booths and more for corporate events, weddings and parties."
layout: location
subtitle: Subtitle subtitle subtitle subtitle`;

  if (thumbnail) {
    frontmatter += `\nthumbnail: "${thumbnail}"`;
  }

  frontmatter += `
---

# Event Hire ${townName}

Browse our event hire services available in ${townName} and the surrounding area.
`;

  return frontmatter;
};

module.exports = {
  generatePageFrontmatter,
  generateBlogFrontmatter,
  generateProductFrontmatter,
  generateCategoryFrontmatter,
  generateEventFrontmatter,
  generateReviewFrontmatter,
  generateLocationFrontmatter,
  generateLocationRootFrontmatter,
};
