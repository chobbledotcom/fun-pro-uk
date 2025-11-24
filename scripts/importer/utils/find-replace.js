const fs = require('fs');
const path = require('path');
const { FIND_REPLACES } = require('../constants');

/**
 * Apply find/replace patterns to a markdown file
 * @param {string} filePath - Path to the markdown file
 */
const applyFindReplaces = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Apply each find/replace pattern
  for (const [search, replace] of Object.entries(FIND_REPLACES)) {
    if (content.includes(search)) {
      content = content.replaceAll(search, replace);
      modified = true;
    }
  }

  // Only write if modifications were made
  if (modified) {
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
  applyFindReplaces,
  applyFindReplacesRecursive
};
