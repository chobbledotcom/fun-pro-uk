const path = require('path');
const fs = require('fs');
const config = require('../config');
const { listHtmlFiles, prepDir, slugFromFilename, writeMarkdownFile } = require('../utils/filesystem');
const { extractCategoryName, extractContentHeading, extractMetadata } = require('../utils/metadata-extractor');
const { generateEventFrontmatter } = require('../utils/frontmatter-generator');
const { createConverter } = require('../utils/base-converter');
const { getNavigation, getNavigationForSlug } = require('../utils/navigation-extractor');
const { EVENT_HIERARCHY, findEventInHierarchy } = require('../constants');
const { convertToMarkdown } = require('../utils/pandoc-converter');
const { processContent } = require('../utils/content-processor');
const { readHtmlFile } = require('../utils/filesystem');

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
    // Use hierarchy info from context if available
    const hierarchyInfo = context.hierarchyInfo || null;
    const sourceType = context.sourceType || 'category';
    return generateEventFrontmatter(metadata, slug, extracted.eventHeading, context.eventIndex, hierarchyInfo, sourceType);
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
 * Create a placeholder event page when no old site source exists
 * @param {Object} eventInfo - Event info from hierarchy
 * @param {string} outputDir - Output directory
 */
const createPlaceholderEvent = (eventInfo, outputDir) => {
  const slug = eventInfo.slug;
  const title = eventInfo.title;

  // Build hierarchy info for frontmatter generation
  const hierarchyInfo = {
    title: title,
    isParent: eventInfo.isParent,
    parentTitle: eventInfo.parentTitle,
    order: eventInfo.order,
    additionalRedirects: eventInfo.additionalRedirects || []
  };

  const metadata = {
    title: title,
    meta_description: `${title} entertainment and event hire services from Fun Pro UK.`
  };

  const frontmatter = generateEventFrontmatter(
    metadata,
    slug,
    title,
    eventInfo.order,
    hierarchyInfo,
    null // no source type for placeholders
  );

  const content = `# ${title}

Content coming soon.
`;

  const fullContent = `${frontmatter}\n\n${content}`;
  const outputPath = path.join(outputDir, `${slug}.md`);

  writeMarkdownFile(outputPath, fullContent);
  console.log(`  Created placeholder: ${slug}.md`);
};

/**
 * Convert a single event from the old site
 * @param {Object} eventInfo - Event info from hierarchy
 * @param {string} outputDir - Output directory
 * @returns {Promise<boolean>} Success status
 */
const convertEventFromOldSite = async (eventInfo, outputDir) => {
  const oldSiteSlug = eventInfo.oldSiteSlug;
  const sourceType = eventInfo.sourceType;
  const newSlug = eventInfo.slug;

  // Determine source directory based on source type
  let sourceDir, filename;
  if (sourceType === 'category') {
    sourceDir = path.join(config.OLD_SITE_PATH, config.paths.categoriesSource);
    filename = `${oldSiteSlug}.html`;
  } else {
    sourceDir = path.join(config.OLD_SITE_PATH, 'pages');
    filename = `${oldSiteSlug}.html`;
  }

  const htmlPath = path.join(sourceDir, filename);

  if (!fs.existsSync(htmlPath)) {
    console.log(`  Warning: Source file not found: ${htmlPath}`);
    console.log(`  Creating placeholder for: ${newSlug}`);
    createPlaceholderEvent(eventInfo, outputDir);
    return true;
  }

  try {
    process.stdout.write(`  Converting: ${oldSiteSlug} -> ${newSlug}...`);

    const htmlContent = readHtmlFile(htmlPath);
    const metadata = extractMetadata(htmlContent);
    const markdown = convertToMarkdown(htmlPath);
    let content = processContent(markdown, 'event', htmlContent);

    // Extract additional info
    const eventName = extractCategoryName(htmlContent);
    const eventHeading = extractContentHeading(htmlContent);

    if (eventName) {
      metadata.title = eventName;
    }

    // Use the title from hierarchy as the authoritative title
    metadata.title = eventInfo.title;

    // Validate no "More Details" links
    if (content.includes('More Details')) {
      throw new Error(`Event "${newSlug}" still contains "More Details" links`);
    }

    // Build hierarchy info for frontmatter generation
    const hierarchyInfo = {
      title: eventInfo.title,
      isParent: eventInfo.isParent,
      parentTitle: eventInfo.parentTitle,
      order: eventInfo.order,
      oldSiteSlug: oldSiteSlug,
      additionalRedirects: eventInfo.additionalRedirects || []
    };

    const frontmatter = generateEventFrontmatter(
      metadata,
      newSlug,
      eventHeading,
      eventInfo.order,
      hierarchyInfo,
      sourceType
    );

    const fullContent = `${frontmatter}\n\n${content}`;
    const outputPath = path.join(outputDir, `${newSlug}.md`);

    writeMarkdownFile(outputPath, fullContent);
    console.log(' ✓');

    return true;
  } catch (error) {
    console.log(' ✗ FAILED');
    console.error(`    Error: ${error.message}`);
    return false;
  }
};

/**
 * Convert event categories and pages from old site to markdown in events folder
 * Uses EVENT_HIERARCHY to determine structure and parent-child relationships
 * @returns {Promise<Object>} Conversion results
 */
const convertEvents = async () => {
  console.log('Converting events using hierarchy structure...');

  const outputDir = path.join(config.OUTPUT_BASE, 'events');

  // Events directory only contains imported events, safe to clean all
  prepDir(outputDir);

  let successful = 0;
  let failed = 0;
  let total = 0;

  // Process each parent category and its children
  for (const parent of EVENT_HIERARCHY) {
    console.log(`\n  Processing parent category: ${parent.title}`);

    // Find parent info
    const parentInfo = findEventInHierarchy(parent.slug);
    total++;

    // Convert or create parent category page
    if (parent.oldSiteSlug) {
      if (await convertEventFromOldSite(parentInfo, outputDir)) {
        successful++;
      } else {
        failed++;
      }
    } else {
      createPlaceholderEvent(parentInfo, outputDir);
      successful++;
    }

    // Process child events
    for (const child of parent.children) {
      const childInfo = findEventInHierarchy(child.slug);
      total++;

      if (child.oldSiteSlug) {
        if (await convertEventFromOldSite(childInfo, outputDir)) {
          successful++;
        } else {
          failed++;
        }
      } else {
        createPlaceholderEvent(childInfo, outputDir);
        successful++;
      }
    }
  }

  console.log(`\n  Events conversion complete: ${successful} successful, ${failed} failed, ${total} total`);

  return { successful, failed, total };
};

const convertEvent = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertEvent,
  convertEvents
};
