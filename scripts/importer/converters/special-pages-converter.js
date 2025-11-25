const path = require('path');
const fs = require('fs');
const config = require('../config');
const { ensureDir, writeMarkdownFile } = require('../utils/filesystem');

/**
 * Generate home.md from index.html metadata
 */
const generateHomePage = () => {
  const indexPath = path.join(config.OLD_SITE_PATH, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.log('  Warning: index.html not found, using default home page');
    return createDefaultHomePage();
  }

  const html = fs.readFileSync(indexPath, 'utf8');

  // Extract title and meta description
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/);

  const title = titleMatch ? titleMatch[1] : 'MyAlarm Security | Burglar Alarms & CCTV Systems';
  const description = descMatch ? descMatch[1] : 'Professional burglar alarm and CCTV installation across South East London and Kent.';

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
 * Create default home page if no source data available
 */
const createDefaultHomePage = () => {
  const title = 'Fun Pro UK | Interactive Game Hire for Corporate Events & Parties';
  return `---
meta_title: "${title}"
meta_description: "Interactive game hire for corporate events, exhibitions, and parties across the UK. Book now for guaranteed fun!"
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
 */
const generateProductsPage = () => {
  const config = require('../config');

  let frontmatter = `---
meta_title: "Interactive Game Hire | Corporate Events & Parties | Fun Pro UK"
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
 * Generate service-areas.md with short intro (areas listed by template)
 */
const generateServiceAreasPage = () => {
  const config = require('../config');

  let frontmatter = `---
meta_title: "Delivery Areas | Game Hire Across the UK | Fun Pro UK"
meta_description: "Fun Pro UK provides interactive game hire and entertainment delivery across the UK including Birmingham, London, Manchester, Coventry, Nottingham, Leicester and more."
permalink: "/service-areas/"
layout: page.html`;

  if (!config.options.categoriesInNavigation) {
    frontmatter += `
eleventyNavigation:
  key: Service Areas
  order: 4`;
  }

  frontmatter += `
---

# Delivery Areas

We provide nationwide delivery of interactive games and entertainment hire across the UK.
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
 */
const generateBlogPage = () => {
  const config = require('../config');

  let frontmatter = `---
meta_description: "Latest news and updates from Fun Pro UK about interactive game hire, corporate events, and entertainment."
meta_title: "News & Updates | Fun Pro UK"
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
`;

  return frontmatter;
};

/**
 * Generate reviews index page
 */
const generateReviewsPage = () => `---
meta_description: "Read reviews and testimonials from our satisfied customers about Fun Pro UK's interactive game hire services."
meta_title: "Customer Reviews | Fun Pro UK"
permalink: /reviews/
layout: reviews.html
---

# Customer Reviews
`;

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
    { name: 'service-areas.md', generator: generateServiceAreasPage },
    { name: 'not-found.md', generator: generateNotFoundPage },
    { name: 'thank-you.md', generator: generateThankYouPage },
    { name: 'blog.md', generator: generateBlogPage },
    { name: 'reviews.md', generator: generateReviewsPage }
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
  generateServiceAreasPage,
  generateNotFoundPage,
  generateThankYouPage,
  generateBlogPage,
  generateReviewsPage
};
