#!/usr/bin/env node

/**
 * Main orchestrator for the site conversion process
 * This coordinates all the individual converters
 *
 * Usage:
 *   node scripts/importer              # Run all converters
 *   node scripts/importer --only pages # Run only pages converter
 *   node scripts/importer --only products,categories # Run multiple
 *   node scripts/importer --list       # List available converters
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { convertPages, convertLocations, convertBlogPosts, convertProducts, convertCategories, convertHomeContent, convertBlogIndex, convertReviewsIndex, convertReviews, convertSpecialPages, convertSiteConfig } = require('./converters');
const { extractFavicons } = require('./utils/favicon-extractor');
const { applyFindReplacesRecursive } = require('./utils/find-replace');
const ResultsTracker = require('./utils/results-tracker');
const config = require('./config');

// Available converters
const CONVERTERS = {
  favicons: { name: 'Favicons', run: () => extractFavicons(config.OLD_SITE_PATH, path.join(config.OUTPUT_BASE, config.paths.favicon)) },
  config: { name: 'Site Config', run: () => convertSiteConfig() },
  home: { name: 'Homepage Content', run: () => convertHomeContent() },
  pages: { name: 'Pages', run: () => convertPages() },
  locations: { name: 'Locations', run: () => convertLocations() },
  special: { name: 'Special Pages', run: () => convertSpecialPages() },
  blog: { name: 'Blog Posts', run: () => convertBlogPosts() },
  products: { name: 'Products', run: () => convertProducts() },
  categories: { name: 'Categories', run: () => convertCategories() },
  blogindex: { name: 'Blog Index', run: () => convertBlogIndex() },
  reviewsindex: { name: 'Reviews Index', run: () => convertReviewsIndex() },
  reviews: { name: 'Reviews', run: () => convertReviews() },
};

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { only: null, list: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only' && args[i + 1]) {
      result.only = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--list') {
      result.list = true;
    }
  }

  return result;
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
  const args = parseArgs();

  // List available converters
  if (args.list) {
    console.log('Available converters:');
    Object.entries(CONVERTERS).forEach(([key, val]) => {
      console.log(`  ${key.padEnd(12)} - ${val.name}`);
    });
    console.log('\nUsage: node scripts/importer --only pages,products');
    process.exit(0);
  }

  // Validate --only arguments
  if (args.only) {
    const invalid = args.only.filter(k => !CONVERTERS[k]);
    if (invalid.length > 0) {
      console.error(`Unknown converter(s): ${invalid.join(', ')}`);
      console.error('Use --list to see available converters');
      process.exit(1);
    }
  }

  console.log('Starting conversion of old Fun Pro UK site...\n');

  const startTime = Date.now();
  const tracker = new ResultsTracker();

  // Determine which converters to run
  const convertersToRun = args.only || Object.keys(CONVERTERS);

  ensureImagesDirectory();

  for (const key of convertersToRun) {
    const converter = CONVERTERS[key];
    if (converter) {
      tracker.add(converter.name, await converter.run());
      console.log('');
    }
  }

  // Only apply find/replace if running all or specific content converters
  const contentConverters = ['pages', 'locations', 'products', 'categories', 'blog'];
  const shouldApplyReplacements = !args.only || args.only.some(k => contentConverters.includes(k));

  if (shouldApplyReplacements) {
    console.log('Applying find/replace patterns to markdown files...');
    const targetDirs = ['pages', 'locations', 'products', 'categories', 'news'];
    targetDirs.forEach(dir => {
      const dirPath = path.join(config.OUTPUT_BASE, dir);
      applyFindReplacesRecursive(dirPath);
    });
    console.log('✓ Find/replace patterns applied\n');
  }

  tracker.displaySummary();

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Time elapsed: ${elapsedTime} seconds`);
  console.log('\n✨ Conversion completed successfully!');

  process.exit(tracker.totalFailed > 0 ? 1 : 0);
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
