const fs = require('fs');
const path = require('path');
const config = require('../config');
const { ensureDir, readHtmlFile } = require('../utils/filesystem');

/**
 * Slugify a string for comparison
 * Converts to lowercase, removes special characters, replaces spaces with hyphens
 */
const slugify = (str) => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Load all product titles from the products directory
 * Returns an array of { title, slug, path } objects
 */
const loadProductTitles = () => {
  const productsDir = path.join(config.OUTPUT_BASE, 'products');
  
  if (!fs.existsSync(productsDir)) {
    return [];
  }
  
  const products = [];
  const files = fs.readdirSync(productsDir).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const filepath = path.join(productsDir, file);
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Extract title from frontmatter
    const titleMatch = content.match(/^title:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      products.push({
        title,
        slug: slugify(title),
        path: `products/${file}`
      });
    }
  }
  
  return products;
};

/**
 * Find products mentioned in review content
 * Returns array of product paths like "products/magic-mirror.md"
 */
const findMentionedProducts = (reviewContent, products) => {
  const slugifiedContent = slugify(reviewContent);
  const mentionedProducts = [];
  
  for (const product of products) {
    // Check if the slugified product title appears in the slugified review content
    if (slugifiedContent.includes(product.slug)) {
      mentionedProducts.push(product.path);
    }
  }
  
  return mentionedProducts;
};

/**
 * Parse a date string like "2025-10-28" or "Oct 2025" into a Date object
 */
const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  
  // Try ISO format first (from datetime attribute)
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try "Mon YYYY" format
  const monthYearMatch = dateStr.match(/^(\w+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const months = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const month = months[monthYearMatch[1]];
    const year = parseInt(monthYearMatch[2]);
    if (month !== undefined && year) {
      return new Date(year, month, 1);
    }
  }
  
  return new Date();
};

/**
 * Clean HTML content and convert to plain text
 */
const cleanContent = (html) => {
  if (!html) return '';
  
  return html
    // Remove nested divs and paragraphs, keep content
    .replace(/<(div|p)[^>]*>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    // Convert <br> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove image tags (some reviews are just images)
    .replace(/<img[^>]*>/gi, '')
    // Remove anchor tags but keep text
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
};

/**
 * Generate a safe filename from author name and date
 */
const generateFilename = (author, date) => {
  const safeName = (author || 'anonymous')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30)
    .replace(/-+$/, ''); // Remove trailing dashes
  
  const dateStr = date instanceof Date && !isNaN(date)
    ? date.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  
  return `${safeName}-${dateStr}.md`;
};

/**
 * Extract reviews from the testimonials HTML page
 */
const extractReviews = (htmlContent) => {
  const reviews = [];
  
  // Match each review panel with schema.org Review markup
  // Pattern matches the panel div containing itemscope="itemscope" itemtype="https://schema.org/Review"
  const reviewRegex = /<div class="panel panel-default"[^>]*itemscope="itemscope"[^>]*itemtype="https:\/\/schema\.org\/Review"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="panel panel-default"|<\/div>\s*$)/gi;
  
  // Simpler approach - find all review content blocks
  // Author: <span itemprop="name">NAME</span>
  // Date: <time itemprop="dateCreated" datetime="DATE">
  // Content: <div itemprop="reviewBody">CONTENT</div>
  
  // Extract author names
  const authorMatches = [...htmlContent.matchAll(/<span itemprop="author"[^>]*itemtype="https:\/\/schema\.org\/Person"[^>]*itemscope="itemscope"[^>]*>\s*<span itemprop="name">([^<]+)<\/span>/gi)];
  
  // Extract dates
  const dateMatches = [...htmlContent.matchAll(/<time itemprop="dateCreated" datetime="([^"]+)">/gi)];
  
  // Extract review bodies
  const bodyMatches = [...htmlContent.matchAll(/<div itemprop="reviewBody">([\s\S]*?)<\/div>/gi)];
  
  // Combine matches into review objects
  const count = Math.min(authorMatches.length, dateMatches.length, bodyMatches.length);
  
  for (let i = 0; i < count; i++) {
    const author = authorMatches[i][1].trim();
    const dateStr = dateMatches[i][1];
    const bodyHtml = bodyMatches[i][1];
    
    const content = cleanContent(bodyHtml);
    const date = parseDate(dateStr);
    
    // Skip reviews that are just images or have no meaningful content
    if (content.length < 10) {
      continue;
    }
    
    reviews.push({
      author,
      date,
      content,
      rating: 5 // All reviews on the site appear to be positive/5-star
    });
  }
  
  return reviews;
};

/**
 * Save a review as a markdown file
 */
const saveReview = (review, outputDir, products = []) => {
  const filename = generateFilename(review.author, review.date);
  const filepath = path.join(outputDir, filename);
  
  // Find mentioned products in this review
  const mentionedProducts = findMentionedProducts(review.content, products);
  
  const dateStr = review.date instanceof Date && !isNaN(review.date)
    ? review.date.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  
  // Build products line if there are any mentioned products
  const productsLine = mentionedProducts.length > 0
    ? `products: ${JSON.stringify(mentionedProducts)}\n`
    : '';
  
  const content = `---
name: "${review.author.replace(/"/g, '\\"')}"
date: ${dateStr}
rating: ${review.rating}
source: testimonial
${productsLine}---

${review.content}
`;
  
  fs.writeFileSync(filepath, content);
  return { saved: true, skipped: false, filename, productsCount: mentionedProducts.length };
};

/**
 * Convert reviews from old site testimonials page
 * @returns {Promise<Object>} Conversion results
 */
const convertReviews = async () => {
  console.log('Converting reviews from testimonials page...');
  
  const outputDir = path.join(config.OUTPUT_BASE, 'reviews');
  ensureDir(outputDir);
  
  // Load product titles for matching
  const products = loadProductTitles();
  console.log(`  Loaded ${products.length} product titles for matching`);
  
  const inputPath = path.join(config.OLD_SITE_PATH, 'pages', 'testimonials.html');
  
  if (!fs.existsSync(inputPath)) {
    console.error('  Error: testimonials.html not found');
    return { successful: 0, failed: 1, total: 1 };
  }
  
  const htmlContent = readHtmlFile(inputPath);
  const reviews = extractReviews(htmlContent);
  
  console.log(`  Found ${reviews.length} reviews with content`);
  
  let saved = 0;
  let withProducts = 0;
  
  for (const review of reviews) {
    const result = saveReview(review, outputDir, products);
    if (result.saved) {
      saved++;
      if (result.productsCount > 0) {
        withProducts++;
        console.log(`  ✓ ${result.filename} (${result.productsCount} product${result.productsCount > 1 ? 's' : ''})`);
      } else {
        console.log(`  ✓ ${result.filename}`);
      }
    }
  }
  
  console.log(`\n  Saved ${saved} reviews (${withProducts} with product links)`);
  
  return { successful: saved, failed: 0, total: reviews.length };
};

module.exports = {
  convertReviews
};
