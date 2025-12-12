const path = require('path');
const config = require('../config');
const { ensureDir, writeMarkdownFile } = require('../utils/filesystem');

/**
 * Static pages that are manually created (not imported from old site)
 * These are index/template pages needed by the site
 */
const STATIC_PAGES = [
  {
    slug: 'blog',
    content: `---
meta_title: "News & Updates | Fun Pro UK"
meta_description: "All of the latest news from Fun Pro UK about interactive game hire, corporate events, exhibitions, and parties."
permalink: "/blog/"
layout: news-archive.html
eleventyNavigation:
  key: News
  order: 5
---

# News & Updates

All of the latest news from Fun Pro UK - you can also find more updates on our [Facebook Page](https://www.facebook.com/funprouk/)!`
  },
  {
    slug: 'home',
    content: `---
meta_title: "Fun Pro UK | Corporate Events & Parties Game Hire | UK & Nationwide"
meta_description: "Looking to level up your corporate event, fun day, exhibition, or party? Our exciting game hire brings unbeatable entertainment straight to your venue, anywhere in the UK. Book now for guaranteed fun!"
permalink: "/"
layout: "home.html"
eleventyNavigation:
  key: Home
  order: 1
---

# Fun Pro UK | Corporate Events & Parties Game Hire | UK & Nationwide`
  },
  {
    slug: 'products',
    content: `---
meta_title: "Interactive Game Hire | Corporate Events & Parties | Fun Pro UK"
meta_description: "Browse our complete range of interactive games, arcade machines, and entertainment hire for corporate events, exhibitions, and parties across the UK."
permalink: "/products/"
layout: products.html
eleventyNavigation:
  key: Products
  order: 3
---

# Interactive Game Hire

We offer a comprehensive range of interactive games and entertainment hire for corporate events, exhibitions, and parties.`
  },
  {
    slug: 'reviews',
    content: `---
meta_description: "Read reviews and testimonials from our satisfied customers about Fun Pro UK's interactive game hire services."
meta_title: "Customer Reviews | Fun Pro UK"
permalink: /reviews/
layout: reviews.html
---

# Customer Reviews`
  },
  {
    slug: 'service-areas',
    content: `---
meta_title: "Delivery Areas | Game Hire Across the UK | Fun Pro UK"
meta_description: "Fun Pro UK provides interactive game hire and entertainment delivery across the UK including Birmingham, London, Manchester, Coventry, Nottingham, Leicester and more."
permalink: "/locations/"
layout: page.html
eleventyNavigation:
  key: Locations
  order: 4
---

# Delivery Areas

We provide nationwide delivery of interactive games and entertainment hire across the UK.`
  },
  {
    slug: 'thank-you',
    content: `---
meta_description:
meta_title: Thank You
navigationParent: Contact
no_index: true
---

# Thank You

## Thank You

Your message has been sent - we will be in touch.`
  },
  {
    slug: 'not-found',
    content: `---
meta_description:
meta_title: Not Found
no_index: true

permalink: /not_found.html
---

# Not Found

## Page Not Found

Whoops! It looks like you followed an invalid link - **[click here to go back to the homepage](/)**.`
  }
];

/**
 * Convert static pages (manually created pages not from old site)
 * @returns {Promise<Object>} Conversion results
 */
const convertStaticPages = async () => {
  console.log('Creating static pages...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.pages);
  ensureDir(outputDir);

  let successful = 0;
  let failed = 0;

  for (const page of STATIC_PAGES) {
    try {
      const outputPath = path.join(outputDir, `${page.slug}.md`);
      writeMarkdownFile(outputPath, page.content);
      console.log(`  Created: ${page.slug}.md`);
      successful++;
    } catch (error) {
      console.error(`  Error creating ${page.slug}:`, error.message);
      failed++;
    }
  }

  return { successful, failed, total: STATIC_PAGES.length };
};

module.exports = {
  convertStaticPages,
  STATIC_PAGES
};
