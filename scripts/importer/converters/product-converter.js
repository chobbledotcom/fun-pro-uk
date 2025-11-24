const path = require('path');
const config = require('../config');
const { listHtmlFiles, prepDir, writeMarkdownFile } = require('../utils/filesystem');
const { extractPrice, extractReviews, extractProductName, extractProductImages, extractContentHeading } = require('../utils/metadata-extractor');
const { generateProductFrontmatter, generateReviewFrontmatter } = require('../utils/frontmatter-generator');
const { downloadProductImage, downloadEmbeddedImages } = require('../utils/image-downloader');
const { scanProductCategories } = require('../utils/category-scanner');
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
  frontmatterGenerator: (metadata, slug, extracted) => {
    const categories = extracted.productCategoriesMap?.get(slug) || [];
    const localImages = { header_image: extracted.localImagePath };
    return generateProductFrontmatter(
      metadata,
      slug,
      extracted.price,
      categories,
      extracted.productName,
      localImages,
      extracted.productHeading
    );
  },
  beforeWrite: async (content, extracted, slug) => {
    extracted.localImagePath = await downloadProductImage(extracted.images.header_image, slug);
    return await downloadEmbeddedImages(content, 'products', slug);
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
  const productsDir = path.join(config.OLD_SITE_PATH, config.paths.products);
  const files = listHtmlFiles(productsDir);

  if (files.length === 0) {
    console.log('  No products directory found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  // Products directory only contains imported products, safe to clean all
  prepDir(outputDir);

  console.log('  Scanning categories for product relationships...');
  const productCategoriesMap = scanProductCategories();

  const reviewsMap = new Map();
  const result = await convertBatch(files, productsDir, outputDir, { reviewsMap, productCategoriesMap });

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

  return result;
};

module.exports = {
  convertProduct,
  convertProducts
};
