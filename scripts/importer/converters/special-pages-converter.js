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
  const title = 'MyAlarm Security | Burglar Alarms & CCTV Systems';
  return `---
meta_title: "${title}"
meta_description: "Professional burglar alarm and CCTV installation across South East London and Kent."
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
meta_title: "Security Packages | Burglar Alarms & CCTV | MyAlarm Security"
meta_description: "Browse our complete range of security packages: burglar alarms, CCTV systems, and combined packages. Professional installation across South East London and Kent."
permalink: "/products/"
layout: products`;

  if (!config.options.categoriesInNavigation) {
    frontmatter += `
eleventyNavigation:
  key: Products
  order: 3`;
  }

  frontmatter += `
---

# Our Security Packages

We offer a comprehensive range of security packages designed to protect your home or business.
`;

  return frontmatter;
};

/**
 * Generate service-areas.md with short intro (areas listed by template)
 */
const generateServiceAreasPage = () => {
  const config = require('../config');

  let frontmatter = `---
meta_title: "Service Areas | Security Installation Across South East London & Kent"
meta_description: "We provide professional burglar alarm and CCTV installation across South East London and Kent including Bexley, Dartford, Bromley, Orpington, Greenwich and surrounding areas."
permalink: "/service-areas/"
layout: service-areas.html`;

  if (!config.options.categoriesInNavigation) {
    frontmatter += `
eleventyNavigation:
  key: Service Areas
  order: 4`;
  }

  frontmatter += `
---

# Service Areas

We provide professional security installation and maintenance services across South East London and Kent.
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
meta_description:
meta_title: News
permalink: /blog/
layout: blog`;

  if (!config.options.categoriesInNavigation) {
    frontmatter += `
eleventyNavigation:
  key: News
  order: 2`;
  }

  frontmatter += `
---

# News
`;

  return frontmatter;
};

/**
 * Generate reviews index page
 */
const generateReviewsPage = () => `---
meta_description:
meta_title: Reviews
permalink: /reviews/
layout: reviews
---

# Reviews
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
