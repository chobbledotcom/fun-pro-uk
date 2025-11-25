const fs = require('fs');
const path = require('path');
const { FIND_REPLACES } = require('../constants');

/**
 * Strip title attributes from all markdown links and images
 * Converts [text](url "title") to [text](url)
 * @param {string} content - Markdown content
 * @returns {string} Content with titles stripped
 */
const stripLinkTitles = (content) => {
  // Match markdown links/images with title: [text](url "title") or ![alt](url "title")
  // The title is the quoted text after a space
  return content.replace(
    /(\]\([^)"]+)\s+"[^"]*"\)/g,
    '$1)'
  );
};

/**
 * Convert relative paths to absolute in markdown links and images
 * Handles paths starting with ../ or ./
 * @param {string} content - Markdown content
 * @returns {string} Content with absolute paths
 */
const fixRelativePaths = (content) => {
  // Match markdown links/images with relative paths: [text](../path) or ![alt](./path)
  return content.replace(
    /\]\((?:\.\.\/|\.\/)+([^)]+)\)/g,
    (match, pathPart) => {
      // Ensure path starts with /
      const absolutePath = pathPart.startsWith('/') ? pathPart : '/' + pathPart;
      return `](${absolutePath})`;
    }
  );
};

/**
 * Fix .html extensions in markdown links, replacing with trailing slash URLs
 * Also converts relative paths to absolute, normalizes anchors, and strips titles
 * @param {string} content - Markdown content
 * @returns {string} Content with fixed links
 */
const fixHtmlLinks = (content) => {
  // Match markdown links with .html extension, optionally with #anchor and/or "title"
  // Patterns handled:
  //   [text](path.html)
  //   [text](path.html#anchor)
  //   [text](path.html "title")
  //   [text](path.html#anchor "title")
  return content.replace(
    /\]\(([^)#"\s]+)\.html(?:#([^)"\s]*))?\s*(?:"[^"]*")?\)/g,
    (match, urlPath, anchor) => {
      // Convert relative paths to absolute
      let cleanPath = urlPath;
      if (cleanPath.startsWith('../') || cleanPath.startsWith('./')) {
        // Strip all leading ../ and ./
        cleanPath = cleanPath.replace(/^(?:\.\.\/|\.\/)+/, '/');
      }
      // Ensure path starts with /
      if (!cleanPath.startsWith('/') && !cleanPath.startsWith('http')) {
        cleanPath = '/' + cleanPath;
      }
      // Ensure trailing slash
      if (!cleanPath.endsWith('/')) {
        cleanPath = cleanPath + '/';
      }
      // Handle anchor - convert BodyContent to content, preserve others
      let anchorPart = '';
      if (anchor) {
        if (anchor.toLowerCase() === 'bodycontent') {
          anchorPart = '#content';
        } else if (anchor.toLowerCase() !== 'specification') {
          // Skip #specification anchors as they don't exist in new site
          anchorPart = '#' + anchor;
        }
      }
      return `](${cleanPath}${anchorPart})`;
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

  // Strip title attributes from all remaining links/images
  content = stripLinkTitles(content);

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
  stripLinkTitles,
  fixRelativePaths,
  applyFindReplaces,
  applyFindReplacesRecursive
};
