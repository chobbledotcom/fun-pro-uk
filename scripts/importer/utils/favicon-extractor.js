const fs = require('fs');
const path = require('path');
const { prepDir } = require('./filesystem');

/**
 * Extract all favicon-related links from HTML content
 * @param {string} htmlContent - HTML content to extract favicon links from
 * @returns {Array<Object>} Array of favicon link objects with rel, href, sizes, type
 */
const extractFaviconLinks = (htmlContent) => {
  const faviconLinks = [];

  // Match all link tags that might be favicon-related
  const linkRegex = /<link\s+([^>]*?)>/gi;
  const links = htmlContent.matchAll(linkRegex);

  for (const linkMatch of links) {
    const linkTag = linkMatch[1];

    // Check if this is a favicon-related link
    const relMatch = linkTag.match(/rel=["']([^"']*?)["']/i);
    if (!relMatch) continue;

    const rel = relMatch[1].toLowerCase();
    const isFavicon = rel.includes('icon') || rel.includes('apple-touch');

    if (!isFavicon) continue;

    // Extract attributes
    const hrefMatch = linkTag.match(/href=["']([^"']*?)["']/i);
    const sizesMatch = linkTag.match(/sizes=["']([^"']*?)["']/i);
    const typeMatch = linkTag.match(/type=["']([^"']*?)["']/i);

    if (hrefMatch) {
      faviconLinks.push({
        rel,
        href: hrefMatch[1],
        sizes: sizesMatch ? sizesMatch[1] : null,
        type: typeMatch ? typeMatch[1] : null
      });
    }
  }

  return faviconLinks;
};

/**
 * Copy favicon file from source to destination
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {boolean} Success status
 */
const copyFaviconFile = (sourcePath, destPath) => {
  try {
    // Create destination directory if it doesn't exist
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy the file
    fs.copyFileSync(sourcePath, destPath);
    return true;
  } catch (error) {
    console.error(`Failed to copy ${sourcePath} to ${destPath}:`, error.message);
    return false;
  }
};

/**
 * Extract and copy all favicon files from old site
 * @param {string} oldSitePath - Path to old site root
 * @param {string} outputPath - Path to output favicon directory
 * @returns {Object} Results with successful, failed, and total counts
 */
const extractFavicons = (oldSitePath, outputPath) => {
  const results = {
    successful: 0,
    failed: 0,
    total: 0,
    files: []
  };

  console.log('Extracting favicons...');

  // Clean and prepare the favicon output directory
  prepDir(outputPath);

  // Find and read any HTML file to get favicon links
  const htmlFiles = fs.readdirSync(oldSitePath)
    .filter(file => file.endsWith('.html'));

  if (htmlFiles.length === 0) {
    console.log('⚠️  No HTML files found to extract favicon metadata');
    return results;
  }

  // Read first HTML file to get favicon links
  const htmlPath = path.join(oldSitePath, htmlFiles[0]);
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const faviconLinks = extractFaviconLinks(htmlContent);

  if (faviconLinks.length === 0) {
    console.log('⚠️  No favicon links found in HTML');
    return results;
  }

  // Process each favicon link
  for (const link of faviconLinks) {
    results.total++;

    // Resolve the source path (handle relative paths)
    const sourcePath = path.join(oldSitePath, link.href);

    // Get just the filename for destination
    const filename = path.basename(link.href);
    const destPath = path.join(outputPath, filename);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Favicon file not found: ${sourcePath}`);
      results.failed++;
      continue;
    }

    if (copyFaviconFile(sourcePath, destPath)) {
      results.successful++;
      results.files.push({
        filename,
        rel: link.rel,
        sizes: link.sizes,
        type: link.type,
        source: sourcePath,
        destination: destPath
      });
      console.log(`✓ Copied ${filename}`);
    } else {
      results.failed++;
    }
  }

  return results;
};

module.exports = {
  extractFaviconLinks,
  extractFavicons,
  copyFaviconFile
};
