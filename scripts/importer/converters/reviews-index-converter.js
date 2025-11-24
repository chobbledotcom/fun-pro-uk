const path = require('path');
const config = require('../config');
const { ensureDir } = require('../utils/filesystem');
const { generatePageFrontmatter } = require('../utils/frontmatter-generator');
const { createConverter } = require('../utils/base-converter');

const { convertSingle } = createConverter({
  contentType: 'page',
  extractors: {},
  frontmatterGenerator: (metadata, slug) => generatePageFrontmatter(metadata, slug),
  beforeWrite: async (content) => {
    // Remove "Click Here" link and everything after (duplicate reviews and form)
    const linkIndex = content.indexOf('[Click Here To Leave A Review!]');
    if (linkIndex !== -1) {
      return content.substring(0, linkIndex).trim();
    }
    return content;
  }
});

/**
 * Convert reviews page from old site
 * @returns {Promise<Object>} Conversion results
 */
const convertReviewsIndex = async () => {
  console.log('Converting reviews page...');

  const outputDir = path.join(config.OUTPUT_BASE, 'pages');
  ensureDir(outputDir);

  try {
    const success = await convertSingle(
      'reviews.php.html',
      config.OLD_SITE_PATH,
      outputDir
    );
    return { successful: success ? 1 : 0, failed: success ? 0 : 1, total: 1 };
  } catch (error) {
    console.error('  Error converting reviews page:', error.message);
    return { successful: 0, failed: 1, total: 1 };
  }
};

module.exports = {
  convertReviewsIndex
};
