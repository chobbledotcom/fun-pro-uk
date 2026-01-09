const path = require('path');
const { readHtmlFile, listHtmlFiles, slugFromFilename } = require('./filesystem');
const config = require('../config');
const { EVENT_PAGES, EVENT_CATEGORIES } = require('../constants');

/**
 * Extract product slug from a product link href
 * Only matches product page links (paths with at least category/id/slug or category/slug pattern)
 * @param {string} href - The href attribute value
 * @returns {string|null} The product slug or null if not a valid product link
 */
const extractProductSlug = (href) => {
  if (!href) return null;

  // Remove leading/trailing whitespace
  href = href.trim();

  // Skip external links, anchors, mailto, tel, etc.
  if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }

  // Skip links to pages/, news/, blog/ directories
  if (href.includes('/pages/') || href.includes('/news/') || href.includes('/blog/')) {
    return null;
  }

  // Skip links with anchors like exhibition-games.html#BodyContent
  if (href.includes('#')) {
    return null;
  }

  // Extract the path, removing .html extension if present
  // Product pages may or may not have .html extension in category page links
  let cleanPath = href.replace(/\.html$/, '').replace(/^\.\.\//, '').replace(/^\//, '');

  // Split into segments
  const segments = cleanPath.split('/').filter(Boolean);

  // Product links have format: category/category-name/id/product-slug or category/category-name/product-slug
  // Category links have format: category/category-name
  // Need at least 3 segments for a product (category/category-name/id or category/category-name/product)
  if (segments.length < 3) {
    return null;
  }

  // First segment should be 'category'
  if (segments[0] !== 'category') {
    return null;
  }

  // The product slug is the last segment
  const productSlug = segments[segments.length - 1];

  // Product slugs should contain hyphens (multi-word) or be alphanumeric
  // Skip slugs that are just numbers (these are IDs)
  if (/^\d+$/.test(productSlug)) {
    return null;
  }

  return productSlug;
};

/**
 * Extract the PageListings section from HTML content
 * This is where the actual product listings appear on category pages
 * @param {string} htmlContent - Full HTML content
 * @returns {string} The PageListings section content or empty string
 */
const extractPageListings = (htmlContent) => {
  // Look for the inner PageListings div which contains product cards
  // Capture everything from PageListings opening tag to BelowProductsContentPanel marker
  // This avoids issues with matching nested closing </div> tags
  const pageListingsMatch = htmlContent.match(/<div id="PageListings"[^>]*>([\s\S]*?)<div id="BelowProductsContentPanel"/);

  if (pageListingsMatch) {
    return pageListingsMatch[1];
  }

  // Alternative: look for outer PageListingsPanel and capture until BelowProductsContentPanel
  const outerMatch = htmlContent.match(/<div id="ctl00_PageListingsPanel"[^>]*class="page-listings[^"]*"[^>]*>([\s\S]*?)<div id="BelowProductsContentPanel"/);
  if (outerMatch) {
    return outerMatch[1];
  }

  // Final fallback: look for PageListings div by ID - capture until photo-gallery section
  const altMatch = htmlContent.match(/<div id="PageListings"[^>]*>([\s\S]*?)(?:<div id="ctl00_PhotoGallery"|<div class="photo-gallery)/i);
  if (altMatch) {
    return altMatch[1];
  }

  return '';
};

/**
 * Scan all category HTML files to build a map of product slugs to their categories
 * @returns {Map<string, string[]>} Map of product slug to array of category slugs
 */
const scanProductCategories = () => {
  const productCategoriesMap = new Map();

  const categoriesDir = path.join(config.OLD_SITE_PATH, config.paths.categoriesSource);
  const categoryFiles = listHtmlFiles(categoriesDir);

  if (categoryFiles.length === 0) {
    console.log('  No category files found in', categoriesDir);
    return productCategoriesMap;
  }

  console.log(`  Found ${categoryFiles.length} category files to scan`);

  categoryFiles.forEach(file => {
    // Get category slug from filename (remove .html extension)
    const categorySlug = file.replace('.html', '');
    const htmlPath = path.join(categoriesDir, file);
    const htmlContent = readHtmlFile(htmlPath);

    // Extract only the PageListings section to avoid picking up navigation links
    const pageListings = extractPageListings(htmlContent);
    
    if (!pageListings) {
      // Fallback: scan the whole content but be more restrictive
      // Only look for castleLink class links which are the product title links
    }

    const foundSlugs = new Set();
    const contentToScan = pageListings || htmlContent;

    // Find all product links in castlePanel divs
    // Products are linked with class="castleLink" (title) or class="castleCheckBook" (button)
    // Pattern: href="category/id/product-slug" or href="category/product-slug" (may or may not have .html)
    const castleLinkRegex = /href="([^"]+)"[^>]*class="(?:castleLink|castleCheckBook)[^"]*"/g;
    const altLinkRegex = /class="(?:castleLink|castleCheckBook)[^"]*"[^>]*href="([^"]+)"/g;
    
    let match;

    // Try first pattern
    while ((match = castleLinkRegex.exec(contentToScan)) !== null) {
      const href = match[1];
      const productSlug = extractProductSlug(href);
      if (productSlug) {
        foundSlugs.add(productSlug);
      }
    }

    // Try alternate pattern (class before href)
    while ((match = altLinkRegex.exec(contentToScan)) !== null) {
      const href = match[1];
      const productSlug = extractProductSlug(href);
      if (productSlug) {
        foundSlugs.add(productSlug);
      }
    }

    // Add each found product to the map with this category
    foundSlugs.forEach(productSlug => {
      if (!productCategoriesMap.has(productSlug)) {
        productCategoriesMap.set(productSlug, []);
      }

      const categories = productCategoriesMap.get(productSlug);
      // Use categories/slug.md format to match pagescms editor
      const categoryPath = `categories/${categorySlug}.md`;
      if (!categories.includes(categoryPath)) {
        categories.push(categoryPath);
      }
    });
  });

  console.log(`  Built category map for ${productCategoriesMap.size} products`);
  return productCategoriesMap;
};

/**
 * Scan product files in the category directory structure to get category assignments
 * based on where the product file physically resides
 * @returns {Map<string, string[]>} Map of product slug to array of category slugs
 */
const scanProductCategoriesFromFileStructure = () => {
  const productCategoriesMap = new Map();
  const { listHtmlFilesRecursive } = require('./filesystem');
  
  const categoryDir = path.join(config.OLD_SITE_PATH, 'category');
  const allFiles = listHtmlFilesRecursive(categoryDir);

  // Filter out top-level category files (keep only product files in subdirectories)
  const productFiles = allFiles.filter(f => f.relativePath.includes(path.sep));

  productFiles.forEach(fileInfo => {
    // Extract category and product slug from path like "arcade-games/111/roller-bowler.html"
    const parts = fileInfo.relativePath.split(path.sep);
    if (parts.length >= 2) {
      const categorySlug = parts[0]; // e.g., "arcade-games"
      const productSlug = parts[parts.length - 1].replace('.html', ''); // e.g., "roller-bowler"

      if (!productCategoriesMap.has(productSlug)) {
        productCategoriesMap.set(productSlug, []);
      }

      const categories = productCategoriesMap.get(productSlug);
      // Use categories/slug.md format to match pagescms editor
      const categoryPath = `categories/${categorySlug}.md`;
      if (!categories.includes(categoryPath)) {
        categories.push(categoryPath);
      }
    }
  });

  return productCategoriesMap;
};

/**
 * Merge two product category maps, combining categories for each product
 * @param {Map<string, string[]>} map1 
 * @param {Map<string, string[]>} map2 
 * @returns {Map<string, string[]>} Merged map
 */
const mergeCategoryMaps = (map1, map2) => {
  const merged = new Map(map1);

  map2.forEach((categories, productSlug) => {
    if (!merged.has(productSlug)) {
      merged.set(productSlug, []);
    }
    const existingCategories = merged.get(productSlug);
    categories.forEach(cat => {
      if (!existingCategories.includes(cat)) {
        existingCategories.push(cat);
      }
    });
  });

  return merged;
};

/**
 * Scan event pages (from EVENT_PAGES and EVENT_CATEGORIES) for product links
 * Returns a map of product slugs to event paths
 * @returns {Map<string, string[]>} Map of product slug to array of event paths
 */
const scanEventProducts = () => {
  const productEventsMap = new Map();
  const fs = require('fs');

  // Scan EVENT_PAGES (pages that are events)
  const pagesDir = path.join(config.OLD_SITE_PATH, 'pages');
  EVENT_PAGES.forEach(eventSlug => {
    // Try both naming patterns: slug.html and slug.php.html
    let htmlPath = path.join(pagesDir, `${eventSlug}.html`);
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(pagesDir, `${eventSlug}.php.html`);
    }
    
    try {
      const htmlContent = readHtmlFile(htmlPath);
      const pageListings = extractPageListings(htmlContent);
      const contentToScan = pageListings || htmlContent;

      const foundSlugs = new Set();
      const castleLinkRegex = /href="([^"]+)"[^>]*class="(?:castleLink|castleCheckBook)[^"]*"/g;
      const altLinkRegex = /class="(?:castleLink|castleCheckBook)[^"]*"[^>]*href="([^"]+)"/g;

      let match;
      while ((match = castleLinkRegex.exec(contentToScan)) !== null) {
        const productSlug = extractProductSlug(match[1]);
        if (productSlug) foundSlugs.add(productSlug);
      }
      while ((match = altLinkRegex.exec(contentToScan)) !== null) {
        const productSlug = extractProductSlug(match[1]);
        if (productSlug) foundSlugs.add(productSlug);
      }

      foundSlugs.forEach(productSlug => {
        if (!productEventsMap.has(productSlug)) {
          productEventsMap.set(productSlug, []);
        }
        const events = productEventsMap.get(productSlug);
        const eventPath = `events/${eventSlug}.md`;
        if (!events.includes(eventPath)) {
          events.push(eventPath);
        }
      });
    } catch (e) {
      // File might not exist, skip
    }
  });

  // Scan EVENT_CATEGORIES (categories that are events)
  const categoriesDir = path.join(config.OLD_SITE_PATH, config.paths.categoriesSource);
  EVENT_CATEGORIES.forEach(eventSlug => {
    const htmlPath = path.join(categoriesDir, `${eventSlug}.html`);
    try {
      const htmlContent = readHtmlFile(htmlPath);
      const pageListings = extractPageListings(htmlContent);
      const contentToScan = pageListings || htmlContent;

      const foundSlugs = new Set();
      const castleLinkRegex = /href="([^"]+)"[^>]*class="(?:castleLink|castleCheckBook)[^"]*"/g;
      const altLinkRegex = /class="(?:castleLink|castleCheckBook)[^"]*"[^>]*href="([^"]+)"/g;

      let match;
      while ((match = castleLinkRegex.exec(contentToScan)) !== null) {
        const productSlug = extractProductSlug(match[1]);
        if (productSlug) foundSlugs.add(productSlug);
      }
      while ((match = altLinkRegex.exec(contentToScan)) !== null) {
        const productSlug = extractProductSlug(match[1]);
        if (productSlug) foundSlugs.add(productSlug);
      }

      foundSlugs.forEach(productSlug => {
        if (!productEventsMap.has(productSlug)) {
          productEventsMap.set(productSlug, []);
        }
        const events = productEventsMap.get(productSlug);
        const eventPath = `events/${eventSlug}.md`;
        if (!events.includes(eventPath)) {
          events.push(eventPath);
        }
      });
    } catch (e) {
      // File might not exist, skip
    }
  });

  return productEventsMap;
};

/**
 * Get the complete product-to-categories mapping (categories only, not events)
 * Combines file structure analysis with category page link scanning
 * @returns {Map<string, string[]>} Map of product slug to array of category slugs
 */
const getProductCategoriesMap = () => {
  console.log('  Scanning product categories from file structure...');
  const structureMap = scanProductCategoriesFromFileStructure();
  console.log(`    Found ${structureMap.size} products from file structure`);

  console.log('  Scanning category pages for product links...');
  const linksMap = scanProductCategories();
  console.log(`    Found ${linksMap.size} products from category page links`);

  const merged = mergeCategoryMaps(structureMap, linksMap);
  console.log(`  Total: ${merged.size} products with category mappings`);

  return merged;
};

/**
 * Get the product-to-events mapping
 * @returns {Map<string, string[]>} Map of product slug to array of event paths
 */
const getProductEventsMap = () => {
  console.log('  Scanning event pages for product links...');
  const eventsMap = scanEventProducts();
  console.log(`    Found ${eventsMap.size} products linked from events`);
  return eventsMap;
};

/**
 * Get the category-to-products mapping (inverse of product-to-categories)
 * @returns {Map<string, string[]>} Map of category slug to array of product slugs
 */
const scanCategoryProducts = () => {
  const categoryProductsMap = new Map();
  const productCategoriesMap = getProductCategoriesMap();

  productCategoriesMap.forEach((categories, productSlug) => {
    categories.forEach(categoryPath => {
      // Extract slug from categories/slug.md format
      const categorySlug = categoryPath.replace(/^categories\//, '').replace(/\.md$/, '');
      if (!categoryProductsMap.has(categorySlug)) {
        categoryProductsMap.set(categorySlug, []);
      }
      categoryProductsMap.get(categorySlug).push(productSlug);
    });
  });

  return categoryProductsMap;
};

module.exports = {
  scanProductCategories,
  scanCategoryProducts,
  scanProductCategoriesFromFileStructure,
  scanEventProducts,
  getProductCategoriesMap,
  getProductEventsMap,
  extractProductSlug
};
