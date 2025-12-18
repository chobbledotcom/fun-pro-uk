const { PRODUCT_ORDER } = require('../constants');

/**
 * Configuration for page-specific layouts and overrides
 * Navigation is now dynamically extracted from the old site
 */
const PAGE_CONFIG = {
  'contact': {
    layout: 'contact.html',
  },
  'reviews': {
    layout: 'reviews.html',
  },
  'delivery-areas': {
    layout: 'locations',
  },
  'testimonials': {
    layout: 'reviews.html',
  }
};

/**
 * Generate frontmatter for page content
 * Old URL: /pages/{slug}/ (for most pages)
 * New URL: /{slug}/ (at root, dynamically calculated from filename in pages collection)
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Page slug
 * @param {string} pageHeading - The H1 heading from page content
 * @param {Object} navInfo - Navigation info from extractNavigationFromHtml (optional)
 * @returns {string} Frontmatter YAML
 */
const generatePageFrontmatter = (metadata, slug, pageHeading = null, navInfo = null) => {
  const pageConfig = PAGE_CONFIG[slug] || {};
  const layout = pageConfig.layout || 'page';

  // Pages that were already at root level on the old site don't need redirects
  const rootPages = ['contact', 'reviews', 'delivery-areas', 'testimonials'];
  const needsRedirect = !rootPages.includes(slug);

  // No permalink - let it be dynamically calculated from file location
  // Pages collection will put them at /{slug}/
  let frontmatter = `---
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
layout: ${layout}`;

  // Add redirect_from for old /pages/ URLs
  if (needsRedirect) {
    frontmatter += `\nredirect_from:\n  - "/pages/${slug}/"`;
  }

  // Add navigation if extracted from old site
  if (navInfo) {
    // Use the link text from navigation as the key if available, otherwise use title or slug
    const navKey = navInfo.text || metadata.title || slug.replace(/-/g, ' ');
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

  frontmatter += '\n---';
  return frontmatter;
};

/**
 * Escape special characters for YAML strings
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeYamlString = (str) => {
  if (!str) return '';
  return str.replace(/"/g, '\\"');
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
const generateBlogFrontmatter = (metadata, slug, date, blogHeading = null, localImagePath = null) => {
  const postTitle = metadata.header_text || slug.replace(/-/g, ' ');

  // Old URL from the old site
  const oldUrl = `/news/${date}/${slug}/`;
  // New URL will be dynamically calculated: /news/{date}-{slug}/ (based on filename)
  const newUrl = `/news/${date}-${slug}/`;

  let frontmatter = `---
title: "${postTitle}"
date: ${date}
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"`;

  // Add redirect_from if old URL differs from new URL
  if (oldUrl !== newUrl) {
    frontmatter += `\nredirect_from:\n  - "${oldUrl}"`;
  }

  // Add gallery with the downloaded image
  if (localImagePath) {
    frontmatter += `\ngallery:\n  - "${localImagePath}"`;
  }

  frontmatter += '\n---';
  return frontmatter;
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
 * @returns {string} Frontmatter YAML
 */
const generateProductFrontmatter = (metadata, slug, price, categories, productName, images = null, productHeading = null, events = [], oldSitePath = null) => {
  // Ensure categories is an array
  const categoryArray = Array.isArray(categories) ? categories : (categories ? [categories] : []);
  const categoriesYaml = categoryArray.length > 0
    ? `[${categoryArray.map(c => `"${c}"`).join(', ')}]`
    : '[]';

  // Ensure events is an array
  const eventsArray = Array.isArray(events) ? events : (events ? [events] : []);
  const eventsYaml = eventsArray.length > 0
    ? `[${eventsArray.map(e => `"${e}"`).join(', ')}]`
    : '[]';

  // Get product order, default to 50 if not in mapping
  const productOrder = PRODUCT_ORDER[slug] || 50;

  // Base frontmatter - no permalink, let it be dynamically calculated
  let frontmatter = `---
title: "${productName || metadata.title || ''}"
price: "${price}"
order: ${productOrder}
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
categories: ${categoriesYaml}
events: ${eventsYaml}
featured: true
features: []`;

  // Add redirect_from for old site URL
  if (oldSitePath) {
    const oldUrl = `/category/${oldSitePath.replace(/\.html$/, '').replace(/\\/g, '/')}/`;
    frontmatter += `\nredirect_from:\n  - "${oldUrl}"`;
  }

  // Preserve existing gallery (local paths managed by another script)
  if (images?.existingGallery && images.existingGallery.length > 0) {
    const galleryYaml = images.existingGallery.map(img => `  - "${img}"`).join('\n');
    frontmatter += `\ngallery:\n${galleryYaml}`;
  }

  // Add gallery_cloudinary with Cloudinary URLs from old site
  if (images?.gallery_cloudinary && images.gallery_cloudinary.length > 0) {
    const galleryYaml = images.gallery_cloudinary.map(img => `  - "${img}"`).join('\n');
    frontmatter += `\ngallery_cloudinary:\n${galleryYaml}`;
  }

  frontmatter += '\n---';
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
 * @returns {string} Frontmatter YAML
 */
const generateCategoryFrontmatter = (metadata, slug, categoryHeading = null, categoryIndex = 0, navInfo = null) => {
  // No permalink - let it be dynamically calculated
  // Old URL /category/{slug}/ matches the expected new URL, so no redirect needed
  let frontmatter = `---
title: "${metadata.title || ''}"
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
featured: true`;

  // Add navigation if extracted from old site navigation
  if (navInfo) {
    const navKey = navInfo.text || metadata.title || categoryHeading || '';
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

  frontmatter += '\n---';
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
 * @param {string} slug - Event slug
 * @param {string} eventHeading - The H1 heading from event content
 * @param {number} eventIndex - Zero-based index of this event
 * @param {Object} navInfo - Navigation info from extractNavigationFromHtml (optional)
 * @param {string} sourceType - Source type: 'category' or 'pages' (to determine old URL)
 * @returns {string} Frontmatter YAML
 */
const generateEventFrontmatter = (metadata, slug, eventHeading = null, eventIndex = 0, navInfo = null, sourceType = 'category') => {
  // Old URL depends on source type
  const oldUrl = sourceType === 'pages' ? `/pages/${slug}/` : `/category/${slug}/`;
  // New URL will be dynamically calculated: /events/{slug}/
  const newUrl = `/events/${slug}/`;

  let frontmatter = `---
title: "${metadata.title || ''}"
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
featured: true`;

  // Add redirect_from if old URL differs from new URL
  if (oldUrl !== newUrl) {
    frontmatter += `\nredirect_from:\n  - "${oldUrl}"`;
  }

  // Add navigation if extracted from old site navigation
  if (navInfo) {
    const navKey = navInfo.text || metadata.title || eventHeading || '';
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

  frontmatter += '\n---';
  return frontmatter;
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
 * @returns {Object} Object with frontmatter and filename
 */
const generateLocationFrontmatter = (metadata, slug, locationHeading = null, town = null, strippedSlug = null) => {
  // Use the heading or title for the location title
  const title = locationHeading || metadata.header_text || metadata.title || '';

  // Old URL from the old site
  const oldUrl = `/pages/${slug}/`;
  
  // New URL will be dynamically calculated from file location
  // e.g., locations/birmingham/corporate-event-hire.md -> /locations/birmingham/corporate-event-hire/
  // Only add redirect_from if the old URL differs from the new one
  const newUrl = town && strippedSlug ? `/locations/${town}/${strippedSlug}/` : `/locations/${slug}/`;

  let frontmatter = `---
title: "${escapeYamlString(title)}"
meta_title: "${escapeYamlString(metadata.title || '')}"
meta_description: "${escapeYamlString(metadata.meta_description || '')}"`;

  // Add redirect_from if old URL differs from new URL
  if (oldUrl !== newUrl) {
    frontmatter += `\nredirect_from:\n  - "${oldUrl}"`;
  }

  frontmatter += '\n---';

  // If town info provided, return object with custom filename in subfolder
  if (town && strippedSlug) {
    return {
      frontmatter,
      filename: `${town}/${strippedSlug}.md`
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
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // No permalink - URL will be dynamically calculated from file location
  return `---
title: "${townName}"
meta_title: "Event Hire ${townName} | Fun Pro UK"
meta_description: "Professional event hire and entertainment services in ${townName}. Interactive games, photo booths and more for corporate events, weddings and parties."
layout: location
location: "${town}"
---

# Event Hire ${townName}

Browse our event hire services available in ${townName} and the surrounding area.
`;
};

module.exports = {
  generatePageFrontmatter,
  generateBlogFrontmatter,
  generateProductFrontmatter,
  generateCategoryFrontmatter,
  generateEventFrontmatter,
  generateReviewFrontmatter,
  generateLocationFrontmatter,
  generateLocationRootFrontmatter
};