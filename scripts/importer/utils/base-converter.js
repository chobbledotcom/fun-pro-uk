const path = require('path');
const { readHtmlFile, writeMarkdownFile, slugFromFilename, markdownFilename } = require('./filesystem');
const { extractMetadata } = require('./metadata-extractor');
const { convertToMarkdown } = require('./pandoc-converter');
const { processContent } = require('./content-processor');

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
      const htmlContent = readHtmlFile(htmlPath);
      const metadata = extractMetadata(htmlContent);
      const markdown = convertToMarkdown(htmlPath);
      let content = processContent(markdown, contentType, htmlContent);

      const slug = slugFromFilename(file);
      let filename = markdownFilename(file);

      // Run custom extractors
      const extracted = { ...context };
      for (const [key, extractor] of Object.entries(extractors)) {
        extracted[key] = await extractor(htmlContent, markdown, slug);
      }

      // Ensure content starts with H1
      // Check if content already has an H1 at the start
      const hasH1 = /^#\s+/.test(content.trim());
      if (!hasH1) {
        // Find the heading from extracted data (try different heading types)
        const heading = extracted.pageHeading || extracted.blogHeading ||
                       extracted.productHeading || extracted.categoryHeading ||
                       metadata.header_text || metadata.title;
        if (heading) {
          content = `# ${heading}\n\n${content}`;
        }
      }

      // Hook before writing (e.g., download images)
      if (beforeWrite) {
        content = await beforeWrite(content, extracted, slug, context);
      }

      const result = frontmatterGenerator(metadata, slug, extracted, context);
      const frontmatter = result.frontmatter || result;
      filename = result.filename || filename;

      const fullContent = `${frontmatter}\n\n${content}`;

      writeMarkdownFile(path.join(outputDir, filename), fullContent);
      console.log(`  Converted: ${filename}`);

      // Hook after conversion (e.g., track reviews)
      if (afterConvert) {
        await afterConvert(extracted, slug, context);
      }

      return true;
    } catch (error) {
      console.error(`  Error converting ${file}:`, error.message);
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
      const fileContext = { ...context, categoryIndex: i };
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
