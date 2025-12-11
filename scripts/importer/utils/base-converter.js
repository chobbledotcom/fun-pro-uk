const path = require('path');
const { readHtmlFile, writeMarkdownFile, slugFromFilename, markdownFilename } = require('./filesystem');
const { extractMetadata } = require('./metadata-extractor');
const { convertToMarkdown } = require('./pandoc-converter');
const { processContent } = require('./content-processor');
const { fixHtmlLinks, stripLinkTitles, fixRelativePaths } = require('./find-replace');

/**
 * Create a converter for a specific content type
 * @param {Object} options - Converter configuration
 * @param {string} options.contentType - Type of content (blog, page, product, category)
 * @param {Object} options.extractors - Custom extraction functions
 * @param {Function} options.frontmatterGenerator - Function to generate frontmatter
 * @param {Function} options.beforeWrite - Hook before writing file (optional)
 * @param {Function} options.afterConvert - Hook after successful conversion (optional)
 * @returns {Object} Converter functions
 */
const createConverter = ({
  contentType,
  extractors = {},
  frontmatterGenerator,
  beforeWrite = null,
  afterConvert = null
}) => {
  /**
   * Convert a single file
   * @param {string} file - HTML filename
   * @param {string} inputDir - Input directory path
   * @param {string} outputDir - Output directory path
   * @param {Object} context - Additional context passed through conversion
   * @returns {Promise<boolean>} Success status
   */
  const convertSingle = async (file, inputDir, outputDir, context = {}) => {
    try {
      const htmlPath = path.join(inputDir, file);
      const slug = slugFromFilename(file);

      // Show progress if we have index info
      const progressPrefix = context.progressIndex !== undefined && context.progressTotal !== undefined
        ? `  [${context.progressIndex + 1}/${context.progressTotal}]`
        : ' ';

      process.stdout.write(`${progressPrefix} Converting: ${slug}...`);

      const htmlContent = readHtmlFile(htmlPath);
      const metadata = extractMetadata(htmlContent);
      const markdown = convertToMarkdown(htmlPath);
      let content = processContent(markdown, contentType, htmlContent);
      let filename = markdownFilename(file);

      // Run custom extractors
      const extracted = { ...context };
      for (const [key, extractor] of Object.entries(extractors)) {
        extracted[key] = await extractor(htmlContent, markdown, slug, context);
      }

      // Ensure content starts with H1
      // Check if content already has an H1 at the start
      const hasH1 = /^#\s+/.test(content.trim());
      if (!hasH1) {
        // Find the heading from extracted data (try different heading types)
        const heading = extracted.pageHeading || extracted.blogHeading ||
                       extracted.productHeading || extracted.categoryHeading ||
                       extracted.eventHeading ||
                       metadata.header_text || metadata.title;
        if (heading) {
          content = `# ${heading}\n\n${content}`;
        }
      }

      // Hook before writing (e.g., download images)
      if (beforeWrite) {
        const imageStats = await beforeWrite(content, extracted, slug, context);
        // If beforeWrite returns an object with content and stats, use them
        if (imageStats && typeof imageStats === 'object' && imageStats.content) {
          content = imageStats.content;
          extracted.imageStats = imageStats.stats;
        } else {
          content = imageStats;
        }
      }

      const result = frontmatterGenerator(metadata, slug, extracted, context);
      const frontmatter = result.frontmatter || result;
      filename = result.filename || filename;

      // Fix .html links, relative paths, and strip title attributes before final output
      content = fixHtmlLinks(content);
      content = fixRelativePaths(content);
      content = stripLinkTitles(content);

      const fullContent = `${frontmatter}\n\n${content}`;

      // Check for .html in content body (not frontmatter) - this shouldn't exist in output
      if (content.includes('.html')) {
        console.log(' ✗ FAILED');
        console.error(`    Error: Output contains ".html" - links not fully converted`);
        // Find and show the problematic lines
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('.html')) {
            console.error(`    Line ${idx + 1}: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
          }
        });
        throw new Error(`Output for "${slug}" contains ".html" references that should have been converted`);
      }

      // Check for relative links - all links should be absolute (start with / or http)
      // Match ](foo where foo doesn't start with /, http, #, or mailto:
      const relativeLinks = content.match(/\]\((?![/#]|http|mailto:|tel:)[^)]+\)/g);
      if (relativeLinks && relativeLinks.length > 0) {
        console.log(' ✗ FAILED');
        console.error(`    Error: Output contains relative links - should be absolute`);
        // Find and show the problematic lines
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (/\]\((?![/#]|http|mailto:|tel:)[^)]+\)/.test(line)) {
            console.error(`    Line ${idx + 1}: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
          }
        });
        throw new Error(`Output for "${slug}" contains relative links that should be absolute`);
      }

      writeMarkdownFile(path.join(outputDir, filename), fullContent);
      
      // Simple status - detailed progress shown inline during image downloads
      // Legend: . = cached, + = downloaded, x = failed
      console.log(' ✓');

      // Hook after conversion (e.g., track reviews)
      if (afterConvert) {
        await afterConvert(extracted, slug, context);
      }

      return true;
    } catch (error) {
      console.log(' ✗ FAILED');
      console.error(`    Error: ${error.message}`);
      return false;
    }
  };

  /**
   * Convert all files from a directory
   * @param {string[]} files - Array of HTML filenames
   * @param {string} inputDir - Input directory path
   * @param {string} outputDir - Output directory path
   * @param {Object} context - Additional context passed through conversion
   * @returns {Promise<Object>} Conversion results
   */
  const convertBatch = async (files, inputDir, outputDir, context = {}) => {
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileContext = { ...context, categoryIndex: i, progressIndex: i, progressTotal: files.length };
      if (await convertSingle(file, inputDir, outputDir, fileContext)) {
        successful++;
      } else {
        failed++;
      }
    }

    return { successful, failed, total: files.length };
  };

  return { convertSingle, convertBatch };
};

module.exports = { createConverter };
