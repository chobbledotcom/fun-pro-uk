const path = require("path");
const fs = require("fs");
const config = require("../config");
const { ensureDir, readHtmlFile } = require("../utils/filesystem");
const { extractMetadata } = require("../utils/metadata-extractor");
const { convertToMarkdown } = require("../utils/pandoc-converter");
const { processContent } = require("../utils/content-processor");

/**
 * Convert reviews/testimonials page from old site
 * Creates pages/testimonials.md with reviews.html layout and About Us as parent
 * @returns {Promise<Object>} Conversion results
 */
const convertReviewsIndex = async () => {
  console.log("Converting reviews page...");

  const outputDir = path.join(config.OUTPUT_BASE, "pages");
  ensureDir(outputDir);

  const inputPath = path.join(
    config.OLD_SITE_PATH,
    "pages",
    "testimonials.html",
  );

  if (!fs.existsSync(inputPath)) {
    console.error("  Error: testimonials.html not found");
    return { successful: 0, failed: 1, total: 1 };
  }

  try {
    const htmlContent = readHtmlFile(inputPath);
    const metadata = extractMetadata(htmlContent);
    const markdown = convertToMarkdown(inputPath);
    let content = processContent(markdown, "page", htmlContent);

    // The reviews are imported separately via reviews-converter.js
    // We only want the intro text before the first review panel starts
    // Review panels start with "#### [" pattern (h4 with link for reviewer name)
    const firstReviewIndex = content.indexOf("#### [");
    if (firstReviewIndex !== -1) {
      content = content.substring(0, firstReviewIndex).trim();
    }

    // Also remove "Click Here" link if it appears before reviews
    const linkIndex = content.indexOf("[Click Here To Leave A Review!]");
    if (linkIndex !== -1) {
      content = content.substring(0, linkIndex).trim();
    }

    // Ensure content starts with H1
    const hasH1 = /^#\s+/.test(content.trim());
    if (!hasH1) {
      const heading = metadata.header_text || metadata.title || "Testimonials";
      content = `# ${heading}\n\n${content}`;
    }

    // Extract nav key from page title (first word before the pipe)
    // e.g., "Testimonials | Corporate Entertainment Reviews | Fun Pro UK" -> "Testimonials"
    const navKey = metadata.title ? metadata.title.split("|")[0].trim() : null;

    if (!navKey) {
      throw new Error("Could not extract nav key from page title");
    }
    if (!metadata.title) {
      throw new Error("Could not extract meta title from page");
    }

    // Generate frontmatter with reviews.html layout and About Us as parent
    const frontmatter = `---
meta_title: "${metadata.title}"
meta_description: "${metadata.meta_description || ""}"
layout: reviews.html
permalink: /testimonials/
redirect_from:
  - "/pages/testimonials/"
eleventyNavigation:
  key: "${navKey}"
  parent: "About us"
  order: 1
---`;

    const fullContent = `${frontmatter}\n\n${content}`;
    const outputPath = path.join(outputDir, "testimonials.md");

    fs.writeFileSync(outputPath, fullContent);
    console.log("  ✓ testimonials.md");

    return { successful: 1, failed: 0, total: 1 };
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return { successful: 0, failed: 1, total: 1 };
  }
};

module.exports = {
  convertReviewsIndex,
};
