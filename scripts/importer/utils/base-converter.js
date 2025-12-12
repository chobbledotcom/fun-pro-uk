const fs = require('fs');
const path = require('path');
const { readHtmlFile, writeMarkdownFile, slugFromFilename, markdownFilename } = require('./filesystem');
const { extractMetadata } = require('./metadata-extractor');
const { convertToMarkdown } = require('./pandoc-converter');
const { processContent } = require('./content-processor');
// Note: Link fixing is now done in a single post-processing pass by link-fixer.js

// Track claimed output paths across all conversions in a session
// Key is the content type, value is a Map of slug -> { filePath, contentHash }
const claimedPaths = new Map();

/**
 * Extract the content body from a markdown file (everything after frontmatter)
 * @param {string} fullContent - Full markdown content with frontmatter
 * @returns {string} Content body without frontmatter
 */
const extractContentBody = (fullContent) => {
  const match = fullContent.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)$/);
  return match ? match[1].trim() : fullContent.trim();
};

/**
 * Normalize content for comparison by removing variable link destinations
 * This allows us to detect when two files have the same text content but different URLs
 * @param {string} content - Content to normalize
 * @returns {string} Normalized content
 */
const normalizeContentForComparison = (content) => {
  let normalized = content;
  
  // Remove all link destinations, keeping only the link text
  // Pattern: [text](url) -> [text]
  // This normalizes both empty links [](url) and text links [text](url)
  normalized = normalized.replace(/\]\([^)]+\)/g, ']()');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

/**
 * Add a redirect_from URL to an existing markdown file
 * @param {string} filePath - Path to the existing markdown file
 * @param {string} newRedirectUrl - New redirect URL to add
 * @returns {boolean} True if URL was added, false if already present
 */
const addRedirectToExistingFile = (filePath, newRedirectUrl) => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if this redirect URL already exists
  if (content.includes(`"${newRedirectUrl}"`)) {
    return false;
  }
  
  // Find the redirect_from section and add the new URL
  const redirectMatch = content.match(/(redirect_from:\s*\n(?:\s+-\s*"[^"]+"\s*\n)*)/);
  if (redirectMatch) {
    // Add new URL to existing redirect_from
    const newRedirectSection = redirectMatch[1] + `  - "${newRedirectUrl}"\n`;
    const updatedContent = content.replace(redirectMatch[1], newRedirectSection);
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    return true;
  }
  
  // No redirect_from section exists, add one before the closing ---
  // Find the end of frontmatter
  const frontmatterEnd = content.indexOf('\n---', 4);
  if (frontmatterEnd !== -1) {
    const beforeEnd = content.substring(0, frontmatterEnd);
    const afterEnd = content.substring(frontmatterEnd);
    const updatedContent = beforeEnd + `\nredirect_from:\n  - "${newRedirectUrl}"` + afterEnd;
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    return true;
  }
  
  return false;
};

/**
 * Check if content matches an existing file (for deduplication)
 * @param {string} contentType - Type of content (blog, page, product, etc.)
 * @param {string} filename - The desired filename (may include subdirectory like "birmingham/batak.md")
 * @param {string} outputDir - Output directory path
 * @param {string} contentBody - The content body to compare
 * @param {string} redirectUrl - The redirect URL for this content
 * @returns {Object} { isDuplicate: boolean, existingPath: string|null }
 */
const checkForDuplicateContent = (contentType, filename, outputDir, contentBody, redirectUrl) => {
  if (!claimedPaths.has(contentType)) {
    claimedPaths.set(contentType, new Map());
  }
  const claimed = claimedPaths.get(contentType);

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const dirPart = path.dirname(filename);
  const hasSubdir = dirPart !== '.';
  const dateMatch = baseName.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  const slugPart = dateMatch ? dateMatch[1] : baseName;
  
  // For files in subdirectories, include the directory in the key
  const claimKey = hasSubdir ? `${dirPart}/${slugPart}` : slugPart;

  // Normalize content for comparison
  const normalizedNewContent = normalizeContentForComparison(contentBody);

  // Check if we have an existing file with this slug
  if (claimed.has(claimKey)) {
    const existing = claimed.get(claimKey);
    
    // Read and compare content
    if (fs.existsSync(existing.filePath)) {
      const existingFullContent = fs.readFileSync(existing.filePath, 'utf8');
      const existingBody = extractContentBody(existingFullContent);
      const normalizedExisting = normalizeContentForComparison(existingBody);
      
      // If content is the same, this is a duplicate
      if (normalizedNewContent === normalizedExisting) {
        return { isDuplicate: true, existingPath: existing.filePath };
      }
    }
  }

  return { isDuplicate: false, existingPath: null };
};

/**
 * Get a unique filename by adding a suffix if the path is already claimed
 * @param {string} contentType - Type of content (blog, page, product, etc.)
 * @param {string} filename - The desired filename (may include subdirectory like "birmingham/batak.md")
 * @param {string} outputDir - Output directory path (for storing file path)
 * @returns {string} A unique filename (with -2, -3, etc. suffix if needed)
 */
const getUniqueFilename = (contentType, filename, outputDir = '') => {
  if (!claimedPaths.has(contentType)) {
    claimedPaths.set(contentType, new Map());
  }
  const claimed = claimedPaths.get(contentType);

  // Normalize the filename to extract the base path (the part that becomes the permalink)
  // For blog posts: 2017-11-19-christmas-parties-are-go.md -> christmas-parties-are-go
  // For locations: birmingham/batak.md -> birmingham/batak (include subdirectory!)
  const ext = path.extname(filename);
  const filenameWithoutExt = filename.slice(0, -ext.length);
  const baseName = path.basename(filename, ext);
  const dirPart = path.dirname(filename);
  const hasSubdir = dirPart !== '.';

  // Extract the slug part (remove date prefix if present for blog posts)
  // Pattern: YYYY-MM-DD-slug -> slug
  const dateMatch = baseName.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  const slugPart = dateMatch ? dateMatch[1] : baseName;
  
  // For files in subdirectories, include the directory in the key to avoid conflicts
  // e.g., "birmingham/batak" and "coventry/batak" are different keys
  const claimKey = hasSubdir ? `${dirPart}/${slugPart}` : slugPart;

  // Check if this slug is already claimed
  if (!claimed.has(claimKey)) {
    claimed.set(claimKey, { filePath: path.join(outputDir, filename) });
    return filename;
  }

  // Find a unique suffix
  let counter = 2;
  let uniqueSlug = `${slugPart}-${counter}`;
  let uniqueKey = hasSubdir ? `${dirPart}/${uniqueSlug}` : uniqueSlug;
  while (claimed.has(uniqueKey)) {
    counter++;
    uniqueSlug = `${slugPart}-${counter}`;
    uniqueKey = hasSubdir ? `${dirPart}/${uniqueSlug}` : uniqueSlug;
  }
  
  // Reconstruct the filename with the new slug, preserving subdirectory
  let newFilename;
  if (dateMatch) {
    // Preserve the date prefix: 2017-11-19-slug-2.md
    const newBasename = `${baseName.substring(0, 11)}${uniqueSlug}${ext}`;
    newFilename = hasSubdir ? `${dirPart}/${newBasename}` : newBasename;
  } else {
    newFilename = hasSubdir ? `${dirPart}/${uniqueSlug}${ext}` : `${uniqueSlug}${ext}`;
  }
  
  claimed.set(uniqueKey, { filePath: path.join(outputDir, newFilename) });
  return newFilename;
};

/**
 * Reset claimed paths for a content type (call at start of batch conversion)
 * @param {string} contentType - Type of content to reset
 */
const resetClaimedPaths = (contentType) => {
  if (claimedPaths.has(contentType)) {
    claimedPaths.get(contentType).clear();
  }
};

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

      // Note: Links are left as-is during conversion (with .html, relative paths, etc.)
      // They are fixed in a single post-processing pass by link-fixer.js after all
      // content is imported and we have a complete picture of valid destinations.

      // Extract redirect_from URL from frontmatter for duplicate detection
      const redirectMatch = frontmatter.match(/redirect_from:\s*\n\s+-\s*"([^"]+)"/);
      const redirectUrl = redirectMatch ? redirectMatch[1] : null;

      // Check for duplicate content before creating a new file
      const { isDuplicate, existingPath } = checkForDuplicateContent(
        contentType, filename, outputDir, content, redirectUrl
      );

      if (isDuplicate && existingPath && redirectUrl) {
        // Content is the same as an existing file - just add the redirect URL
        const added = addRedirectToExistingFile(existingPath, redirectUrl);
        if (added) {
          console.log(` ✓ (merged redirect to ${path.basename(existingPath)})`);
        } else {
          console.log(` ✓ (redirect already exists)`);
        }
        return true;
      }

      // Ensure unique output path to avoid permalink conflicts
      filename = getUniqueFilename(contentType, filename, outputDir);

      const fullContent = `${frontmatter}\n\n${content}`;

      // Note: .html links and relative paths are allowed here - they will be fixed
      // by link-fixer.js in a post-processing step after all content is imported.

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

module.exports = { createConverter, resetClaimedPaths };
