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
 * Download a file from URL
 * @param {string} url - URL to download from
 * @param {string} filepath - Local path to save file
 * @returns {Promise<void>}
 */
const downloadFile = (url, filepath) => {
  return new Promise((resolve, reject) => {
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
 * @returns {string} Slug without extension
 */
const slugFromFilename = (filename) =>
  filename.replace('.php.html', '').replace('.md', '');

/**
 * Convert HTML filename to markdown filename
 * @param {string} htmlFilename - HTML filename
 * @returns {string} Markdown filename
 */
const markdownFilename = (htmlFilename) =>
  htmlFilename.replace('.php.html', '.md');

module.exports = {
  ensureDir,
  readHtmlFile,
  writeMarkdownFile,
  listHtmlFiles,
  cleanDirectory,
  prepDir,
  downloadFile,
  slugFromFilename,
  markdownFilename
};
