const TurndownService = require('turndown');
const fs = require('fs');

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
  convertToMarkdown
};