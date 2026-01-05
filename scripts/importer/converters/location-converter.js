const path = require('path');
const fs = require('fs');
const config = require('../config');
const { listHtmlFiles, ensureDir, slugFromFilename } = require('../utils/filesystem');
const { extractContentHeading } = require('../utils/metadata-extractor');
const { generateLocationFrontmatter, generateLocationRootFrontmatter } = require('../utils/frontmatter-generator');
const { createConverter } = require('../utils/base-converter');
const { isLocationPage, extractTownFromSlug, stripTownFromSlug, LOCATION_TOWNS } = require('../constants');
const { copyLocalEmbeddedImages } = require('../utils/image-downloader');

const { convertSingle, convertBatch } = createConverter({
  contentType: 'location',
  extractors: {
    locationHeading: (htmlContent) => extractContentHeading(htmlContent)
  },
  frontmatterGenerator: (metadata, slug, extracted, context) => {
    // Get town and stripped slug from context
    const { town, strippedSlug } = context;
    // Get thumbnail from extracted data (set by beforeWrite)
    const thumbnail = extracted.thumbnail || null;
    return generateLocationFrontmatter(metadata, slug, extracted.locationHeading, town, strippedSlug, thumbnail);
  },
  beforeWrite: async (content, extracted, slug) => {
    // Copy /userfiles/ images from old_site and update paths in content
    const result = copyLocalEmbeddedImages(content, 'locations');
    // Store the first image as thumbnail for frontmatter
    extracted.thumbnail = result.firstImage;
    return result.content;
  }
});

/**
 * Recursively remove a directory and all its contents
 * @param {string} dir - Directory to remove
 */
const removeDir = (dir) => {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        removeDir(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
    fs.rmdirSync(dir);
  }
};

/**
 * Convert all location pages from old site to markdown
 * @returns {Promise<Object>} Conversion results
 */
const convertLocations = async () => {
  console.log('Converting locations...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.locations);
  const pagesDir = path.join(config.OLD_SITE_PATH, 'pages');
  const allPageFiles = listHtmlFiles(pagesDir);

  // Filter to only location pages and extract town info
  const locationFiles = allPageFiles.filter(file => {
    const slug = slugFromFilename(file);
    return isLocationPage(slug);
  });

  console.log(`  Found ${locationFiles.length} location pages`);

  // Clean and recreate entire locations directory
  removeDir(outputDir);
  ensureDir(outputDir);

  // Create town subdirectories and root location pages
  LOCATION_TOWNS.forEach(town => {
    ensureDir(path.join(outputDir, town));
    
    // Create root location page (e.g., locations/birmingham.md)
    const rootPageContent = generateLocationRootFrontmatter(town);
    const rootPagePath = path.join(outputDir, `${town}.md`);
    fs.writeFileSync(rootPagePath, rootPageContent);
    console.log(`  Created root page: ${town}.md`);
  });

  // Convert each file with town context
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < locationFiles.length; i++) {
    const file = locationFiles[i];
    const slug = slugFromFilename(file);
    const town = extractTownFromSlug(slug);
    const strippedSlug = stripTownFromSlug(slug, town);

    // Pass town info in context
    const context = {
      town,
      strippedSlug,
      progressIndex: i,
      progressTotal: locationFiles.length
    };

    if (await convertSingle(file, pagesDir, outputDir, context)) {
      successful++;
    } else {
      failed++;
    }
  }

  return { successful, failed, total: locationFiles.length };
};

module.exports = {
  convertLocations
};
