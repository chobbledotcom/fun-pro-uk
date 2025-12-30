const path = require('path');
const config = require('../config');
const { listHtmlFilesRecursive, prepDir } = require('../utils/filesystem');
const { extractContentHeading, extractBlogImage } = require('../utils/metadata-extractor');
const { generateBlogFrontmatter } = require('../utils/frontmatter-generator');
const { downloadProductImage, downloadEmbeddedImages, downloadNewsEmbeddedImages } = require('../utils/image-downloader');
const { createConverter, resetClaimedPaths } = require('../utils/base-converter');

/**
 * Extract date from directory path (e.g., /news/2016-10-14/ -> 2016-10-14)
 * @param {string} dirPath - Directory path
 * @returns {string|null} Date in YYYY-MM-DD format or null
 */
const extractDateFromPath = (dirPath) => {
  const match = dirPath.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const { convertSingle, convertBatch } = createConverter({
  contentType: 'blog',
  extractors: {
    // Date comes from context (set from folder path), not from content
    date: (htmlContent, markdown, slug, context) => context.dateFromPath || null,
    blogHeading: (htmlContent) => extractContentHeading(htmlContent),
    blogImage: (htmlContent, markdown) => extractBlogImage(markdown)
  },
  beforeWrite: async (content, extracted, slug) => {
    // Use original URL directly (skip downloading for now)
    if (extracted.blogImage) {
      extracted.localImagePath = extracted.blogImage;
    }
    // Download embedded /userfiles/ images and update paths
    content = await downloadNewsEmbeddedImages(content);
    return content;
  },
  frontmatterGenerator: (metadata, slug, extracted) => ({
    frontmatter: generateBlogFrontmatter(metadata, slug, extracted.date, extracted.blogHeading, extracted.localImagePath),
    filename: `${extracted.date}-${slug}.md`
  })
});

/**
 * Convert all blog posts from old site to markdown
 * @returns {Promise<Object>} Conversion results
 */
const convertBlogPosts = async () => {
  console.log('Converting blog posts to news...');

  const outputDir = path.join(config.OUTPUT_BASE, config.paths.news);
  const blogDir = path.join(config.OLD_SITE_PATH, config.paths.blog);
  const allFileInfos = listHtmlFilesRecursive(blogDir);
  
  // Filter out pagination pages (1.html, 2.html, etc. in the root news directory)
  // These are blog listing pages, not actual blog posts
  const fileInfos = allFileInfos.filter(f => {
    // Skip files like "1.html", "2.html" etc in the root of news/
    if (/^\d+\.html$/.test(f.file) && f.dir === blogDir) {
      return false;
    }
    return true;
  });

  // News directory only contains imported blog posts, safe to clean all
  prepDir(outputDir);

  // Reset claimed paths to track duplicates within this batch
  resetClaimedPaths('blog');

  // Convert each file, using its own directory as inputDir
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < fileInfos.length; i++) {
    const fileInfo = fileInfos[i];
    // Extract date from folder path (e.g., /news/2016-10-14/)
    const dateFromPath = extractDateFromPath(fileInfo.dir);
    const context = { 
      progressIndex: i, 
      progressTotal: fileInfos.length,
      dateFromPath
    };
    if (await convertSingle(fileInfo.file, fileInfo.dir, outputDir, context)) {
      successful++;
    } else {
      failed++;
    }
  }

  return { successful, failed, total: fileInfos.length };
};

const convertBlogPost = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertBlogPost,
  convertBlogPosts
};
