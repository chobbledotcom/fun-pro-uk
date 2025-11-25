#!/usr/bin/env node

/**
 * Main orchestrator for the site conversion process
 * This coordinates all the individual converters
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { convertPages, convertBlogPosts, convertProducts, convertCategories, convertHomeContent, convertBlogIndex, convertReviewsIndex, convertSpecialPages, convertSiteConfig } = require('./converters');
const { extractFavicons } = require('./utils/favicon-extractor');
const { applyFindReplacesRecursive } = require('./utils/find-replace');
const ResultsTracker = require('./utils/results-tracker');
const config = require('./config');

/**
 * Check if pandoc is installed
 * Note: Now using turndown instead of pandoc, so this check is no longer needed
 * @throws {Error} If pandoc is not found
 */
const checkPandoc = () => {
  // No longer required - using turndown for HTML to markdown conversion
  return;
};

/**
 * Ensure the images directory exists (preserves existing images for caching)
 */
const ensureImagesDirectory = () => {
  const imagesDir = path.join(__dirname, '..', '..', 'images');

  if (!fs.existsSync(imagesDir)) {
    console.log('Creating images directory...');
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log('✓ Images directory created\n');
  } else {
    console.log('✓ Images directory exists (using cached images)\n');
  }
};

/**
 * Main execution function
 */
const main = async () => {
  console.log('Starting conversion of old Fun Pro UK site...\n');

  // Check for required dependencies
  checkPandoc();

  const startTime = Date.now();
  const tracker = new ResultsTracker();

  try {
    ensureImagesDirectory();

    const oldSitePath = config.OLD_SITE_PATH;
    const faviconOutputPath = path.join(config.OUTPUT_BASE, config.paths.favicon);
    tracker.add('Favicons', extractFavicons(oldSitePath, faviconOutputPath));
    console.log('');

    tracker.add('Site Config', await convertSiteConfig());
    console.log('');

    tracker.add('Homepage Content', await convertHomeContent());
    console.log('');

    tracker.add('Pages', await convertPages());
    console.log('');

    tracker.add('Special Pages', await convertSpecialPages());
    console.log('');

    tracker.add('Blog Posts', await convertBlogPosts());
    console.log('');

    tracker.add('Products', await convertProducts());
    console.log('');

    tracker.add('Categories', await convertCategories());
    console.log('');

    tracker.add('Blog Index', convertBlogIndex());
    console.log('');

    tracker.add('Reviews Index', await convertReviewsIndex());
    console.log('');

    console.log('Applying find/replace patterns to markdown files...');
    const targetDirs = ['pages', 'products', 'categories', 'news'];
    targetDirs.forEach(dir => {
      const dirPath = path.join(config.OUTPUT_BASE, dir);
      applyFindReplacesRecursive(dirPath);
    });
    console.log('✓ Find/replace patterns applied\n');

    tracker.displaySummary();

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Time elapsed: ${elapsedTime} seconds`);
    console.log('\n✨ Conversion completed successfully!');

    process.exit(tracker.totalFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Error during conversion:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
