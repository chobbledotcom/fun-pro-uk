const path = require('path');
const fs = require('fs');
const config = require('../config');
const { ensureDir, writeMarkdownFile } = require('../utils/filesystem');
const { getSiteTitle, getMetaDescription, getSiteName, getSocialUrl } = require('../utils/source-extractor');

/**
 * Generate home.md from index.html metadata
 * Uses source-extractor to get actual data from the old site
 */
const generateHomePage = () => {
  // Get title and description from source - no fallbacks, data must exist
  const title = getSiteTitle();
  const description = getMetaDescription();
  
  if (!title) {
    throw new Error('Could not extract site title from source');
  }
  if (!description) {
    throw new Error('Could not extract meta description from source');
  }

  return `---
meta_title: "${title}"
meta_description: "${description}"
permalink: "/"
layout: "home.html"
eleventyNavigation:
  key: Home
  order: 1
---

# ${title}
`;
};

/**
 * Generate products.md with minimal content (products listed by template)
 * Uses extracted site name for titles
 */
const generateProductsPage = () => {
  const siteName = getSiteName();
  
  if (!siteName) {
    throw new Error('Could not extract site name from source');
  }
  
  let frontmatter = `---
meta_title: "Interactive Game Hire | Corporate Events & Parties | ${siteName}"
meta_description: "Browse our complete range of interactive games, arcade machines, and entertainment hire for corporate events, exhibitions, and parties across the UK."
permalink: "/products/"
layout: products.html`;

  if (!config.options.categoriesInNavigation) {
    frontmatter += `
eleventyNavigation:
  key: Products
  order: 3`;
  }

  frontmatter += `
---

# Interactive Game Hire

We offer a comprehensive range of interactive games and entertainment hire for corporate events, exhibitions, and parties.
`;

  return frontmatter;
};

/**
 * Generate not-found.md
 */
const generateNotFoundPage = () => `---
meta_description:
meta_title: Not Found
no_index: true

permalink: /not_found.html
---

# Not Found

## Page Not Found

Whoops! It looks like you followed an invalid link - **[click here to go back to the homepage](/)**.
`;

/**
 * Generate thank-you.md
 */
const generateThankYouPage = () => `---
meta_description:
meta_title: Thank You
navigationParent: Contact
no_index: true
---

# Thank You

## Thank You

Your message has been sent - we will be in touch.
`;

/**
 * Generate blog index page
 * Uses extracted site name and Facebook URL from source
 */
const generateBlogPage = () => {
  const siteName = getSiteName();
  const facebookUrl = getSocialUrl('facebook');
  
  if (!siteName) {
    throw new Error('Could not extract site name from source');
  }
  if (!facebookUrl) {
    throw new Error('Could not extract Facebook URL from source');
  }

  let frontmatter = `---
meta_description: "Latest news and updates from ${siteName} about interactive game hire, corporate events, and entertainment."
meta_title: "News & Updates | ${siteName}"
permalink: /blog/
layout: news-archive.html`;

  if (!config.options.categoriesInNavigation) {
    frontmatter += `
eleventyNavigation:
  key: News
  order: 2`;
  }

  frontmatter += `
---

# News & Updates

All of the latest news from ${siteName} - you can also find more updates on our [Facebook Page](${facebookUrl})!
`;

  return frontmatter;
};

/**
 * Convert all special pages
 */
const convertSpecialPages = async () => {
  console.log('Generating special pages...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.pages);
  ensureDir(outputDir);

  const pages = [
    { name: 'home.md', generator: generateHomePage },
    { name: 'products.md', generator: generateProductsPage },
    { name: 'not-found.md', generator: generateNotFoundPage },
    { name: 'thank-you.md', generator: generateThankYouPage },
    { name: 'blog.md', generator: generateBlogPage }
  ];

  let successful = 0;
  let failed = 0;

  pages.forEach(({ name, generator }) => {
    try {
      const content = generator();
      const outputPath = path.join(outputDir, name);
      writeMarkdownFile(outputPath, content);
      console.log(`  ✓ Generated ${name}`);
      successful++;
    } catch (error) {
      console.error(`  ✗ Failed to generate ${name}: ${error.message}`);
      failed++;
    }
  });

  return {
    successful,
    failed,
    total: pages.length
  };
};

module.exports = {
  convertSpecialPages,
  generateHomePage,
  generateProductsPage,
  generateNotFoundPage,
  generateThankYouPage,
  generateBlogPage
};
