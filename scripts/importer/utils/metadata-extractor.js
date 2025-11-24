const { patterns, extract } = require('./html-patterns');

/**
 * Extract breadcrumb text from HTML content
 * @param {string} htmlContent - HTML content to extract breadcrumb from
 * @returns {string|null} Extracted breadcrumb text or null
 */
const extractBreadcrumbText = (htmlContent) => {
  const breadcrumbMatch = htmlContent.match(/<li\s+class=["']breadcrumb-item\s+active["']>([^<]+)<\/li>/i);
  return breadcrumbMatch ? breadcrumbMatch[1].trim() : null;
};

/**
 * Extract the main H1 heading from content
 * @param {string} htmlContent - HTML content to extract H1 from
 * @returns {string|null} Extracted H1 text or null
 */
const extractContentHeading = (htmlContent) => {
  // Find the main content H1 (not in header/footer/nav)
  const h1Match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    return h1Match[1]
      .replace(/<[^>]+>/g, '') // Remove any HTML tags inside
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&pound;/g, '£')
      .trim();
  }
  return null;
};

// Alias for backward compatibility
const extractBlogHeading = extractContentHeading;

/**
 * Extract metadata from HTML content using regex patterns
 * @param {string} htmlContent - HTML content to extract metadata from
 * @returns {Object} Extracted metadata
 */
const extractMetadata = (htmlContent) => {
  const metadata = {};

  const title = extract(htmlContent, patterns.title);
  if (title) {
    metadata.title = title;
  }

  const description = extract(htmlContent, patterns.metaTag('description'));
  if (description) {
    metadata.meta_description = description;
  }

  const canonical = extract(htmlContent, patterns.linkRel('canonical'));
  if (canonical) {
    const urlPath = canonical.replace(/^.*?\/([^\/]+\.php).*$/, '$1').replace('.php', '');
    metadata.permalink = `/${urlPath}/`;
  }

  // Extract header text: prefer breadcrumb over og:title for cleaner names
  const breadcrumbText = extractBreadcrumbText(htmlContent);
  if (breadcrumbText) {
    metadata.header_text = breadcrumbText;
  } else {
    // Fallback to og:title
    const ogTitle = extract(htmlContent, patterns.metaProperty('og:title'));
    if (ogTitle) {
      metadata.header_text = ogTitle;
    }
  }

  return metadata;
};

/**
 * Extract price from HTML content
 * @param {string} htmlContent - HTML content to extract price from
 * @returns {string} Extracted price with currency symbol
 */
const extractPrice = (htmlContent) => {
  // Try to extract from price table
  const priceTableMatch = htmlContent.match(/Our Price:<\/th>\s*<td[^>]*>\s*&pound;([\d,]+\.?\d*)/i);
  if (priceTableMatch) {
    return `£${priceTableMatch[1]}`;
  }

  // Fallback: look for price in JSON-LD schema
  const schemaMatch = htmlContent.match(/"price":"([\d,]+\.?\d*)"/i);
  if (schemaMatch) {
    return `£${schemaMatch[1]}`;
  }

  return '';
};

/**
 * Extract category from breadcrumbs
 * @param {string} htmlContent - HTML content to extract category from
 * @returns {string} Extracted category
 */
const extractCategory = (htmlContent) => {
  const breadcrumbMatch = htmlContent.match(/<li class="breadcrumb-item"><a href="\.\.\/categories\/([^"]+)\.php\.html">/i);
  return breadcrumbMatch ? breadcrumbMatch[1] : '';
};

/**
 * Extract category name from active breadcrumb
 * @param {string} htmlContent - HTML content to extract category name from
 * @returns {string} Extracted category name
 */
const extractCategoryName = (htmlContent) => {
  return extractBreadcrumbText(htmlContent) || '';
};

/**
 * Extract product name from JSON-LD schema or breadcrumb
 * @param {string} htmlContent - HTML content to extract product name from
 * @returns {string} Extracted product name
 */
const extractProductName = (htmlContent) => {
  // Try JSON-LD schema first
  const schemaMatch = htmlContent.match(/"@type":"Product","name":"([^"]+)"/i);
  if (schemaMatch) {
    return schemaMatch[1].replace(/&pound;/g, '£');
  }

  // Fallback to breadcrumb
  const breadcrumbText = extractBreadcrumbText(htmlContent);
  if (breadcrumbText) {
    return breadcrumbText.replace(/&pound;/g, '£');
  }

  return '';
};

/**
 * Extract blog post date from content
 * @param {string} content - Markdown content to extract date from
 * @param {string} defaultDate - Default date to use if none found
 * @returns {string} Date in YYYY-MM-DD format
 */
const extractBlogDate = (content, defaultDate = '2020-01-01') => {
  const dateMatch = content.match(/Posted Date:\s*(?:[A-Za-z]+,\s*)?(.+?)(?:\n|$|\\)/);
  if (dateMatch) {
    const dateStr = dateMatch[1].trim();

    // Parse date string directly without Date constructor to avoid timezone issues
    const monthNames = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };

    // Format: "Month Day, Year" (e.g., "June 10, 2024")
    const match = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (match) {
      const month = monthNames[match[1].toLowerCase()];
      const day = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }
  return defaultDate;
};

/**
 * Extract reviews from product HTML
 * @param {string} htmlContent - HTML content to extract reviews from
 * @returns {Array<Object>} Array of review objects with name and body
 */
const extractReviews = (htmlContent) => {
  const reviews = [];
  const reviewTableMatch = htmlContent.match(/<div class="menu-heading[^>]*>Our Reviews!<\/div>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/);

  if (!reviewTableMatch) {
    return reviews;
  }

  const tableContent = reviewTableMatch[1];
  const rowRegex = /<tr>\s*<td>[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?<div class="diblock" itemprop="description">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<\/td>\s*<\/tr>/g;

  let match;
  while ((match = rowRegex.exec(tableContent)) !== null) {
    const name = match[1].trim();
    const body = match[2].trim().replace(/\s+/g, ' ');

    if (name && body) {
      reviews.push({ name, body });
    }
  }

  return reviews;
};

/**
 * Extract product images from HTML content
 * @param {string} htmlContent - HTML content to extract images from
 * @returns {Object} Object with header_image and gallery array
 */
const extractProductImages = (htmlContent) => {
  const images = {
    header_image: '',
    gallery: []
  };

  // Extract og:image for header image
  const ogImageMatch = htmlContent.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  if (ogImageMatch) {
    images.header_image = ogImageMatch[1];
    // Use header image as the single gallery image
    images.gallery.push(ogImageMatch[1]);
  }

  return images;
};

/**
 * Extract blog post image from markdown content
 * @param {string} markdown - Markdown content to extract image from
 * @returns {string} Image URL or empty string
 */
const extractBlogImage = (markdown) => {
  // Look for image in markdown: ![alt text](url)
  const imageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
  return imageMatch ? imageMatch[1] : '';
};

/**
 * Extract favicon links from HTML content
 * @param {string} htmlContent - HTML content to extract favicon links from
 * @returns {Array<Object>} Array of favicon link objects
 */
const extractFaviconLinks = (htmlContent) => {
  const faviconLinks = [];

  // Match all link tags that might be favicon-related
  const linkRegex = /<link\s+([^>]*?)>/gi;
  const links = htmlContent.matchAll(linkRegex);

  for (const linkMatch of links) {
    const linkTag = linkMatch[1];

    // Check if this is a favicon-related link
    const relMatch = linkTag.match(/rel=["']([^"']*?)["']/i);
    if (!relMatch) continue;

    const rel = relMatch[1].toLowerCase();
    const isFavicon = rel.includes('icon') || rel.includes('apple-touch');

    if (!isFavicon) continue;

    // Extract attributes
    const hrefMatch = linkTag.match(/href=["']([^"']*?)["']/i);
    const sizesMatch = linkTag.match(/sizes=["']([^"']*?)["']/i);
    const typeMatch = linkTag.match(/type=["']([^"']*?)["']/i);

    if (hrefMatch) {
      faviconLinks.push({
        rel,
        href: hrefMatch[1],
        sizes: sizesMatch ? sizesMatch[1] : null,
        type: typeMatch ? typeMatch[1] : null
      });
    }
  }

  return faviconLinks;
};

module.exports = {
  extractBreadcrumbText,
  extractContentHeading,
  extractBlogHeading,
  extractMetadata,
  extractPrice,
  extractCategory,
  extractCategoryName,
  extractProductName,
  extractBlogDate,
  extractReviews,
  extractProductImages,
  extractBlogImage,
  extractFaviconLinks
};
