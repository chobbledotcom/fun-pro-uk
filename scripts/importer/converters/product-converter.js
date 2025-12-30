const fs = require('node:fs');
const path = require('path');
const config = require('../config');
const { listHtmlFiles, listHtmlFilesRecursive, prepDir, writeMarkdownFile } = require('../utils/filesystem');
const { extractPrice, extractReviews, extractProductName, extractProductImages, extractContentHeading, extractFAQs } = require('../utils/metadata-extractor');
const { faqPatterns } = require('../utils/html-patterns');
const { stripFAQSection, hasFAQSection } = require('../utils/content-processor');
const { generateProductFrontmatter, generateReviewFrontmatter } = require('../utils/frontmatter-generator');
const { downloadProductImage, downloadProductGallery, downloadEmbeddedImages } = require('../utils/image-downloader');
const { getProductCategoriesMap, getProductEventsMap } = require('../utils/category-scanner');
const { createConverter } = require('../utils/base-converter');

/**
 * Extract existing gallery (local paths) from markdown file content
 * @param {string} content - Markdown file content
 * @returns {string[]|null} Array of local gallery paths or null if not found
 */
const extractGalleryFromContent = (content) => {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  // Match gallery: (not gallery_cloudinary:) followed by list items
  // Handle both quoted and unquoted values
  const galleryMatch = frontmatter.match(/^gallery:\s*\n((?:\s+-\s+[^\n]+\n?)+)/m);

  if (!galleryMatch) {
    return null;
  }

  const urls = [];
  // Match both quoted ("...") and unquoted values
  const urlMatches = galleryMatch[1].matchAll(/\s+-\s+(?:"([^"]+)"|([^\n]+))/g);
  for (const match of urlMatches) {
    // Use quoted value if present, otherwise use unquoted value (trimmed)
    const url = match[1] || match[2]?.trim();
    if (url && !url.startsWith('gallery_cloudinary')) {
      urls.push(url);
    }
  }

  return urls.length > 0 ? urls : null;
};

/**
 * Parse existing frontmatter from markdown file content
 * @param {string} content - Markdown file content
 * @returns {Object|null} Parsed frontmatter object or null if not found
 */
const parseExistingFrontmatter = (content) => {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const yaml = require('js-yaml');
  try {
    return yaml.load(frontmatterMatch[1]);
  } catch (e) {
    console.error('  Failed to parse existing frontmatter:', e.message);
    return null;
  }
};

/**
 * Extract redirect URLs from markdown content
 * @param {string} content - Markdown file content
 * @returns {string[]} Array of redirect URLs
 */
const extractRedirectsFromContent = (content) => {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return [];
  
  const frontmatter = frontmatterMatch[1];
  const redirectMatch = frontmatter.match(/^redirect_from:\s*\n((?:\s+-\s+"[^"]+"\n?)+)/m);
  if (!redirectMatch) return [];
  
  const urls = [];
  const urlMatches = redirectMatch[1].matchAll(/\s+-\s+"([^"]+)"/g);
  for (const match of urlMatches) {
    urls.push(match[1]);
  }
  return urls;
};

/**
 * Extract all existing data from products directory before it gets deleted
 * Keys by both slug AND redirect URLs to handle filename conflicts (e.g., lights-out-game-2)
 * @param {string} outputDir - Products output directory
 * @returns {{galleries: Map, frontmatters: Map}} Maps of (slug or redirect URL) -> data
 */
const extractAllExistingData = (outputDir) => {
  const galleries = new Map();
  const frontmatters = new Map();

  if (!fs.existsSync(outputDir)) {
    return { galleries, frontmatters };
  }

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const filePath = path.join(outputDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const gallery = extractGalleryFromContent(content);
    const frontmatter = parseExistingFrontmatter(content);

    if (gallery && gallery.length > 0) {
      galleries.set(slug, gallery);
    }

    if (frontmatter) {
      frontmatters.set(slug, frontmatter);
    }

    // Also key by each redirect URL for files with conflicting slugs
    const redirects = extractRedirectsFromContent(content);
    for (const redirect of redirects) {
      if (gallery && gallery.length > 0) {
        galleries.set(redirect, gallery);
      }
      if (frontmatter) {
        frontmatters.set(redirect, frontmatter);
      }
    }
  }

  return { galleries, frontmatters };
};

/**
 * Check if a URL is a Cloudinary URL
 * @param {string} url - URL to check
 * @returns {boolean} True if it's a Cloudinary URL
 */
const isCloudinaryUrl = (url) => {
  return url && url.includes('cloudinary.com');
};

const { convertSingle, convertBatch } = createConverter({
  contentType: 'product',
  extractors: {
    price: (htmlContent) => extractPrice(htmlContent),
    reviews: (htmlContent) => extractReviews(htmlContent),
    productName: (htmlContent) => extractProductName(htmlContent),
    productHeading: (htmlContent) => extractContentHeading(htmlContent),
    images: (htmlContent) => extractProductImages(htmlContent),
    faqs: (htmlContent) => extractFAQs(htmlContent),
    // Check if HTML has FAQ section (for validation)
    hasFAQSection: (htmlContent) => faqPatterns.htmlHasFAQSection.test(htmlContent)
  },
  frontmatterGenerator: (metadata, slug, extracted, context) => {
    const categories = extracted.productCategoriesMap?.get(slug) || [];
    const events = extracted.productEventsMap?.get(slug) || [];
    const images = {
      // Preserve existing gallery (local paths)
      existingGallery: extracted.existingGallery || [],
      // Cloudinary URLs from old site go to gallery_cloudinary
      gallery_cloudinary: extracted.cloudinaryGallery || []
    };
    // Pass the old site relative path for redirect_from generation
    const oldSitePath = context.oldSiteRelativePath || null;
    // Pass FAQs extracted from old site
    const faqs = extracted.faqs || [];
    // Pass body content to be included as a tab
    const bodyContent = extracted.bodyContent || '';
    // Pass existing frontmatter to preserve values
    const existingFrontmatter = extracted.existingFrontmatter || null;
    return generateProductFrontmatter(
      metadata,
      slug,
      extracted.price,
      categories,
      extracted.productName,
      images,
      extracted.productHeading,
      events,
      oldSitePath,
      faqs,
      bodyContent,
      existingFrontmatter
    );
  },
  beforeWrite: async (content, extracted, slug, context) => {
    // Validate FAQ extraction: if HTML has FAQ section, we must have extracted FAQs
    if (extracted.hasFAQSection && (!extracted.faqs || extracted.faqs.length === 0)) {
      throw new Error(`FAQ section found in HTML but no FAQs were extracted. Check FAQ patterns.`);
    }

    // Strip FAQ content from markdown body (FAQs are now in frontmatter)
    // Pass extracted FAQs so we only remove the actual Q&A content, preserving other sections
    if (hasFAQSection(content)) {
      content = stripFAQSection(content, extracted.faqs || []);
    }

    // Get preserved gallery and frontmatter from context (extracted before dir was deleted)
    // First try by slug, then by redirect URL (for files with conflicting slugs like lights-out-game-2)
    let existingGallery = context.existingGalleries?.get(slug);
    let existingFrontmatter = context.existingFrontmatters?.get(slug);

    if ((!existingGallery || !existingFrontmatter) && context.oldSiteRelativePath) {
      // Construct the redirect URL the same way generateProductFrontmatter does
      const redirectUrl = `/category/${context.oldSiteRelativePath.replace(/\.html$/, '').replace(/\\/g, '/')}/`;
      if (!existingGallery) {
        existingGallery = context.existingGalleries?.get(redirectUrl);
      }
      if (!existingFrontmatter) {
        existingFrontmatter = context.existingFrontmatters?.get(redirectUrl);
      }
    }

    extracted.existingGallery = existingGallery || [];
    extracted.existingFrontmatter = existingFrontmatter || null;

    // Extract Cloudinary URLs from old site HTML for gallery_cloudinary
    extracted.cloudinaryGallery = extracted.images?.gallery || [];

    if (extracted.cloudinaryGallery.length > 0) {
      process.stdout.write(` (${extracted.cloudinaryGallery.length} imgs)`);
    }

    // Store the body content for inclusion as a tab in frontmatter
    extracted.bodyContent = content;

    // Return empty string - body content is now in the tabs frontmatter
    return '';
  },
  afterConvert: async (extracted, slug, context) => {
    const { reviewsMap } = context;
    if (extracted.reviews.length > 0) {
      extracted.reviews.forEach((review) => {
        const reviewSlug = review.name.toLowerCase().replace(/\s+/g, '-');
        if (reviewsMap.has(reviewSlug)) {
          const existingReview = reviewsMap.get(reviewSlug);
          if (!existingReview.products.includes(`products/${slug}.md`)) {
            existingReview.products.push(`products/${slug}.md`);
          }
        } else {
          reviewsMap.set(reviewSlug, {
            name: review.name,
            body: review.body,
            products: [`products/${slug}.md`]
          });
        }
      });
    }
  }
});

const convertProduct = (file, inputDir, outputDir, reviewsDir, reviewsMap, productCategoriesMap) => {
  return convertSingle(file, inputDir, outputDir, { reviewsMap, productCategoriesMap });
};

/**
 * Convert all products from old site to markdown
 * @returns {Promise<Object>} Conversion results
 */
const convertProducts = async () => {
  console.log('Converting products...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.products);
  const reviewsDir = path.join(config.OUTPUT_BASE, 'reviews');
  const productsSourcePath = config.paths.productsSource !== undefined ? config.paths.productsSource : config.paths.products;
  const productsDir = path.join(config.OLD_SITE_PATH, productsSourcePath);

  // For Fun Pro UK, products are in category subdirectories, so use recursive search
  // Top-level HTML files in /category/ are category pages, not products
  // Products are in subdirectories like /category/roll-and-bowl/101/product.html
  const categoryDir = path.join(config.OLD_SITE_PATH, 'category');
  const allFileInfos = listHtmlFilesRecursive(categoryDir);
  
  // Filter out top-level category HTML files - only keep files in subdirectories
  let fileInfos = allFileInfos.filter(f => f.relativePath.includes(path.sep));
  
  // Further filter out wget artifacts where canonical URL points to a category page
  // Real products have canonical URLs like /category/arcade-games/106/electronic-dart-board
  // Category duplicates have canonical URLs like /category/arcade-games (no product ID)
  fileInfos = fileInfos.filter(f => {
    const htmlPath = path.join(f.dir, f.file);
    const content = fs.readFileSync(htmlPath, 'utf8');
    // Check og:url which is more reliable than canonical (which is sometimes relative)
    const ogUrlMatch = content.match(/<meta\s+property="og:url"\s+content="([^"]+)"/);
    if (ogUrlMatch) {
      const ogUrl = ogUrlMatch[1];
      // Product URLs have format: /category/{category}/{id}/{slug}
      // Category URLs have format: /category/{category}
      // Check if URL has at least 4 path segments (category/name/id/slug)
      const urlPath = ogUrl.replace(/^https?:\/\/[^/]+/, '');
      const segments = urlPath.split('/').filter(s => s);
      if (segments.length < 4) {
        return false; // This is a category page, not a product
      }
    }
    return true;
  });

  if (fileInfos.length === 0) {
    console.log('  No products found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  console.log(`  Found ${fileInfos.length} product files (excluded ${allFileInfos.length - fileInfos.length} category pages)`);

  // Extract existing data BEFORE deleting the directory
  const { galleries: existingGalleries, frontmatters: existingFrontmatters } = extractAllExistingData(outputDir);
  if (existingGalleries.size > 0) {
    console.log(`  Preserved ${existingGalleries.size} existing product galleries`);
  }
  if (existingFrontmatters.size > 0) {
    console.log(`  Preserved ${existingFrontmatters.size} existing product frontmatters`);
  }

  // Products directory only contains imported products, safe to clean all
  prepDir(outputDir);

  console.log('  Scanning categories for product relationships...');
  const productCategoriesMap = getProductCategoriesMap();
  const productEventsMap = getProductEventsMap();

  const reviewsMap = new Map();

  // Convert each product file
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < fileInfos.length; i++) {
    const fileInfo = fileInfos[i];
    try {
      const fileContext = {
        reviewsMap,
        productCategoriesMap,
        productEventsMap,
        existingGalleries,
        existingFrontmatters,
        categoryIndex: 0,
        progressIndex: i,
        progressTotal: fileInfos.length,
        // Pass the old site relative path for redirect_from generation
        // e.g., "arcade-games/106/electronic-dart-board.html"
        oldSiteRelativePath: fileInfo.relativePath
      };
      // Pass the file name and its directory to convertSingle
      if (await convertSingle(fileInfo.file, fileInfo.dir, outputDir, fileContext)) {
        successful++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`  Error converting ${fileInfo.relativePath}:`, error.message);
      failed++;
    }
  }

  if (reviewsMap.size > 0) {
    const { ensureDir } = require('../utils/filesystem');
    ensureDir(reviewsDir);

    // Only delete reviews that will be regenerated from products
    // (preserve Google reviews which have -google- in their filename)
    const generatedReviewNames = new Set(
      Array.from(reviewsMap.keys()).map(slug => `${slug}.md`)
    );

    const fs = require('fs');
    if (fs.existsSync(reviewsDir)) {
      const existingReviews = fs.readdirSync(reviewsDir);
      existingReviews.forEach(filename => {
        if (generatedReviewNames.has(filename)) {
          fs.unlinkSync(path.join(reviewsDir, filename));
        }
      });
    }

    reviewsMap.forEach((reviewData, slug) => {
      const reviewFilename = `${slug}.md`;
      const productsYaml = reviewData.products.map(p => `"${p}"`).join(', ');
      const frontmatter = `---\nname: "${reviewData.name}"\nproducts: [${productsYaml}]\nrating: 5\n---`;
      const reviewContent = `${frontmatter}\n\n${reviewData.body}`;
      writeMarkdownFile(path.join(reviewsDir, reviewFilename), reviewContent);
    });
    console.log(`  Created ${reviewsMap.size} unique review file(s)`);
  }

  return { successful, failed, total: fileInfos.length };
};

module.exports = {
  convertProduct,
  convertProducts
};
