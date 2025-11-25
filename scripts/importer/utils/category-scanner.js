const path = require('path');
const { readHtmlFile, listHtmlFiles } = require('./filesystem');
const config = require('../config');

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

  // Must end with .html for product pages in old site structure
  if (!href.endsWith('.html')) {
    return null;
  }

  // Extract the path without .html extension
  let cleanPath = href.replace(/\.html$/, '').replace(/^\.\.\//, '').replace(/^\//, '');

  // Split into segments
  const segments = cleanPath.split('/').filter(Boolean);
  
  // Need at least 2 segments for a product (category/product or category/id/product)
  // Single segment links are category links (like arcade-games.html)
  if (segments.length < 2) {
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
  // Look for the PageListings div which contains product cards
  const pageListingsMatch = htmlContent.match(/<div id="ctl00_PageListingsPanel"[^>]*class="page-listings[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div id="BelowProductsContentPanel"/);
  
  if (pageListingsMatch) {
    return pageListingsMatch[1];
  }

  // Alternative: look for PageListings div by ID
  const altMatch = htmlContent.match(/<div id="PageListings"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
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
    // Pattern: href="category/id/product-slug.html" or href="category/product-slug.html"
    const castleLinkRegex = /href="([^"]+\.html)"[^>]*class="(?:castleLink|castleCheckBook)[^"]*"/g;
    const altLinkRegex = /class="(?:castleLink|castleCheckBook)[^"]*"[^>]*href="([^"]+\.html)"/g;
    
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
 * Get the complete product-to-categories mapping
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
  getProductCategoriesMap,
  extractProductSlug
};
