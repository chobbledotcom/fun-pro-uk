const path = require('path');
const config = require('../config');
const { listHtmlFiles, prepDir } = require('../utils/filesystem');
const { extractCategoryName, extractContentHeading } = require('../utils/metadata-extractor');
const { generateCategoryFrontmatter } = require('../utils/frontmatter-generator');
const { downloadEmbeddedImages } = require('../utils/image-downloader');
const { createConverter } = require('../utils/base-converter');
const { getNavigation, getNavigationForSlug } = require('../utils/navigation-extractor');

const { convertSingle, convertBatch } = createConverter({
  contentType: 'category',
  extractors: {
    categoryName: (htmlContent) => extractCategoryName(htmlContent),
    categoryHeading: (htmlContent) => extractContentHeading(htmlContent)
  },
  frontmatterGenerator: (metadata, slug, extracted, context) => {
    if (extracted.categoryName) {
      metadata.title = extracted.categoryName;
    }
    // Get navigation info for this category from the extracted navigation structure
    const navInfo = context.navigation ? getNavigationForSlug(context.navigation, slug) : null;
    return generateCategoryFrontmatter(metadata, slug, extracted.categoryHeading, context.categoryIndex, navInfo);
  },
  beforeWrite: async (content, extracted, slug) => content // Skip image downloads for now
});

/**
 * Convert all categories from old site to markdown
 * @returns {Promise<Object>} Conversion results
 */
const convertCategories = async () => {
  console.log('Converting categories...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.categories);
  const categoriesDir = path.join(config.OLD_SITE_PATH, config.paths.categories);
  const files = listHtmlFiles(categoriesDir);

  // Categories directory only contains imported categories, safe to clean all
  prepDir(outputDir);

  if (files.length === 0) {
    console.log('  No categories directory found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  // Extract navigation structure from old site
  const navigation = getNavigation(config.OLD_SITE_PATH);

  // Pass navigation context to converters
  const context = { navigation };
  return await convertBatch(files, categoriesDir, outputDir, context);
};

const convertCategory = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertCategory,
  convertCategories
};
