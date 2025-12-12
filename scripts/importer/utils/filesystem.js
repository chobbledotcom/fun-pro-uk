const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dir - Directory path to ensure exists
 */
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Read HTML file content
 * @param {string} filePath - Path to HTML file
 * @returns {string} HTML content
 */
const readHtmlFile = (filePath) => {
  return fs.readFileSync(filePath, 'utf8');
};

/**
 * Write markdown file
 * @param {string} filePath - Path to output file
 * @param {string} content - Content to write
 */
const writeMarkdownFile = (filePath, content) => {
  fs.writeFileSync(filePath, content);
};

/**
 * List HTML files in a directory
 * @param {string} dir - Directory to list files from
 * @returns {string[]} Array of HTML filenames
 */
const listHtmlFiles = (dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter(f => f.endsWith('.html'));
};

/**
 * Recursively list all HTML files in a directory and its subdirectories
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for relative paths (optional)
 * @returns {Array<{file: string, fullPath: string, relativePath: string, dir: string}>} Array of file info objects
 */
const listHtmlFilesRecursive = (dir, baseDir = dir) => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively search subdirectories
      results = results.concat(listHtmlFilesRecursive(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      // Calculate relative path from baseDir
      const relativePath = path.relative(baseDir, fullPath);
      results.push({
        file: entry.name,
        fullPath: fullPath,
        relativePath: relativePath,
        dir: path.dirname(fullPath)
      });
    }
  }

  return results;
};

/**
 * Clean files from a directory, optionally filtering which files to delete
 * @param {string} dir - Directory to clean
 * @param {Function} shouldDelete - Optional function(filename) that returns true if file should be deleted
 */
const cleanDirectory = (dir, shouldDelete = null) => {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isFile()) {
        if (!shouldDelete || shouldDelete(file)) {
          fs.unlinkSync(filePath);
        }
      }
    });
  }
};

/**
 * Prepare a directory for import by ensuring it exists and cleaning files
 * @param {string} dir - Directory path to prepare
 * @param {Function} shouldDelete - Optional function(filename) that returns true if file should be deleted
 */
const prepDir = (dir, shouldDelete = null) => {
  ensureDir(dir);
  cleanDirectory(dir, shouldDelete);
};

/**
 * Download a file from URL (skips if file already exists)
 * @param {string} url - URL to download from
 * @param {string} filepath - Local path to save file
 * @param {boolean} force - Force re-download even if file exists
 * @returns {Promise<void>}
 */
const downloadFile = (url, filepath, force = false) => {
  return new Promise((resolve, reject) => {
    // Skip download if file already exists (caching)
    if (!force && fs.existsSync(filepath)) {
      resolve();
      return;
    }

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const writeStream = fs.createWriteStream(filepath);
        response.pipe(writeStream);
        writeStream.on('finish', () => {
          writeStream.close();
          resolve();
        });
        writeStream.on('error', reject);
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
};

/**
 * Extract slug from HTML filename
 * @param {string} filename - HTML or markdown filename
 * @returns {string} Slug without extension, sanitized
 */
const slugFromFilename = (filename) =>
  filename
    .replace('.php.html', '')
    .replace(/\.html$/, '')
    .replace(/\.md$/, '')
    .replace(/['']/g, '');  // Remove apostrophes

/**
 * Convert HTML filename to markdown filename
 * @param {string} htmlFilename - HTML filename
 * @returns {string} Markdown filename, sanitized
 */
const markdownFilename = (htmlFilename) =>
  htmlFilename
    .replace('.php.html', '.md')
    .replace(/\.html$/, '.md')
    .replace(/['']/g, '');  // Remove apostrophes

module.exports = {
  ensureDir,
  readHtmlFile,
  writeMarkdownFile,
  listHtmlFiles,
  listHtmlFilesRecursive,
  cleanDirectory,
  prepDir,
  downloadFile,
  slugFromFilename,
  markdownFilename
};
