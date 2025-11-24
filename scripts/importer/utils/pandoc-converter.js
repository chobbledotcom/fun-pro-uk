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