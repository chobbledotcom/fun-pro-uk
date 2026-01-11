const path = require("path");
const config = require("../config");
const { ensureDir, writeMarkdownFile } = require("../utils/filesystem");
const {
  getSiteTitle,
  getMetaDescription,
  getSiteName,
  getSocialUrl,
} = require("../utils/source-extractor");

/**
 * Generate static pages dynamically using extracted source data
 * @returns {Array} Array of page objects with slug and content
 */
const getStaticPages = () => {
  // Extract data from source - no fallbacks, data must exist
  const siteTitle = getSiteTitle();
  const metaDescription = getMetaDescription();
  const siteName = getSiteName();
  const facebookUrl = getSocialUrl("facebook");

  if (!siteTitle) {
    throw new Error("Could not extract site title from source");
  }
  if (!metaDescription) {
    throw new Error("Could not extract meta description from source");
  }
  if (!siteName) {
    throw new Error("Could not extract site name from source");
  }
  if (!facebookUrl) {
    throw new Error("Could not extract Facebook URL from source");
  }

  return [
    {
      slug: "news",
      content: `---
meta_title: "News & Updates | ${siteName}"
meta_description: "All of the latest news from ${siteName} about interactive game hire, corporate events, exhibitions, and parties."
permalink: "/news/"
layout: news-archive.html
eleventyNavigation:
  key: News
  parent: "About Us"
  order: 6
---

# News & Updates

All of the latest news from ${siteName} - you can also find more updates on our [Facebook Page](${facebookUrl})!`,
    },
    {
      slug: "home",
      content: `---
meta_title: "${siteTitle}"
meta_description: "${metaDescription}"
permalink: "/"
layout: "home.html"
eleventyNavigation:
  key: Home
  order: 1
redirect_from:
  - "/pages/about-bouncy-castle-hire/"
  - "/pages/frequently-asked-bouncy-castle-hire-questions/"
---

# ${siteTitle}`,
    },
    {
      slug: "products",
      content: `---
meta_title: "Interactive Game Hire | Corporate Events & Parties | ${siteName}"
meta_description: "Browse our complete range of interactive games, arcade machines, and entertainment hire for corporate events, exhibitions, and parties across the UK."
permalink: "/products/"
layout: products.html
eleventyNavigation:
  key: Products
  order: 3
redirect_from:
  - "/pages/a-z-of-all-games/"
  - "/category/all-products/"
---

# Interactive Game Hire

We offer a comprehensive range of interactive games and entertainment hire for corporate events, exhibitions, and parties.`,
    },
    {
      slug: "thank-you",
      content: `---
meta_description:
meta_title: Thank You
navigationParent: Contact
no_index: true
---

# Thank You

## Thank You

Your message has been sent - we will be in touch.`,
    },
    {
      slug: "not-found",
      content: `---
meta_description:
meta_title: Not Found
no_index: true

permalink: /not_found.html
---

# Not Found

## Page Not Found

Whoops! It looks like you followed an invalid link - **[click here to go back to the homepage](/)**.`,
    },
    {
      slug: "quote",
      content: `---
meta_description: Review the items in your quote request
meta_title: Quote Request
layout: quote.html
permalink: "/quote/"
no_index: true
---
`,
    },
    {
      slug: "checkout",
      content: `---
meta_description: Complete your quote request
meta_title: Request a Quote
layout: quote-checkout.html
permalink: /checkout/
no_index: true
---
`,
    },
    {
      slug: "order-complete",
      content: `---
meta_description: Your quote request has been submitted
meta_title: Quote Request Submitted
layout: quote-complete.html
permalink: /order-complete/
no_index: true
---

## Thank You

Your quote request has been submitted. We will be in touch shortly.`,
    },
  ];
};

// Export STATIC_PAGES as a getter for backward compatibility
const STATIC_PAGES = getStaticPages();

/**
 * Convert static pages (manually created pages not from old site)
 * @returns {Promise<Object>} Conversion results
 */
const convertStaticPages = async () => {
  console.log("Creating static pages...");

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.pages);
  ensureDir(outputDir);

  // Get fresh static pages (with extracted data)
  const pages = getStaticPages();

  let successful = 0;
  let failed = 0;

  for (const page of pages) {
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

  return { successful, failed, total: pages.length };
};

module.exports = {
  convertStaticPages,
  STATIC_PAGES,
  getStaticPages,
};
