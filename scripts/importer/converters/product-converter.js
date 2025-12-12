const path = require('path');
const config = require('../config');
const { listHtmlFiles, listHtmlFilesRecursive, prepDir, writeMarkdownFile } = require('../utils/filesystem');
const { extractPrice, extractReviews, extractProductName, extractProductImages, extractContentHeading } = require('../utils/metadata-extractor');
const { generateProductFrontmatter, generateReviewFrontmatter } = require('../utils/frontmatter-generator');
const { downloadProductImage, downloadProductGallery, downloadEmbeddedImages } = require('../utils/image-downloader');
const { getProductCategoriesMap, getProductEventsMap } = require('../utils/category-scanner');
const { createConverter } = require('../utils/base-converter');

const { convertSingle, convertBatch } = createConverter({
  contentType: 'product',
  extractors: {
    price: (htmlContent) => extractPrice(htmlContent),
    reviews: (htmlContent) => extractReviews(htmlContent),
    productName: (htmlContent) => extractProductName(htmlContent),
    productHeading: (htmlContent) => extractContentHeading(htmlContent),
    images: (htmlContent) => extractProductImages(htmlContent)
  },
  frontmatterGenerator: (metadata, slug, extracted, context) => {
    const categories = extracted.productCategoriesMap?.get(slug) || [];
    const events = extracted.productEventsMap?.get(slug) || [];
    const localImages = {
      header_image: extracted.localGalleryPaths?.[0] || extracted.localImagePath || '',
      gallery: extracted.localGalleryPaths || []
    };
    // Pass the old site relative path for redirect_from generation
    const oldSitePath = context.oldSiteRelativePath || null;
    return generateProductFrontmatter(
      metadata,
      slug,
      extracted.price,
      categories,
      extracted.productName,
      localImages,
      extracted.productHeading,
      events,
      oldSitePath
    );
  },
  beforeWrite: async (content, extracted, slug) => {
    // Use original URLs directly (skip downloading for now)
    const galleryUrls = extracted.images?.gallery || [];
    extracted.localGalleryPaths = galleryUrls;
    extracted.localImagePath = galleryUrls[0] || '';
    
    if (galleryUrls.length > 0) {
      process.stdout.write(` (${galleryUrls.length} imgs)`);
    }
    
    // Skip embedded image downloads too for now
    return content;
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
  const fileInfos = allFileInfos.filter(f => f.relativePath.includes(path.sep));

  if (fileInfos.length === 0) {
    console.log('  No products found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  console.log(`  Found ${fileInfos.length} product files (excluded ${allFileInfos.length - fileInfos.length} category pages)`);

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
