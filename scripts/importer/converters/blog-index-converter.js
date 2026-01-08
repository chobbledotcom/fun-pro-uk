const path = require('path');
const config = require('../config');
const { ensureDir, writeMarkdownFile } = require('../utils/filesystem');
const { getSiteName, getSocialUrl } = require('../utils/source-extractor');

/**
 * Generate blog index page with navigation
 * Blog posts are automatically rendered by the news layout
 * Uses source-extractor to get site name and Facebook URL
 * @returns {Object} Conversion results
 */
const convertBlogIndex = () => {
  console.log('Creating blog index page...');

  const outputDir = path.join(config.OUTPUT_BASE, 'pages');
  ensureDir(outputDir);

  // Extract data from source - no fallbacks, data must exist
  const siteName = getSiteName();
  const facebookUrl = getSocialUrl('facebook');
  
  if (!siteName) {
    throw new Error('Could not extract site name from source');
  }
  if (!facebookUrl) {
    throw new Error('Could not extract Facebook URL from source');
  }

  const frontmatter = `---
meta_title: "News & Updates | ${siteName}"
meta_description: "All of the latest news from ${siteName} about interactive game hire, corporate events, exhibitions, and parties."
permalink: "/news/"
layout: news-archive.html
eleventyNavigation:
  key: News
  order: 5
---`;

  const content = `# News & Updates

All of the latest news from ${siteName} - you can also find more updates on our [Facebook Page](${facebookUrl})!`;

  const fullContent = `${frontmatter}\n\n${content}`;
  const outputPath = path.join(outputDir, 'news.md');

  try {
    writeMarkdownFile(outputPath, fullContent);
    console.log('  Created: news.md');
    return { successful: 1, failed: 0, total: 1 };
  } catch (error) {
    console.error('  Error creating news.md:', error.message);
    return { successful: 0, failed: 1, total: 1 };
  }
};

module.exports = {
  convertBlogIndex
};
