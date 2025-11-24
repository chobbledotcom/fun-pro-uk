const { PRODUCT_ORDER } = require('../constants');

/**
 * Configuration for page-specific layouts, navigation, and metadata
 */
const PAGE_CONFIG = {
  'about-us': {
    nav: {key: 'About', order: 2}
  },
  'contact': {
    layout: 'contact.html',
    nav: {key: 'Contact', order: 99}
  },
  'reviews': {
    layout: 'reviews.html',
    nav: {key: 'Reviews', order: 98}
  }
};

/**
 * Generate frontmatter for page content
 * @param {Object} metadata - Extracted metadata
 * @param {string} slug - Page slug
 * @param {string} pageHeading - The H1 heading from page content
 * @returns {string} Frontmatter YAML
 */
const generatePageFrontmatter = (metadata, slug, pageHeading = null) => {
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

  // Add navigation if configured
  if (pageConfig.nav) {
    frontmatter += `
eleventyNavigation:
  key: ${pageConfig.nav.key}
  order: ${pageConfig.nav.order}`;
  }

  frontmatter += '\n---';
  return frontmatter;
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

  let frontmatter = `---
title: "${postTitle}"
date: ${date}
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
permalink: "/blog/${slug}/"`;

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
 * @returns {string} Frontmatter YAML
 */
const generateProductFrontmatter = (metadata, slug, price, categories, productName, images = null, productHeading = null) => {
  // Ensure categories is an array
  const categoryArray = Array.isArray(categories) ? categories : (categories ? [categories] : []);
  const categoriesYaml = categoryArray.length > 0
    ? `[${categoryArray.map(c => `"${c}"`).join(', ')}]`
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
permalink: "/products/${slug}/"
categories: ${categoriesYaml}
features: []`;

  // Add gallery if header_image exists
  if (images?.header_image) {
    frontmatter += `\ngallery: ["${images.header_image}"]`;
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
 * @returns {string} Frontmatter YAML
 */
const generateCategoryFrontmatter = (metadata, slug, categoryHeading = null, categoryIndex = 0) => {
  const config = require('../config');

  let frontmatter = `---
title: "${metadata.title || ''}"
meta_title: "${metadata.title || ''}"
meta_description: "${metadata.meta_description || ''}"
permalink: "/categories/${slug}/"
featured: false`;

  // Add navigation if categoriesInNavigation option is enabled
  if (config.options.categoriesInNavigation) {
    const navOrder = 20 + categoryIndex;
    frontmatter += `
eleventyNavigation:
  key: ${metadata.title || categoryHeading || ''}
  order: ${navOrder}`;
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

module.exports = {
  generatePageFrontmatter,
  generateBlogFrontmatter,
  generateProductFrontmatter,
  generateCategoryFrontmatter,
  generateReviewFrontmatter
};