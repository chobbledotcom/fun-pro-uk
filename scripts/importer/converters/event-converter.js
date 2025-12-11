const path = require('path');
const config = require('../config');
const { listHtmlFiles, prepDir } = require('../utils/filesystem');
const { extractCategoryName, extractContentHeading } = require('../utils/metadata-extractor');
const { generateEventFrontmatter } = require('../utils/frontmatter-generator');
const { createConverter } = require('../utils/base-converter');
const { getNavigation, getNavigationForSlug } = require('../utils/navigation-extractor');
const { EVENT_CATEGORIES, isEventCategory } = require('../constants');

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
  beforeWrite: async (content, extracted, slug) => content // Skip image downloads for now
});

/**
 * Convert event categories from old site to markdown in events folder
 * Only converts categories listed in EVENT_CATEGORIES constant
 * @returns {Promise<Object>} Conversion results
 */
const convertEvents = async () => {
  console.log('Converting events...');

  const outputDir = path.join(config.OUTPUT_BASE, 'events');
  const categoriesSourceDir = path.join(config.OLD_SITE_PATH, config.paths.categoriesSource);
  const allFiles = listHtmlFiles(categoriesSourceDir);

  // Filter to only include files that match EVENT_CATEGORIES
  const files = allFiles.filter(file => {
    const slug = path.basename(file, '.html');
    return isEventCategory(slug);
  });

  // Events directory only contains imported events, safe to clean all
  prepDir(outputDir);

  if (files.length === 0) {
    console.log('  No event categories found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  console.log(`  Found ${files.length} event categories: ${files.map(f => path.basename(f, '.html')).join(', ')}`);

  // Extract navigation structure from old site
  const navigation = getNavigation(config.OLD_SITE_PATH);

  // Pass navigation context to converters
  const context = { navigation };
  return await convertBatch(files, categoriesSourceDir, outputDir, context);
};

const convertEvent = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertEvent,
  convertEvents
};
