const path = require('path');
const config = require('../config');
const { listHtmlFilesRecursive, prepDir } = require('../utils/filesystem');
const { extractBlogDate, extractContentHeading, extractBlogImage } = require('../utils/metadata-extractor');
const { generateBlogFrontmatter } = require('../utils/frontmatter-generator');
const { downloadProductImage, downloadEmbeddedImages } = require('../utils/image-downloader');
const { createConverter } = require('../utils/base-converter');

const { convertSingle, convertBatch } = createConverter({
  contentType: 'blog',
  extractors: {
    date: (htmlContent, markdown) => extractBlogDate(markdown, config.DEFAULT_DATE),
    blogHeading: (htmlContent) => extractContentHeading(htmlContent),
    blogImage: (htmlContent, markdown) => extractBlogImage(markdown)
  },
  beforeWrite: async (content, extracted, slug) => {
    // Use original URL directly (skip downloading for now)
    if (extracted.blogImage) {
      extracted.localImagePath = extracted.blogImage;
    }
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

  // Convert each file, using its own directory as inputDir
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < fileInfos.length; i++) {
    const fileInfo = fileInfos[i];
    const context = { progressIndex: i, progressTotal: fileInfos.length };
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
