const { parseSpecificationTables } = require('./markdown-table-parser');
const { extractSpecificationTable, extractPriceTable } = require('./html-table-extractor');
const { faqPatterns } = require('./html-patterns');

/**
 * Extract main content from markdown (remove nav, footer, etc.)
 * @param {string} markdown - Raw markdown content
 * @param {string} contentType - Type of content (blog, page, product, category)
 * @returns {string} Extracted main content
 */
const extractMainContent = (markdown, contentType) => {
  const lines = markdown.split('\n');
  let content = [];
  let inMainContent = false;
  let skipNext = false;
  let inReviewSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip navigation and header elements
    if (line.includes('navbar') || line.includes('drawer') || line.includes('breadcrumb')) {
      skipNext = true;
      continue;
    }

    // Skip forms (contact forms should be handled by layout)
    // Only break on actual form field labels (with escaped asterisk), not contact information
    if (line.includes('**Name: \\*') || line.includes('**Phone: \\*') ||
        line.includes('**Email: \\*') || line.includes('**Product Enquiry:') ||
        line.includes('**Your Postcode:') || line.includes('**Message:') ||
        line.includes('**Captcha:')) {
      break;
    }

    // Detect start of review section and skip until we hit "Our Prices!" or new heading
    if (line.includes('Our Reviews!')) {
      inReviewSection = true;
      continue;
    }

    // Exit review section when we hit "Our Prices!" or a main heading
    if (inReviewSection && (line.includes('Our Prices!') || line.match(/^# [A-Z]/))) {
      inReviewSection = false;
      // Don't skip "Our Prices!" - we want to keep it
    }

    // Skip content while in review section
    if (inReviewSection) {
      continue;
    }

    // Skip footer content
    if (line.includes('footer') || line.includes('widget_section')) {
      break;
    }

    // Look for main content indicators based on content type
    if (contentType === 'blog' && (line.includes('# ') || line.includes('Posted By:'))) {
      inMainContent = true;
    } else if ((contentType === 'page' || contentType === 'product' || contentType === 'category' || contentType === 'event' || contentType === 'location') && line.includes('# ')) {
      inMainContent = true;
    }

    if (inMainContent && !skipNext) {
      content.push(line);
    }

    skipNext = false;
  }

  return content.join('\n').trim();
};

/**
 * Remove product listings from category content
 * Product listings appear as pairs of links:
 * [Product Name](/path/to/product/)
 *
 * [More Details](/path/to/product/)
 *
 * These can appear anywhere in the content and should be removed
 * @param {string} content - Content to clean
 * @returns {string} Content with product listings removed
 */
const removeProductListings = (content) => {
  // First, strip title attributes from all links to simplify pattern matching
  // Markdown links can be [text](url) or [text](url "title") or [text](url 'title')
  // Title attributes can contain parentheses which break our patterns
  content = content.replace(/(\[[^\]]+\]\([^)\s]+)\s+["'][^"']*["']\)/g, '$1)');

  // Remove all "More Details" standalone links first
  content = content.replace(/^\[More Details\]\([^)]+\)\s*$/gm, '');

  // Clean up extra blank lines to normalize the content
  content = content.replace(/\n{3,}/g, '\n\n');

  // Now remove blocks of consecutive standalone links
  // A standalone link is a line containing ONLY a markdown link (trimmed)
  // We need at least 2 consecutive links (separated by single blank lines) to form a block

  // Pattern to match 2+ standalone links separated by blank lines
  // This regex matches: [text](url) followed by blank line(s) followed by another [text](url)
  const linkBlockPattern = /^(\[[^\]]+\]\([^)]+\))\s*\n\n(\[[^\]]+\]\([^)]+\)\s*\n\n)+/gm;

  // Keep removing blocks until no more are found
  let prevContent;
  do {
    prevContent = content;
    content = content.replace(linkBlockPattern, '');
  } while (content !== prevContent);

  // Also remove any remaining single standalone links that were at the end of a block
  // These appear as a link on its own followed by a ## heading
  content = content.replace(/^(\[[^\]]+\]\([^)]+\))\s*\n\n(##)/gm, '$2');

  // Clean up extra blank lines left behind
  content = content.replace(/\n{3,}/g, '\n\n');

  return content;
};

/**
 * Check if content contains an FAQ section heading
 * @param {string} content - Markdown content to check
 * @returns {boolean} True if FAQ section heading is present
 */
const hasFAQSection = (content) => {
  // Check for FAQ heading pattern (## or bold text with FAQ/Frequently Asked)
  return /^(?:##\s+)?\*{0,4}(?:Festive\s+)?(?:FAQ|Frequently\s+Asked)/im.test(content);
};

/**
 * Normalize text for comparison - strips markdown formatting, extra whitespace, and punctuation variations
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text for comparison
 */
const normalizeText = (text) => {
  return text
    .replace(/^#+\s*/, '')           // Remove heading markers
    .replace(/\*+/g, '')             // Remove bold/italic markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with just text
    .replace(/[\u2018\u2019\u02BC\u0060']/g, "'")  // Normalize apostrophes (left/right single quotes, modifier letter apostrophe, backtick)
    .replace(/[\u201C\u201D\u201E"]/g, '"')        // Normalize double quotes (left/right/low double quotes)
    .replace(/[\u2013\u2014]/g, '-')               // Normalize dashes (en-dash, em-dash)
    .replace(/\u2026/g, '...')                     // Normalize ellipsis
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
};

/**
 * Strip FAQ content from markdown by removing only lines that match extracted Q&A
 * Removes: FAQ heading line, question lines, and answer lines that match extracted content
 * Preserves: Everything else (branding sections, other content)
 * @param {string} content - Markdown content to strip FAQs from
 * @param {Array<Object>} faqs - Array of extracted FAQ objects with question and answer
 * @returns {string} Content with only matched FAQ content removed
 */
const stripFAQSection = (content, faqs = []) => {
  // First, remove the FAQ heading line
  content = content.replace(/^(?:##\s+)?\*{0,4}(?:Festive\s+)?(?:FAQ|Frequently\s+Asked)[^\n]*\n*/gim, '');
  
  if (!faqs || faqs.length === 0) {
    return content.replace(/\n{3,}/g, '\n\n').trim();
  }
  
  // Build normalized versions of questions and answers for matching
  const normalizedQuestions = faqs.map(faq => normalizeText(faq.question));
  const normalizedAnswers = faqs.map(faq => normalizeText(faq.answer));
  
  // Process content line by line
  const lines = content.split('\n');
  const resultLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedLine = normalizeText(line);
    
    // Skip empty lines for matching purposes but keep them in output
    if (!normalizedLine) {
      resultLines.push(line);
      continue;
    }
    
    // Check if this line is a question
    let isQuestion = false;
    for (const q of normalizedQuestions) {
      // Match if the line contains the question (questions may have ### prefix etc)
      if (normalizedLine === q || normalizedLine === q.replace(/\?$/, '')) {
        isQuestion = true;
        break;
      }
    }
    
    if (isQuestion) {
      // Skip this question line
      continue;
    }
    
    // Check if this line is part of an answer
    let isAnswer = false;
    for (const a of normalizedAnswers) {
      // Exact match
      if (normalizedLine === a) {
        isAnswer = true;
        break;
      }
      // Check if the line is contained in the answer (for multi-line answers)
      // Require some minimum length to avoid false matches on common words
      if (normalizedLine.length >= 15 && a.includes(normalizedLine)) {
        isAnswer = true;
        break;
      }
      // Check if the answer starts with this line (first paragraph of multi-para answer)
      if (normalizedLine.length >= 15 && a.startsWith(normalizedLine)) {
        isAnswer = true;
        break;
      }
    }
    
    if (isAnswer) {
      // Skip this answer line
      continue;
    }
    
    // Keep this line
    resultLines.push(line);
  }
  
  // Clean up multiple consecutive blank lines
  return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Clean up content by removing unwanted markdown artifacts
 * @param {string} content - Content to clean
 * @param {string} contentType - Type of content (for context-specific cleaning)
 * @returns {string} Cleaned content
 */
const cleanContent = (content, contentType) => {
  // Remove product listings from category and event pages
  if (contentType === 'category' || contentType === 'event') {
    content = removeProductListings(content);
  }

  // For blog posts, remove H4 breadcrumb titles
  if (contentType === 'blog') {
    content = content.replace(/^####\s+.+$/gm, '');
  }

  // Note: For products, FAQ stripping is done in the product converter's beforeWrite hook
  // where we have access to the extracted FAQs for precise removal

  content = content.trim();

  return content
    .replace(/Posted By:.*?\n/g, '') // Remove blog post metadata
    .replace(/^\[\s*Back [Tt]o\s+[^\]]+\]\([^)]+\)(\{[^}]+\})?\s*$/gm, '') // Remove "Back to" links
    .replace(/^:::\s*.*$/gm, '') // Remove all pandoc div markers
    .replace(/\{[^}]*\}/g, '') // Remove any remaining attribute blocks
    .replace(/\[ \]/g, '') // Remove empty checkbox markers
    // Remove broken cloudinary image links
    .replace(/^!\[.*?\]\(https:\/\/res\.cloudinary\.com\/kbs\/image\/upload\/\)\s*$/gm, '')
    // Remove empty markdown links (gallery images)
    .replace(/^\[\]\([^)]+\)\s*$/gm, '')
    // Remove links with only whitespace or image title text
    .replace(/^\[!?\[.*?\]\([^)]*\)\]\([^)]*\)\s*$/gm, '')
    // Remove social share buttons
    .replace(/^\[!?\[Share.*?\]\([^)]*\)\]\([^)]*\)\s*$/gm, '')
    .replace(/^\*\*Share This Product:?\*\*.*$/gm, '')
    // Remove horizontal rules that are artifacts
    .replace(/^\* \* \*\s*$/gm, '')
    // Remove form-related content
    .replace(/^\*\*Please [Ss]elect.*$/gm, '')
    .replace(/^\*\*Product Enquiry.*$/gm, '')
    .replace(/^\*\*Your Event Date.*$/gm, '')
    .replace(/^\*\*Event Type.*$/gm, '')
    .replace(/^\*\*Additional Info.*$/gm, '')
    // Fix multiple asterisks
    .replace(/\*{3,}/g, '**')
    .replace(/\*\*[ \t\u00A0]+\*\*/g, '**')
    // Fix space (including nbsp) before/after ** at end of line
    .replace(/[ \t\u00A0]+\*\*[ \t\u00A0]*$/gm, '**')
    // Remove trailing backslashes
    .replace(/\\[ \t]*$/gm, '')
    // Fix relative links: ../pages/foo.php.html -> /pages/foo/
    .replace(/\(\.\.\/([^)]+)\.php\.html\)/g, '(/$1/)')
    // Normalize whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

/**
 * Process raw markdown to extract and clean content
 * @param {string} markdown - Raw markdown from pandoc
 * @param {string} contentType - Type of content
 * @param {string} htmlContent - Original HTML content (for product tables)
 * @returns {string} Processed and cleaned content
 */
const processContent = (markdown, contentType, htmlContent = null) => {
  const extracted = extractMainContent(markdown, contentType);
  let cleaned = cleanContent(extracted, contentType);

  // For products, extract tables from HTML and inject into markdown content
  if (contentType === 'product' && htmlContent) {
    const specs = extractSpecificationTable(htmlContent);
    const prices = extractPriceTable(htmlContent);

    // Remove the placeholder sections and replace with HTML-extracted content
    cleaned = cleaned.replace(/Product Specifications![\s\S]*?(?=Our Prices!|$)/i, specs + '\n\n');
    cleaned = cleaned.replace(/Our Prices![\s\S]*?(?=\n\n-{5,}|$)/i, prices);
  }

  return cleaned;
};

module.exports = {
  extractMainContent,
  cleanContent,
  processContent,
  stripFAQSection,
  hasFAQSection
};