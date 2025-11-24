const { parseSpecificationTables } = require('./markdown-table-parser');
const { extractSpecificationTable, extractPriceTable } = require('./html-table-extractor');

/**
 * Extract main content from markdown (remove nav, footer, etc.)
 * @param {string} markdown - Raw markdown content
 * @param {string} contentType - Type of content (blog, page, product, category)
 * @returns {string} Extracted main content
 */
const extractMainContent = (markdown, contentType) => {
  const lines = markdown.split('\n');
  let content = [];
  let inMainContent = false;
  let skipNext = false;
  let inReviewSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip navigation and header elements
    if (line.includes('navbar') || line.includes('drawer') || line.includes('breadcrumb')) {
      skipNext = true;
      continue;
    }

    // Skip forms (contact forms should be handled by layout)
    // Only break on actual form field labels (with escaped asterisk), not contact information
    if (line.includes('**Name: \\*') || line.includes('**Phone: \\*') ||
        line.includes('**Email: \\*') || line.includes('**Product Enquiry:') ||
        line.includes('**Your Postcode:') || line.includes('**Message:') ||
        line.includes('**Captcha:')) {
      break;
    }

    // Detect start of review section and skip until we hit "Our Prices!" or new heading
    if (line.includes('Our Reviews!')) {
      inReviewSection = true;
      continue;
    }

    // Exit review section when we hit "Our Prices!" or a main heading
    if (inReviewSection && (line.includes('Our Prices!') || line.match(/^# [A-Z]/))) {
      inReviewSection = false;
      // Don't skip "Our Prices!" - we want to keep it
    }

    // Skip content while in review section
    if (inReviewSection) {
      continue;
    }

    // Skip footer content
    if (line.includes('footer') || line.includes('widget_section')) {
      break;
    }

    // Look for main content indicators based on content type
    if (contentType === 'blog' && (line.includes('# ') || line.includes('Posted By:'))) {
      inMainContent = true;
    } else if ((contentType === 'page' || contentType === 'product' || contentType === 'category') && line.includes('# ')) {
      inMainContent = true;
    }

    if (inMainContent && !skipNext) {
      content.push(line);
    }

    skipNext = false;
  }

  return content.join('\n').trim();
};

/**
 * Remove product listings from category content
 * Product listings appear as:
 * #### Showing N results
 * Sort Products By: ...
 * [](../products/slug.php.html "View More")
 * ### Product Name
 * ...
 * [More Details](/products/slug.php)
 * @param {string} content - Content to clean
 * @returns {string} Content with product listings removed
 */
const removeProductListings = (content) => {
  // Remove everything from "#### Showing" to the end of the content
  // This section contains the product grid
  content = content.replace(/####\s+Showing\s+\d+\s+results[\s\S]*$/i, '');

  // Also remove any remaining product link patterns
  content = content.replace(/\[]\([^)]*\/products\/[^)]+\.php\.html[^)]*\)[\s\S]*?\[More Details]\([^)]+\)/g, '');

  return content;
};

/**
 * Clean up content by removing unwanted markdown artifacts
 * @param {string} content - Content to clean
 * @param {string} contentType - Type of content (for context-specific cleaning)
 * @returns {string} Cleaned content
 */
const cleanContent = (content, contentType) => {
  // Remove product listings from category pages
  if (contentType === 'category') {
    content = removeProductListings(content);
  }

  // For blog posts, remove H4 breadcrumb titles
  if (contentType === 'blog') {
    content = content.replace(/^####\s+.+$/gm, '');
  }

  content = content.trim();

  return content
    .replace(/Posted By:.*?\n/g, '') // Remove blog post metadata
    .replace(/^\[\s*Back [Tt]o\s+[^\]]+\]\([^)]+\)(\{[^}]+\})?\s*$/gm, '') // Remove "Back to" links
    .replace(/^:::\s*.*$/gm, '') // Remove all pandoc div markers
    .replace(/\{[^}]*\}/g, '') // Remove any remaining attribute blocks
    .replace(/\[ \]/g, '') // Remove empty checkbox markers
    // Remove broken cloudinary image links
    .replace(/^!\[.*?\]\(https:\/\/res\.cloudinary\.com\/kbs\/image\/upload\/\)\s*$/gm, '')
    // Fix multiple asterisks
    .replace(/\*{3,}/g, '**')
    .replace(/\*\*[ \t\u00A0]+\*\*/g, '**')
    // Fix space (including nbsp) before/after ** at end of line
    .replace(/[ \t\u00A0]+\*\*[ \t\u00A0]*$/gm, '**')
    // Remove trailing backslashes
    .replace(/\\[ \t]*$/gm, '')
    // Fix relative links: ../pages/foo.php.html -> /pages/foo/
    .replace(/\(\.\.\/([^)]+)\.php\.html\)/g, '(/$1/)')
    // Normalize whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

/**
 * Process raw markdown to extract and clean content
 * @param {string} markdown - Raw markdown from pandoc
 * @param {string} contentType - Type of content
 * @param {string} htmlContent - Original HTML content (for product tables)
 * @returns {string} Processed and cleaned content
 */
const processContent = (markdown, contentType, htmlContent = null) => {
  const extracted = extractMainContent(markdown, contentType);
  let cleaned = cleanContent(extracted, contentType);

  // For products, extract tables from HTML and inject into markdown content
  if (contentType === 'product' && htmlContent) {
    const specs = extractSpecificationTable(htmlContent);
    const prices = extractPriceTable(htmlContent);

    // Remove the placeholder sections and replace with HTML-extracted content
    cleaned = cleaned.replace(/Product Specifications![\s\S]*?(?=Our Prices!|$)/i, specs + '\n\n');
    cleaned = cleaned.replace(/Our Prices![\s\S]*?(?=\n\n-{5,}|$)/i, prices);
  }

  return cleaned;
};

module.exports = {
  extractMainContent,
  cleanContent,
  processContent
};