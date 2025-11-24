const path = require('path');
const config = require('../config');
const { listHtmlFiles, prepDir } = require('../utils/filesystem');
const { extractBlogDate, extractBlogHeading, extractBlogImage } = require('../utils/metadata-extractor');
const { generateBlogFrontmatter } = require('../utils/frontmatter-generator');
const { downloadProductImage, downloadEmbeddedImages } = require('../utils/image-downloader');
const { createConverter } = require('../utils/base-converter');

const { convertSingle, convertBatch } = createConverter({
  contentType: 'blog',
  extractors: {
    date: (htmlContent, markdown) => extractBlogDate(markdown, config.DEFAULT_DATE),
    blogHeading: (htmlContent) => extractBlogHeading(htmlContent),
    blogImage: (htmlContent, markdown) => extractBlogImage(markdown)
  },
  beforeWrite: async (content, extracted, slug) => {
    if (extracted.blogImage) {
      extracted.localImagePath = await downloadProductImage(extracted.blogImage, slug);
    }
    return await downloadEmbeddedImages(content, 'news', slug);
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
  const files = listHtmlFiles(blogDir);

  // News directory only contains imported blog posts, safe to clean all
  prepDir(outputDir);

  return await convertBatch(files, blogDir, outputDir);
};

const convertBlogPost = (file, inputDir, outputDir) =>
  convertSingle(file, inputDir, outputDir);

module.exports = {
  convertBlogPost,
  convertBlogPosts
};
