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
  }
};

/**
 * Generate frontmatter for page content
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Page slug
 * @param {string} pageHeading - The H1 heading from page content
 * @param {Object} navInfo - Navigation info from extractNavigationFromHtml (optional)
 * @returns {string} Frontmatter YAML
 */
const generatePageFrontmatter = (metadata, slug, pageHeading = null, navInfo = null) => {
  const pageConfig = PAGE_CONFIG[slug] || {};
  const layout = pageConfig.layout || 'page';

  // Root-level pages don't need /pages/ prefix
  const rootPages = ['contact', 'reviews'];
  const permalink = rootPages.includes(slug) ? `/${slug}/` : `/pages/${slug}/`;

  let frontmatter = `---
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
permalink: "${permalink}"
layout: ${layout}`;

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
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Post slug
 * @param {string} date - Post date
 * @param {string} blogHeading - The H1 heading from blog post content
 * @param {string} localImagePath - Local path to downloaded image
 * @returns {string} Frontmatter YAML
 */
const generateBlogFrontmatter = (metadata, slug, date, blogHeading = null, localImagePath = null) => {
  const postTitle = metadata.header_text || slug.replace(/-/g, ' ');

  // Include date in permalink to match old site structure and avoid duplicate slugs
  // Old: /news/2017-11-19/christmas-parties-are-go -> New: /blog/2017-11-19/christmas-parties-are-go
  let frontmatter = `---
title: "${postTitle}"
date: ${date}
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
permalink: "/blog/${date}/${slug}/"`;

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
 * @returns {string} Frontmatter YAML
 */
const generateProductFrontmatter = (metadata, slug, price, categories, productName, images = null, productHeading = null, events = []) => {
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

  // Base frontmatter
  let frontmatter = `---
title: "${productName || metadata.title || ''}"
price: "${price}"
order: ${productOrder}
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
permalink: "/${slug}/"
categories: ${categoriesYaml}
events: ${eventsYaml}
featured: true
features: []`;

  // Add gallery with all images
  if (images?.gallery && images.gallery.length > 0) {
    const galleryYaml = images.gallery.map(img => `  - "${img}"`).join('\n');
    frontmatter += `\ngallery:\n${galleryYaml}`;
  } else if (images?.header_image) {
    frontmatter += `\ngallery:\n  - "${images.header_image}"`;
  }

  frontmatter += '\n---';
  return frontmatter;
};

/**
 * Generate frontmatter for category content
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Category slug
 * @param {string} categoryHeading - The H1 heading from category content
 * @param {number} categoryIndex - Zero-based index of this category
 * @param {Object} navInfo - Navigation info from extractNavigationFromHtml (optional)
 * @returns {string} Frontmatter YAML
 */
const generateCategoryFrontmatter = (metadata, slug, categoryHeading = null, categoryIndex = 0, navInfo = null) => {
  let frontmatter = `---
title: "${metadata.title || ''}"
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
permalink: "/category/${slug}/"
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
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Event slug
 * @param {string} eventHeading - The H1 heading from event content
 * @param {number} eventIndex - Zero-based index of this event
 * @param {Object} navInfo - Navigation info from extractNavigationFromHtml (optional)
 * @returns {string} Frontmatter YAML
 */
const generateEventFrontmatter = (metadata, slug, eventHeading = null, eventIndex = 0, navInfo = null) => {
  let frontmatter = `---
title: "${metadata.title || ''}"
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
permalink: "/events/${slug}/"
featured: true`;

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

  // Keep the original permalink to maintain URL structure
  const permalink = `/pages/${slug}/`;

  let frontmatter = `---
title: "${escapeYamlString(title)}"
meta_title: "${escapeYamlString(metadata.title || '')}"
meta_description: "${escapeYamlString(metadata.meta_description || '')}"
permalink: "${permalink}"`;

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
 * @param {string} town - The town slug (e.g., 'birmingham', 'milton-keynes')
 * @returns {string} Complete page content with frontmatter
 */
const generateLocationRootFrontmatter = (town) => {
  // Convert slug to display name (e.g., 'milton-keynes' -> 'Milton Keynes')
  const townName = town
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `---
title: "${townName}"
meta_title: "Event Hire ${townName} | Fun Pro UK"
meta_description: "Professional event hire and entertainment services in ${townName}. Interactive games, photo booths and more for corporate events, weddings and parties."
permalink: "/locations/${town}/"
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