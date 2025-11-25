const fs = require('fs');
const path = require('path');
const { FIND_REPLACES } = require('../constants');

/**
 * Fix .html extensions in markdown links, replacing with trailing slash URLs
 * @param {string} content - Markdown content
 * @returns {string} Content with .html links converted to trailing slash URLs
 */
const fixHtmlLinks = (content) => {
  // Match markdown links with .html extension: [text](path.html) or [text](path.html "title")
  // Strip the .html (and any title) and add trailing slash
  return content.replace(
    /\]\(([^)"]+)\.html(?:\s+"[^"]*")?\)/g,
    (match, urlPath) => {
      const cleanPath = urlPath.endsWith('/') ? urlPath : urlPath + '/';
      return `](${cleanPath})`;
    }
  );
};

/**
 * Apply find/replace patterns to a markdown file
 * @param {string} filePath - Path to the markdown file
 */
const applyFindReplaces = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // First, fix .html links with regex (handles titles)
  content = fixHtmlLinks(content);

  // Apply each find/replace pattern
  for (const [search, replace] of Object.entries(FIND_REPLACES)) {
    if (content.includes(search)) {
      content = content.replaceAll(search, replace);
    }
  }

  // Only write if modifications were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
};

/**
 * Apply find/replace patterns to all markdown files in a directory
 * @param {string} dirPath - Directory to process
 */
const applyFindReplacesRecursive = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      applyFindReplacesRecursive(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      applyFindReplaces(fullPath);
    }
  }
};

module.exports = {
  fixHtmlLinks,
  applyFindReplaces,
  applyFindReplacesRecursive
};
