const path = require('path');
const config = require('../config');
const { listHtmlFiles, prepDir, slugFromFilename, writeMarkdownFile } = require('../utils/filesystem');
const { extractContentHeading } = require('../utils/metadata-extractor');
const { generatePageFrontmatter } = require('../utils/frontmatter-generator');
const { downloadEmbeddedImages } = require('../utils/image-downloader');
const { createConverter } = require('../utils/base-converter');
const { getNavigation, getNavigationForSlug } = require('../utils/navigation-extractor');
const { isLocationPage, isEventPage } = require('../constants');
const { STATIC_PAGES } = require('./static-page-converter');
const fs = require('fs');

// Pages that are handled by other converters and should be skipped
const EXCLUDED_PAGES = [
  'testimonials', // handled by reviews-index-converter
  'meet-the-team', // handled by team-converter
  'a-z-of-all-games', // redirects to /products/ via static-page-converter
];

const { convertSingle, convertBatch } = createConverter({
  contentType: 'page',
  extractors: {
    pageHeading: (htmlContent) => extractContentHeading(htmlContent)
  },
  frontmatterGenerator: (metadata, slug, extracted, context) => {
    const { OLD_SLUG_TO_NEW } = require('../constants');
    // Get navigation info using the new slug (after any renaming)
    const lookupSlug = OLD_SLUG_TO_NEW[slug] || slug;
    const navInfo = context.navigation ? getNavigationForSlug(context.navigation, lookupSlug) : null;
    return generatePageFrontmatter(metadata, slug, extracted.pageHeading, navInfo);
  },
  beforeWrite: async (content, extracted, slug) => content // Skip image downloads for now
});

/**
 * Convert all pages from old site to markdown
 * @returns {Promise<Object>} Conversion results
 */
const convertPages = async () => {
  console.log('Converting pages...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.pages);
  const pagesDir = path.join(config.OLD_SITE_PATH, 'pages');
  const allPageFiles = listHtmlFiles(pagesDir);

  // Filter out location pages, event pages, and excluded pages - they are handled by their own converters
  const pageFiles = allPageFiles.filter(file => {
    const slug = slugFromFilename(file);
    return !isLocationPage(slug) && !isEventPage(slug) && !EXCLUDED_PAGES.includes(slug);
  });

  const excludedCount = allPageFiles.length - pageFiles.length;
  console.log(`  Found ${pageFiles.length} regular pages (${excludedCount} location/event pages excluded)`);

  // Convert root-level pages (contact only - reviews handled by reviews-index-converter)
  const rootPages = ['contact.php.html'].filter(file =>
    fs.existsSync(path.join(config.OLD_SITE_PATH, file))
  );

  // Clean all pages - they will be regenerated
  prepDir(outputDir);

  // Generate static pages (home.md, products.md, etc.)
  for (const page of STATIC_PAGES) {
    const outputPath = path.join(outputDir, `${page.slug}.md`);
    writeMarkdownFile(outputPath, page.content);
  }
  console.log(`  Generated ${STATIC_PAGES.length} static pages`);

  // Extract navigation structure from old site
  const navigation = getNavigation(config.OLD_SITE_PATH);

  // Pass navigation context to converters
  const context = { navigation };
  const pagesResult = await convertBatch(pageFiles, pagesDir, outputDir, context);
  const rootResult = await convertBatch(rootPages, config.OLD_SITE_PATH, outputDir, context);

  return {
    successful: pagesResult.successful + rootResult.successful,
    failed: pagesResult.failed + rootResult.failed,
    total: pagesResult.total + rootResult.total
  };
};

const convertPage = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertPage,
  convertPages
};
