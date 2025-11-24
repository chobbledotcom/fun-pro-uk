const path = require('path');
const config = require('../config');
const { ensureDir, writeMarkdownFile } = require('../utils/filesystem');

/**
 * Generate blog index page with navigation
 * Blog posts are automatically rendered by the news layout
 * @returns {Object} Conversion results
 */
const convertBlogIndex = () => {
  console.log('Creating blog index page...');

  const outputDir = path.join(config.OUTPUT_BASE, 'pages');
  ensureDir(outputDir);

  const frontmatter = `---
meta_title: "News & Updates | Fun Pro UK"
meta_description: "All of the latest news from Fun Pro UK about interactive game hire, corporate events, exhibitions, and parties."
permalink: "/blog/"
layout: news-archive.html
eleventyNavigation:
  key: News
  order: 5
---`;

  const content = `# News & Updates

All of the latest news from Fun Pro UK - you can also find more updates on our [Facebook Page](https://www.facebook.com/funprouk/)!`;

  const fullContent = `${frontmatter}\n\n${content}`;
  const outputPath = path.join(outputDir, 'blog.md');

  try {
    writeMarkdownFile(outputPath, fullContent);
    console.log('  Created: blog.md');
    return { successful: 1, failed: 0, total: 1 };
  } catch (error) {
    console.error('  Error creating blog.md:', error.message);
    return { successful: 0, failed: 1, total: 1 };
  }
};

module.exports = {
  convertBlogIndex
};
