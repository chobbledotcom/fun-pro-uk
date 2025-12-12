const fs = require('fs');
const path = require('path');
const { FIND_REPLACES } = require('../constants');
const config = require('../config');

/**
 * Build a mapping of redirect_from URLs to their new permalinks
 * Scans all markdown files and extracts redirect_from values from frontmatter
 * @returns {Object} Map of old URL -> new permalink
 */
const buildRedirectMap = () => {
  const redirectMap = {};
  
  // Directories to scan for redirect_from entries
  const contentDirs = ['products', 'news', 'events', 'locations', 'pages', 'categories'];
  
  for (const dir of contentDirs) {
    const dirPath = path.join(config.OUTPUT_BASE, dir);
    if (!fs.existsSync(dirPath)) continue;
    
    scanDirectoryForRedirects(dirPath, dir, redirectMap);
  }
  
  return redirectMap;
};

/**
 * Recursively scan a directory for markdown files with redirect_from
 * @param {string} dirPath - Directory to scan
 * @param {string} baseDir - Base directory name (e.g., 'products', 'news')
 * @param {Object} redirectMap - Map to populate
 */
const scanDirectoryForRedirects = (dirPath, baseDir, redirectMap) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      // For nested directories like locations/birmingham/, pass the subdir info
      const subDir = path.join(baseDir, entry.name);
      scanDirectoryForRedirects(fullPath, subDir, redirectMap);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      extractRedirectsFromFile(fullPath, baseDir, entry.name, redirectMap);
    }
  }
};

/**
 * Extract redirect_from values and calculate permalink for a markdown file
 * @param {string} filePath - Path to markdown file
 * @param {string} baseDir - Base directory (e.g., 'products', 'locations/birmingham')
 * @param {string} fileName - File name
 * @param {Object} redirectMap - Map to populate
 */
const extractRedirectsFromFile = (filePath, baseDir, fileName, redirectMap) => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return;
  
  const frontmatterText = frontmatterMatch[1];
  
  // Extract redirect_from entries using regex
  // Matches patterns like:
  //   redirect_from:
  //     - "/old/url/"
  //     - "/another/url/"
  const redirectMatch = frontmatterText.match(/redirect_from:\s*\n((?:\s*-\s*"[^"]+"\n)+)/);
  if (!redirectMatch) return;
  
  // Extract individual URLs from the redirect_from block
  const urlMatches = redirectMatch[1].matchAll(/^\s*-\s*"([^"]+)"/gm);
  const redirectUrls = [...urlMatches].map(m => m[1]);
  
  if (redirectUrls.length === 0) return;
  
  // Calculate the new permalink based on file path
  const slug = fileName.replace(/\.md$/, '');
  let newPermalink;
  
  // Check for explicit permalink in frontmatter first
  const permalinkMatch = frontmatterText.match(/^permalink:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (permalinkMatch) {
    newPermalink = permalinkMatch[1].trim();
  } else {
    // Calculate from directory structure
    // baseDir can be 'products', 'news', 'locations/birmingham', etc.
    newPermalink = `/${baseDir}/${slug}/`;
  }
  
  // Normalize permalink (ensure leading/trailing slashes)
  if (!newPermalink.startsWith('/')) newPermalink = '/' + newPermalink;
  if (!newPermalink.endsWith('/')) newPermalink += '/';
  
  // Map each redirect_from URL to the new permalink
  for (const oldUrl of redirectUrls) {
    // Normalize old URL
    let normalizedOldUrl = oldUrl;
    if (!normalizedOldUrl.startsWith('/')) normalizedOldUrl = '/' + normalizedOldUrl;
    if (!normalizedOldUrl.endsWith('/')) normalizedOldUrl += '/';
    
    redirectMap[normalizedOldUrl] = newPermalink;
  }
};

/**
 * Replace old redirect URLs with new permalinks in content
 * @param {string} content - Markdown content
 * @param {Object} redirectMap - Map of old URL -> new permalink
 * @returns {string} Content with replaced URLs
 */
const replaceRedirectUrls = (content, redirectMap) => {
  let result = content;
  
  // Sort by URL length descending to match longer URLs first
  // (prevents partial matches, e.g., /category/fun-days/ before /category/)
  const sortedUrls = Object.keys(redirectMap).sort((a, b) => b.length - a.length);
  
  for (const oldUrl of sortedUrls) {
    const newUrl = redirectMap[oldUrl];
    
    // Skip if old URL equals new URL (no replacement needed)
    if (oldUrl === newUrl) continue;
    
    // Replace in markdown links: [text](old-url) or [text](old-url#anchor)
    // Also handles cases without trailing slash
    const oldUrlNoSlash = oldUrl.replace(/\/$/, '');
    
    // Match the URL in markdown link context, preserving any anchors
    const patterns = [
      // With trailing slash
      { search: `](${oldUrl})`, replace: `](${newUrl})` },
      { search: `](${oldUrl}#`, replace: `](${newUrl}#` },
      // Without trailing slash  
      { search: `](${oldUrlNoSlash})`, replace: `](${newUrl.replace(/\/$/, '')})` },
      { search: `](${oldUrlNoSlash}#`, replace: `](${newUrl.replace(/\/$/, '')}#` },
    ];
    
    for (const { search, replace } of patterns) {
      if (result.includes(search)) {
        result = result.replaceAll(search, replace);
      }
    }
  }
  
  return result;
};

/**
 * Strip blog footer cruft that gets imported from the old site
 * Removes the "Return to news", "What our customers are saying", etc. section
 * @param {string} content - Markdown content
 * @returns {string} Content with cruft removed
 */
const stripBlogFooterCruft = (content) => {
  // Pattern matches the cruft block at the end of blog posts:
  // [<< Return to news](...) - optional
  // ## What our customers are saying…
  // [Load More Reviews](...)
  // Happy customers we have worked along side
  return content.replace(
    /\n*(?:\[<< Return to news\][^\n]*\n+)?## What our customers are saying…\n+\[Load More Reviews\][^\n]*\n+Happy customers we have worked along side\s*$/,
    ''
  );
};

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
 * Remove empty links (result of stripping self-referential URLs)
 * Converts [text]() to just text, and []() to nothing
 * @param {string} content - Markdown content
 * @returns {string} Content with empty links removed
 */
const stripEmptyLinks = (content) => {
  // First handle empty links with text: [text]() -> text
  let result = content.replace(/\[([^\]]+)\]\(\)/g, '$1');
  // Then handle completely empty links: []() -> (nothing)
  result = result.replace(/\[\]\(\)/g, '');
  return result;
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
 * Resolve a relative path against a base path
 * @param {string} relativePath - The relative path (e.g., "../32/product")
 * @param {string} basePath - The base path (e.g., "fun-days/19/human-table-football")
 * @returns {string} Resolved absolute path (e.g., "/category/fun-days/32/product/")
 */
const resolveRelativePath = (relativePath, basePath) => {
  // Split base path into segments, removing the filename
  const baseSegments = basePath.split('/').slice(0, -1);
  
  // Process the relative path
  const relSegments = relativePath.split('/');
  const resultSegments = [...baseSegments];
  
  for (const segment of relSegments) {
    if (segment === '..') {
      resultSegments.pop();
    } else if (segment !== '.' && segment !== '') {
      resultSegments.push(segment);
    }
  }
  
  // Return with /category/ prefix and trailing slash
  return '/category/' + resultSegments.join('/') + '/';
};

/**
 * Fix .html extensions in markdown links, replacing with trailing slash URLs
 * Also converts relative paths to absolute, normalizes anchors, and strips titles
 * @param {string} content - Markdown content
 * @param {string} sourcePath - Optional source file path for resolving relative links
 *                              (e.g., "fun-days/19/human-table-football.html")
 * @returns {string} Content with fixed links
 */
const fixHtmlLinks = (content, sourcePath = null) => {
  // Extract current filename from source path for self-reference detection
  const currentFilename = sourcePath 
    ? sourcePath.split('/').pop().replace('.html', '')
    : null;
  
  // Match markdown links with .html extension, optionally with #anchor and/or "title"
  // Patterns handled:
  //   [text](path.html)
  //   [text](path.html#anchor)
  //   [text](path.html "title")
  //   [text](path.html#anchor "title")
  return content.replace(
    /\]\(([^)#"\s]+)\.html(?:#([^)"\s]*))?\s*(?:"[^"]*")?\)/g,
    (match, urlPath, anchor) => {
      // Extract the target filename (without path and extension)
      const targetFilename = urlPath.split('/').pop();
      
      // Check if this is a self-referential link (same file)
      if (currentFilename && targetFilename === currentFilename) {
        // Self-referential link - strip URL, keep only anchor if meaningful
        if (anchor && anchor.toLowerCase() !== 'specification' && anchor !== '') {
          // Has a meaningful anchor
          if (anchor.toLowerCase() === 'bodycontent') {
            return '](#content)';
          }
          return `](#${anchor})`;
        }
        // No anchor or skipped anchor - return empty link target
        // These empty anchors will be cleaned up later or the link text will stand alone
        return ']()';
      }
      
      // Not self-referential - resolve the path
      let cleanPath = urlPath;
      
      if (sourcePath && (cleanPath.startsWith('../') || cleanPath.startsWith('./'))) {
        // Resolve relative path against source path
        cleanPath = resolveRelativePath(cleanPath, sourcePath);
      } else if (cleanPath.startsWith('../') || cleanPath.startsWith('./')) {
        // No source path available - strip leading ../ and ./ (fallback)
        cleanPath = cleanPath.replace(/^(?:\.\.\/|\.\/)+/, '/');
        // Ensure path starts with /
        if (!cleanPath.startsWith('/')) {
          cleanPath = '/' + cleanPath;
        }
        // Add trailing slash
        if (!cleanPath.endsWith('/')) {
          cleanPath = cleanPath + '/';
        }
      } else {
        // Absolute or simple filename
        if (!cleanPath.startsWith('/') && !cleanPath.startsWith('http')) {
          cleanPath = '/' + cleanPath;
        }
        if (!cleanPath.endsWith('/')) {
          cleanPath = cleanPath + '/';
        }
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
 * @param {Object} redirectMap - Optional map of old URL -> new permalink
 */
const applyFindReplaces = (filePath, redirectMap = null) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // First, fix .html links with regex (handles titles)
  content = fixHtmlLinks(content);

  // Strip title attributes from all remaining links/images
  content = stripLinkTitles(content);

  // Strip blog footer cruft (Return to news, reviews section, etc.)
  content = stripBlogFooterCruft(content);

  // Apply each find/replace pattern
  for (const [search, replace] of Object.entries(FIND_REPLACES)) {
    if (content.includes(search)) {
      content = content.replaceAll(search, replace);
    }
  }

  // Replace redirect_from URLs with new permalinks
  if (redirectMap) {
    content = replaceRedirectUrls(content, redirectMap);
  }

  // Only write if modifications were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
};

/**
 * Apply find/replace patterns to all markdown files in a directory
 * @param {string} dirPath - Directory to process
 * @param {Object} redirectMap - Optional map of old URL -> new permalink
 */
const applyFindReplacesRecursive = (dirPath, redirectMap = null) => {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      applyFindReplacesRecursive(fullPath, redirectMap);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      applyFindReplaces(fullPath, redirectMap);
    }
  }
};

module.exports = {
  fixHtmlLinks,
  stripLinkTitles,
  stripEmptyLinks,
  stripBlogFooterCruft,
  fixRelativePaths,
  applyFindReplaces,
  applyFindReplacesRecursive,
  buildRedirectMap,
  replaceRedirectUrls
};
