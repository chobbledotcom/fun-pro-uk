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

/**
 * Extract the main content body from markdown (skip navigation/header junk)
 * Similar to extractMainContent in content-processor.js but simplified for blog posts
 * @param {string} markdown - Raw markdown content
 * @returns {string} Main content body
 */
const extractMainContentBody = (markdown) => {
  const lines = markdown.split('\n');
  let content = [];
  let inMainContent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip navigation and header elements
    if (line.includes('navbar') || line.includes('drawer') || line.includes('breadcrumb')) {
      continue;
    }

    // Skip footer content
    if (line.includes('footer') || line.includes('widget_section')) {
      break;
    }

    // Look for main content start - H1 heading or Posted By indicator
    if (line.includes('# ') || line.includes('Posted By:')) {
      inMainContent = true;
    }

    if (inMainContent) {
      content.push(line);
    }
  }

  return content.join('\n').trim();
};

/**
 * Extract subtitle from markdown content
 * Gets the first 20 words, stripped of HTML/markdown formatting, ending with "..."
 * @param {string} markdown - Markdown content
 * @returns {string} Subtitle text
 */
const extractSubtitle = (markdown) => {
  if (!markdown) return '';

  // First extract just the main content body (skip nav/header junk)
  let text = extractMainContentBody(markdown);

  // Remove the H1 heading with date pattern (e.g., "# [14 October 16 - Title](url)")
  // This is the blog title which is already in the title field
  text = text.replace(/^#\s+\[\d{1,2}\s+[A-Za-z]+\s+\d{2}\s+-\s+[^\]]+\]\([^)]+\)\s*/m, '');

  // Also remove any remaining H1/H2 headings at the start
  text = text.replace(/^#+\s+[^\n]+\n+/m, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Remove markdown images FIRST (before links, so ![alt](url) doesn't get mangled)
  // Handle images wrapped in bold/italic markers
  text = text.replace(/\*{0,2}!\[[^\]]*\]\([^)]*\)\*{0,2}/g, '');

  // Remove any remaining image-like patterns (malformed or partial)
  text = text.replace(/!\[[^\]]*\]/g, '');

  // Remove markdown links [text](url) - keep the text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove empty markdown links [](url)
  text = text.replace(/\[\]\([^)]+\)/g, '');

  // Remove remaining markdown heading markers
  text = text.replace(/^#+\s+/gm, '');

  // Remove markdown bold/italic markers
  text = text.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1');
  text = text.replace(/_{1,2}([^_]+)_{1,2}/g, '$1');

  // Remove "Posted By:" line
  text = text.replace(/Posted By:.*?\n/g, '');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Get the first 20 words
  const words = text.split(' ').filter(w => w.length > 0);
  const first20 = words.slice(0, 20);

  if (first20.length === 0) return '';

  return first20.join(' ') + '...';
};

const { convertSingle, convertBatch } = createConverter({
  contentType: 'blog',
  extractors: {
    // Date comes from context (set from folder path), not from content
    date: (htmlContent, markdown, slug, context) => context.dateFromPath || null,
    blogHeading: (htmlContent) => extractContentHeading(htmlContent),
    blogImage: (htmlContent, markdown) => extractBlogImage(markdown),
    subtitle: (htmlContent, markdown) => extractSubtitle(markdown)
  },
  beforeWrite: async (content, extracted, slug) => {
    // Use original URL directly (skip downloading for now)
    if (extracted.blogImage) {
      extracted.localImagePath = extracted.blogImage;
    }
    // Download embedded /userfiles/ images and update paths
    content = await downloadNewsEmbeddedImages(content);

    // Strip the H1 heading from the body (e.g., "# [14 October 16 - Title Here](url)")
    // This info is now displayed via the title frontmatter field
    // The H1 is a markdown link: # [DD Month YY - Title](url "title")
    content = content.replace(/^# \[\d{1,2} [A-Za-z]+ \d{2} - [^\]]+\]\([^)]+\)\n+/m, '');

    return content;
  },
  frontmatterGenerator: (metadata, slug, extracted) => ({
    frontmatter: generateBlogFrontmatter(metadata, slug, extracted.date, extracted.blogHeading, extracted.localImagePath, extracted.subtitle),
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
