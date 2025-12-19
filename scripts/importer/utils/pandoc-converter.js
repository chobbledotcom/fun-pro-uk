const TurndownService = require('turndown');
const fs = require('fs');

// Shared turndown instance for snippet conversion
let sharedTurndownService = null;

/**
 * Get or create a shared turndown service instance
 * @returns {TurndownService} Configured turndown instance
 */
const getTurndownService = () => {
  if (!sharedTurndownService) {
    sharedTurndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**'
    });
  }
  return sharedTurndownService;
};

/**
 * Convert an HTML snippet to markdown using turndown
 * Useful for converting small pieces of HTML like FAQ answers
 * @param {string} html - HTML string to convert
 * @returns {string} Markdown content with paragraph breaks preserved
 */
const htmlToMarkdown = (html) => {
  if (!html) return '';
  
  // Decode common HTML entities first
  let cleaned = html
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/g, '£')
    .replace(/&hellip;/g, '...');
  
  // Strip span tags (they don't add semantic value)
  cleaned = cleaned.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
  
  const turndownService = getTurndownService();
  let markdown = turndownService.turndown(cleaned);
  
  // Normalize runs of whitespace within lines, but preserve paragraph breaks
  // Turndown outputs paragraphs separated by \n\n
  markdown = markdown
    .split(/\n\n+/)  // Split on paragraph breaks
    .map(para => para.replace(/\s+/g, ' ').trim())  // Normalize whitespace within each paragraph
    .filter(para => para.length > 0)  // Remove empty paragraphs
    .join('\n\n');  // Rejoin with double newlines
  
  return markdown;
};

/**
 * Convert HTML file to markdown using turndown
 * @param {string} htmlFile - Path to HTML file
 * @returns {string} Markdown content
 */
const convertToMarkdown = (htmlFile) => {
  try {
    // Read HTML file
    let html = fs.readFileSync(htmlFile, 'utf8');

    // Strip unwanted sections before conversion
    // Remove script tags and their content
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove style tags and their content
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Remove footer and everything after it
    html = html.replace(/<footer[\s\S]*$/i, '');
    html = html.replace(/<div[^>]*class="[^"]*footer[^"]*"[\s\S]*$/i, '');
    // Remove form sections by ID (more aggressive)
    html = html.replace(/<div[^>]*id="[^"]*ContactForm[^"]*"[\s\S]*$/i, '');
    html = html.replace(/<div[^>]*id="[^"]*CustomContactForm[^"]*"[\s\S]*$/i, '');
    // Remove navigation elements
    html = html.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    html = html.replace(/<div[^>]*class="[^"]*navbar[^"]*"[\s\S]*?<\/div>/gi, '');

    // Strip <span> tags to produce cleaner markdown
    html = html.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');

    // Configure turndown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**'
    });

    // Convert to markdown
    const markdown = turndownService.turndown(html);
    return markdown;
  } catch (error) {
    console.error(`Error converting ${htmlFile}:`, error.message);
    return '';
  }
};

module.exports = {
  convertToMarkdown,
  htmlToMarkdown
};