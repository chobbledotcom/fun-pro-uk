const path = require('path');
const config = require('../config');
const { listHtmlFiles, prepDir } = require('../utils/filesystem');
const { extractCategoryName, extractContentHeading, extractFAQs } = require('../utils/metadata-extractor');
const { faqPatterns } = require('../utils/html-patterns');
const { stripFAQSection, hasFAQSection } = require('../utils/content-processor');
const { generateCategoryFrontmatter } = require('../utils/frontmatter-generator');
const { downloadEmbeddedImages } = require('../utils/image-downloader');
const { createConverter } = require('../utils/base-converter');
const { getNavigation, getNavigationForSlug } = require('../utils/navigation-extractor');
const { isEventCategory } = require('../constants');

const { convertSingle, convertBatch } = createConverter({
  contentType: 'category',
  extractors: {
    categoryName: (htmlContent) => extractCategoryName(htmlContent),
    categoryHeading: (htmlContent) => extractContentHeading(htmlContent),
    faqs: (htmlContent) => extractFAQs(htmlContent),
    // Check if HTML has FAQ section (for validation)
    hasFAQSection: (htmlContent) => faqPatterns.htmlHasFAQSection.test(htmlContent)
  },
  frontmatterGenerator: (metadata, slug, extracted, context) => {
    if (extracted.categoryName) {
      metadata.title = extracted.categoryName;
    }
    // Get navigation info for this category from the extracted navigation structure
    const navInfo = context.navigation ? getNavigationForSlug(context.navigation, slug) : null;
    // Pass FAQs extracted from old site
    const faqs = extracted.faqs || [];
    return generateCategoryFrontmatter(metadata, slug, extracted.categoryHeading, context.categoryIndex, navInfo, faqs);
  },
  beforeWrite: async (content, extracted, slug) => {
    // Validate FAQ extraction: if HTML has FAQ section, we must have extracted FAQs
    if (extracted.hasFAQSection && (!extracted.faqs || extracted.faqs.length === 0)) {
      throw new Error(`FAQ section found in HTML but no FAQs were extracted. Check FAQ patterns.`);
    }
    
    // Strip FAQ content from markdown body (FAQs are now in frontmatter)
    // Pass extracted FAQs so we only remove the actual Q&A content, preserving other sections
    if (hasFAQSection(content)) {
      content = stripFAQSection(content, extracted.faqs || []);
    }
    
    return content;
  }
});

/**
 * Convert all categories from old site to markdown
 * @returns {Promise<Object>} Conversion results
 */
const convertCategories = async () => {
  console.log('Converting categories...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.categories);
  const categoriesSourceDir = path.join(config.OLD_SITE_PATH, config.paths.categoriesSource);
  const allFiles = listHtmlFiles(categoriesSourceDir);

  // Filter out files that should be imported as events instead
  const files = allFiles.filter(file => {
    const slug = path.basename(file, '.html');
    return !isEventCategory(slug);
  });

  const skippedCount = allFiles.length - files.length;
  if (skippedCount > 0) {
    console.log(`  Skipping ${skippedCount} categories that will be imported as events`);
  }

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
  return await convertBatch(files, categoriesSourceDir, outputDir, context);
};

const convertCategory = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertCategory,
  convertCategories
};
