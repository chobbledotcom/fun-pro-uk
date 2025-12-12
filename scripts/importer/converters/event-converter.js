const path = require('path');
const config = require('../config');
const { listHtmlFiles, prepDir, slugFromFilename } = require('../utils/filesystem');
const { extractCategoryName, extractContentHeading } = require('../utils/metadata-extractor');
const { generateEventFrontmatter } = require('../utils/frontmatter-generator');
const { createConverter } = require('../utils/base-converter');
const { getNavigation, getNavigationForSlug } = require('../utils/navigation-extractor');
const { isEventCategory, isEventPage } = require('../constants');

const { convertSingle, convertBatch } = createConverter({
  contentType: 'event',
  extractors: {
    eventName: (htmlContent) => extractCategoryName(htmlContent),
    eventHeading: (htmlContent) => extractContentHeading(htmlContent)
  },
  frontmatterGenerator: (metadata, slug, extracted, context) => {
    if (extracted.eventName) {
      metadata.title = extracted.eventName;
    }
    // Get navigation info for this event from the extracted navigation structure
    const navInfo = context.navigation ? getNavigationForSlug(context.navigation, slug) : null;
    return generateEventFrontmatter(metadata, slug, extracted.eventHeading, context.eventIndex, navInfo);
  },
  beforeWrite: async (content, extracted, slug) => {
    // Validate that no "More Details" links remain in content
    // This indicates product listings were not properly removed
    if (content.includes('More Details')) {
      throw new Error(`Event "${slug}" still contains "More Details" links - product listings were not properly removed`);
    }
    return content;
  }
});

/**
 * Convert event categories and pages from old site to markdown in events folder
 * Converts both categories listed in EVENT_CATEGORIES and pages listed in EVENT_PAGES
 * @returns {Promise<Object>} Conversion results
 */
const convertEvents = async () => {
  console.log('Converting events...');

  const outputDir = path.join(config.OUTPUT_BASE, 'events');
  
  // Get event categories from category directory
  const categoriesSourceDir = path.join(config.OLD_SITE_PATH, config.paths.categoriesSource);
  const allCategoryFiles = listHtmlFiles(categoriesSourceDir);
  const categoryFiles = allCategoryFiles.filter(file => {
    const slug = path.basename(file, '.html');
    return isEventCategory(slug);
  });

  // Get event pages from pages directory
  const pagesSourceDir = path.join(config.OLD_SITE_PATH, 'pages');
  const allPageFiles = listHtmlFiles(pagesSourceDir);
  const pageFiles = allPageFiles.filter(file => {
    const slug = slugFromFilename(file);
    return isEventPage(slug);
  });

  // Events directory only contains imported events, safe to clean all
  prepDir(outputDir);

  const totalFiles = categoryFiles.length + pageFiles.length;
  if (totalFiles === 0) {
    console.log('  No events found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  console.log(`  Found ${categoryFiles.length} event categories: ${categoryFiles.map(f => path.basename(f, '.html')).join(', ')}`);
  console.log(`  Found ${pageFiles.length} event pages: ${pageFiles.map(f => slugFromFilename(f)).join(', ')}`);

  // Extract navigation structure from old site
  const navigation = getNavigation(config.OLD_SITE_PATH);

  // Pass navigation context to converters
  const context = { navigation };
  
  // Convert both categories and pages as events
  const categoryResult = await convertBatch(categoryFiles, categoriesSourceDir, outputDir, context);
  const pageResult = await convertBatch(pageFiles, pagesSourceDir, outputDir, context);

  return {
    successful: categoryResult.successful + pageResult.successful,
    failed: categoryResult.failed + pageResult.failed,
    total: categoryResult.total + pageResult.total
  };
};

const convertEvent = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertEvent,
  convertEvents
};
