const { execSync } = require('child_process');

/**
 * Convert HTML file to markdown using pandoc
 * Preprocesses HTML to remove <span> tags which create complex nested bracket structures
 * @param {string} htmlFile - Path to HTML file
 * @returns {string} Markdown content
 */
const convertToMarkdown = (htmlFile) => {
  try {
    // Strip <span> tags before pandoc to avoid complex bracketed_spans in output
    // This produces much cleaner markdown as pandoc doesn't try to preserve inline styling
    const result = execSync(
      `sed 's/<span[^>]*>//g; s/<\\/span>//g' "${htmlFile}" | pandoc -f html -t markdown --wrap=none`,
      { encoding: 'utf8' }
    );
    return result;
  } catch (error) {
    console.error(`Error converting ${htmlFile}:`, error.message);
    return '';
  }
};

module.exports = {
  convertToMarkdown
};