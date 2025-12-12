#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { extractMetadata } = require('./importer/utils/metadata-extractor');

const root = path.resolve(__dirname, '..');
const oldSite = path.join(root, 'old_site');
const newSite = path.join(root, '_site');

// Directories/files to ignore in old site (non-content)
const IGNORE_PATHS = new Set([
  '/theme',
  '/Controls',
  '/userfiles',
  '/images',
  '/login',
  '/robots',
]);

// Patterns to ignore
const IGNORE_PATTERNS = [
  /^\/news\/\d+$/, // Pagination pages like /news/2, /news/4
];

// Build the site if needed
const skipBuild = process.argv.includes('--skip-build');

if (!skipBuild) {
  console.log('Building site...\n');

  // Remove _site if it exists
  if (fs.existsSync(newSite)) {
    fs.rmSync(newSite, { recursive: true, force: true });
  }

  execSync('node scripts/build.js', { cwd: root, stdio: 'inherit' });
  console.log('\n');
} else {
  console.log('Skipping build (--skip-build flag)\n');
}

// Check if _site exists
if (!fs.existsSync(newSite)) {
  console.error('Error: _site directory does not exist after build.');
  process.exit(1);
}

// Extract paths from old site .html files
// The old site was wget'd - original URLs had trailing slashes, files are now .html
function getOldSitePaths() {
  const paths = [];

  function walkDir(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(prefix, entry.name);

      if (entry.isDirectory()) {
        // Skip ignored directories
        const dirPath = '/' + prefix.replace(/\\/g, '/');
        if (IGNORE_PATHS.has(dirPath) || IGNORE_PATHS.has('/' + entry.name)) {
          continue;
        }
        walkDir(fullPath, relativePath);
      } else if (entry.name.endsWith('.html')) {
        // Convert path/to/page.html -> /path/to/page
        const pathName = entry.name.replace('.html', '');
        let urlPath;
        
        if (prefix) {
          urlPath = '/' + path.join(prefix, pathName).replace(/\\/g, '/');
        } else {
          urlPath = '/' + pathName;
        }
        
        // Skip ignored paths
        if (IGNORE_PATHS.has(urlPath)) {
          continue;
        }
        
        // Skip pagination and other patterns
        if (IGNORE_PATTERNS.some(pattern => pattern.test(urlPath))) {
          continue;
        }
        
        paths.push(urlPath);
      }
    }
  }

  walkDir(oldSite);
  return paths.sort();
}

// Check if an HTML file is a redirect page and return the destination
function getRedirectDestination(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    return null;
  }
  
  const content = fs.readFileSync(htmlPath, 'utf-8');
  
  // Check for meta refresh redirect pattern
  const metaRefreshMatch = content.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']0;\s*url=([^"']+)["']/i);
  if (metaRefreshMatch) {
    return metaRefreshMatch[1].replace(/\/$/, '') || '/';
  }
  
  // Check for canonical link in redirect pages
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (canonicalMatch && content.includes('Redirecting')) {
    return canonicalMatch[1].replace(/\/$/, '') || '/';
  }
  
  return null;
}

// Extract paths from new site, also building a redirect map
function getNewSitePaths() {
  const paths = [];
  const redirects = new Map(); // Maps: from path -> to path

  function walkDir(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip nested _site directories
      if (entry.name === '_site') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Check if this directory has an index.html
        const indexPath = path.join(fullPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          const urlPath = '/' + path.join(prefix, entry.name).replace(/\\/g, '/');
          
          // Check if this is a redirect page
          const redirectDest = getRedirectDestination(indexPath);
          if (redirectDest) {
            redirects.set(urlPath, redirectDest);
          } else {
            paths.push(urlPath);
          }
        }
        walkDir(fullPath, path.join(prefix, entry.name));
      }
    }
  }

  // Check for root index.html
  if (fs.existsSync(path.join(newSite, 'index.html'))) {
    paths.push('/');
  }

  walkDir(newSite);
  return { paths: paths.sort(), redirects };
}

// Normalize path for comparison
function normalizePath(p) {
  return p.replace(/\/$/, '') || '/';
}

// Map old paths to new paths (for paths that moved/restructured)
function mapOldToNew(oldPath) {
  // Homepage
  if (oldPath === '/index') {
    return '/';
  }
  
  // News index -> /blog
  if (oldPath === '/news') {
    return '/blog';
  }
  
  // Category pages with products (numeric ID in path)
  // e.g., /category/arcade-games/47/prize-crane -> /products/prize-crane
  if (oldPath.startsWith('/category/')) {
    const rest = oldPath.replace('/category/', '');
    const parts = rest.split('/');
    if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
      // This is a product: /category/arcade-games/47/prize-crane -> /products/prize-crane
      return '/products/' + parts[parts.length - 1];
    }
    // Category index pages: /category/arcade-games -> /categories/arcade-games
    if (parts.length === 1) {
      return '/categories/' + parts[0];
    }
    return oldPath;
  }
  
  // News posts -> /blog/slug (blog in new site)
  // e.g., /news/2024-09-04/best-office-christmas-party-games -> /blog/best-office-christmas-party-games
  if (oldPath.startsWith('/news/')) {
    const parts = oldPath.split('/');
    if (parts.length >= 4) {
      // Has date folder: /news/YYYY-MM-DD/slug -> /blog/slug
      return '/blog/' + parts[parts.length - 1];
    }
    return oldPath;
  }
  
  // Pages stay at /pages/ in new site
  // e.g., /pages/about-corporate-entertainment-hire -> /pages/about-corporate-entertainment-hire
  if (oldPath.startsWith('/pages/')) {
    return oldPath; // No change needed
  }
  
  // Old site top-level category-like pages
  // /corporate-entertainment -> /categories/corporate-entertainment
  // /exhibition-games -> /categories/exhibition-games
  // /interactive-game-hire -> /categories/interactive-game-hire
  // /fun-days -> /categories/fun-days
  const categoryPages = [
    'corporate-entertainment',
    'exhibition-games', 
    'interactive-game-hire',
    'fun-days',
  ];
  
  const pageName = oldPath.substring(1); // Remove leading /
  if (categoryPages.includes(pageName)) {
    return '/categories/' + pageName;
  }
  
  // Root-level product paths with numeric prefix (e.g., /exhibition-games/36/ballnado-grabber)
  // These are non-standard paths in old site that should map to /products/
  const rootCategoryMatch = oldPath.match(/^\/(exhibition-games|interactive-game-hire|corporate-entertainment|fun-days)\/(\d+)\/(.+)$/);
  if (rootCategoryMatch) {
    return '/products/' + rootCategoryMatch[3];
  }
  
  // Products at root level -> /products/
  // e.g., /batak-lite -> /products/batak-lite
  const rootProducts = [
    'batak-lite',
    'batak-pro',
    'prize-crane-arcade-grabber',
    'whack-a-mole-game-hire',
    'crack-the-code-safe-cracker',
    'ballnado-grabber',
    'prize-wheel',
  ];
  
  if (rootProducts.includes(pageName)) {
    return '/products/' + pageName;
  }
  
  // 43/batak-pro (old product URL format at root with numeric prefix)
  if (/^\/\d+\//.test(oldPath)) {
    const parts = oldPath.split('/');
    return '/products/' + parts[parts.length - 1];
  }

  return oldPath;
}

// Extract headings from HTML content (H1-H3 only)
function extractHeadings(htmlContent, isBlogPost = false) {
  const headings = [];
  const headingRegex = /<(h[1-3])[^>]*>(.*?)<\/\1>/gi;
  let match;

  while ((match = headingRegex.exec(htmlContent)) !== null) {
    const level = match[1].toLowerCase();
    const text = match[2]
      .replace(/<[^>]+>/g, '') // Remove any HTML tags inside
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      headings.push({ level, text });
    }
  }

  // For old blog posts with no H1, check if there's an H4 breadcrumb we should treat as H1
  if (isBlogPost && headings.length === 0) {
    const h4Regex = /<h4[^>]*>(.*?)<\/h4>/gi;
    let h4Match;
    while ((h4Match = h4Regex.exec(htmlContent)) !== null) {
      const text = h4Match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      // Skip footer contact headings
      if (text !== 'Contact MyAlarm Security' && text) {
        headings.push({ level: 'h1', text });
        break; // Only take the first H4 as the title
      }
    }
  }

  return headings;
}

// Get the file path for an old site URL
function getOldSiteFilePath(urlPath) {
  // Handle various path formats
  if (urlPath === '/') {
    return path.join(oldSite, 'index.html');
  }
  
  // Try direct path first: /fun-days -> old_site/fun-days.html
  const directPath = path.join(oldSite, urlPath.substring(1) + '.html');
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  
  // Try as directory with index: would need index.html but wget doesn't save that way
  return directPath;
}

// Extract metadata from old site HTML file
function getOldSiteMetadata(urlPath) {
  const filePath = getOldSiteFilePath(urlPath);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const htmlContent = fs.readFileSync(filePath, 'utf-8');
  const metadata = extractMetadata(htmlContent);
  const isBlogPost = urlPath.startsWith('/news/') && urlPath !== '/news';
  metadata.headings = extractHeadings(htmlContent, isBlogPost);
  return metadata;
}

// Extract metadata from new site HTML file
function getNewSiteMetadata(urlPath) {
  const htmlPath = urlPath === '/' ? path.join(newSite, 'index.html') : path.join(newSite, urlPath.substring(1), 'index.html');

  if (!fs.existsSync(htmlPath)) {
    return null;
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  // Extract title
  const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract meta description
  const descMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].trim() : null;

  return {
    title: title,
    meta_description: description,
    headings: extractHeadings(htmlContent)
  };
}

// Normalize metadata value for comparison
function normalizeMetaValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return value.trim();
}

// Compare headings arrays
function compareHeadings(oldHeadings, newHeadings) {
  const differences = [];

  // Check if lengths match
  if (oldHeadings.length !== newHeadings.length) {
    differences.push({
      type: 'count',
      old: oldHeadings.length,
      new: newHeadings.length
    });
  }

  // Compare each heading
  const maxLength = Math.max(oldHeadings.length, newHeadings.length);
  for (let i = 0; i < maxLength; i++) {
    const oldH = oldHeadings[i];
    const newH = newHeadings[i];

    if (!oldH && newH) {
      differences.push({
        type: 'added',
        index: i,
        heading: `${newH.level}: "${newH.text}"`
      });
    } else if (oldH && !newH) {
      differences.push({
        type: 'removed',
        index: i,
        heading: `${oldH.level}: "${oldH.text}"`
      });
    } else if (oldH && newH) {
      if (oldH.level !== newH.level || oldH.text !== newH.text) {
        differences.push({
          type: 'changed',
          index: i,
          old: `${oldH.level}: "${oldH.text}"`,
          new: `${newH.level}: "${newH.text}"`
        });
      }
    }
  }

  return differences;
}

// Compare metadata between old and new site
function compareMetadata(oldPath, newPath) {
  const oldMeta = getOldSiteMetadata(oldPath);
  const newMeta = getNewSiteMetadata(newPath);

  if (!oldMeta || !newMeta) {
    return { match: false, reason: 'missing_metadata' };
  }

  const mismatches = [];

  // Compare title
  const oldTitle = normalizeMetaValue(oldMeta.title);
  const newTitle = normalizeMetaValue(newMeta.title);
  if (oldTitle !== newTitle) {
    mismatches.push({
      field: 'title',
      old: oldTitle,
      new: newTitle
    });
  }

  // Compare meta description
  const oldDesc = normalizeMetaValue(oldMeta.meta_description);
  const newDesc = normalizeMetaValue(newMeta.meta_description);
  if (oldDesc !== newDesc) {
    mismatches.push({
      field: 'meta_description',
      old: oldDesc,
      new: newDesc
    });
  }

  // Compare headings
  const headingDiffs = compareHeadings(oldMeta.headings || [], newMeta.headings || []);
  if (headingDiffs.length > 0) {
    mismatches.push({
      field: 'headings',
      differences: headingDiffs
    });
  }

  return {
    match: mismatches.length === 0,
    mismatches: mismatches
  };
}

// Compare paths
console.log('='.repeat(80));
console.log('PATH COMPARISON REPORT');
console.log('='.repeat(80));
console.log();

const oldPaths = getOldSitePaths();
const { paths: newPaths, redirects: newSiteRedirects } = getNewSitePaths();

console.log(`Old site paths (*.html): ${oldPaths.length}`);
console.log(`New site paths (directories with index.html): ${newPaths.length}`);
console.log(`Redirect pages in new site: ${newSiteRedirects.size}`);
console.log();

// Create lookup sets
const oldPathsSet = new Set(oldPaths.map(normalizePath));
const newPathsSet = new Set(newPaths.map(normalizePath));

// Find matches and missing
const matched = [];
const missing = [];
const moved = [];
const redirected = []; // Paths that have redirect pages
const metadataMismatches = [];

for (const oldPath of oldPaths) {
  const normalized = normalizePath(oldPath);
  const mapped = mapOldToNew(oldPath);

  if (newPathsSet.has(normalized)) {
    matched.push(oldPath);

    // Check metadata
    const metaComparison = compareMetadata(oldPath, oldPath);
    if (!metaComparison.match && metaComparison.mismatches) {
      metadataMismatches.push({
        path: oldPath,
        mismatches: metaComparison.mismatches
      });
    }
  } else if (newSiteRedirects.has(normalized)) {
    // There's a redirect page for this old path
    const redirectDest = newSiteRedirects.get(normalized);
    redirected.push({ old: oldPath, redirectTo: redirectDest });
  } else if (mapped !== oldPath && newPathsSet.has(normalizePath(mapped))) {
    moved.push({ old: oldPath, new: mapped });

    // Check metadata for moved paths
    const metaComparison = compareMetadata(oldPath, mapped);
    if (!metaComparison.match && metaComparison.mismatches) {
      metadataMismatches.push({
        path: `${oldPath} => ${mapped}`,
        mismatches: metaComparison.mismatches
      });
    }
  } else if (mapped !== oldPath && newSiteRedirects.has(normalizePath(mapped))) {
    // The mapped path has a redirect
    const redirectDest = newSiteRedirects.get(normalizePath(mapped));
    redirected.push({ old: oldPath, redirectTo: redirectDest, viaMapped: mapped });
  } else {
    missing.push({ old: oldPath, mapped: mapped !== oldPath ? mapped : null });
  }
}

// Find new paths that don't exist in old site
const newOnly = [];
const movedPaths = new Set(moved.map(m => normalizePath(m.new)));
const redirectedFromPaths = new Set(redirected.map(r => normalizePath(r.old)));

for (const newPath of newPaths) {
  const normalized = normalizePath(newPath);
  if (!oldPathsSet.has(normalized) && !movedPaths.has(normalized)) {
    newOnly.push(newPath);
  }
}

// Print summary
const totalAccounted = matched.length + moved.length + redirected.length;
console.log('SUMMARY');
console.log('-'.repeat(80));
console.log(`✓ Exact matches: ${matched.length}/${oldPaths.length}`);
console.log(`→ Moved/renamed: ${moved.length}/${oldPaths.length}`);
console.log(`↪ Redirected: ${redirected.length}/${oldPaths.length}`);
console.log(`✓ Total accounted: ${totalAccounted}/${oldPaths.length} (${Math.round(totalAccounted / oldPaths.length * 100)}%)`);
console.log(`✗ Missing paths: ${missing.length}`);
console.log(`+ New paths only: ${newOnly.length}`);
console.log(`⚠ Metadata mismatches: ${metadataMismatches.length}`);
console.log();

// Print matched paths
if (matched.length > 0) {
  console.log('EXACT MATCHES');
  console.log('-'.repeat(80));
  matched.forEach(p => console.log(`  ✓ ${p}`));
  console.log();
}

// Print moved paths
if (moved.length > 0) {
  console.log('MOVED/RENAMED PATHS');
  console.log('-'.repeat(80));
  moved.forEach(m => console.log(`  → ${m.old} => ${m.new}`));
  console.log();
}

// Print redirected paths
if (redirected.length > 0) {
  console.log('REDIRECTED PATHS (old path has redirect page in new site)');
  console.log('-'.repeat(80));
  redirected.forEach(r => {
    if (r.viaMapped) {
      console.log(`  ↪ ${r.old} => ${r.viaMapped} => ${r.redirectTo}`);
    } else {
      console.log(`  ↪ ${r.old} => ${r.redirectTo}`);
    }
  });
  console.log();
}

// Print missing paths
if (missing.length > 0) {
  console.log('MISSING PATHS (in old site but not new site)');
  console.log('-'.repeat(80));
  missing.forEach(item => {
    if (item.mapped) {
      console.log(`  ✗ ${item.old} (tried mapping to: ${item.mapped})`);
    } else {
      console.log(`  ✗ ${item.old}`);
    }
  });
  console.log();
}

// Print new-only paths
if (newOnly.length > 0) {
  console.log('NEW PATHS (in new site but not old site)');
  console.log('-'.repeat(80));
  newOnly.forEach(p => console.log(`  + ${p}`));
  console.log();
}

// Print metadata mismatches
if (metadataMismatches.length > 0) {
  console.log('METADATA MISMATCHES');
  console.log('-'.repeat(80));
  metadataMismatches.forEach(item => {
    console.log(`  ⚠ ${item.path}`);
    item.mismatches.forEach(mismatch => {
      if (mismatch.field === 'headings') {
        console.log(`    ${mismatch.field}:`);
        mismatch.differences.forEach(diff => {
          if (diff.type === 'count') {
            console.log(`      COUNT: ${diff.old} headings → ${diff.new} headings`);
          } else if (diff.type === 'added') {
            console.log(`      ADDED [${diff.index}]: ${diff.heading}`);
          } else if (diff.type === 'removed') {
            console.log(`      REMOVED [${diff.index}]: ${diff.heading}`);
          } else if (diff.type === 'changed') {
            console.log(`      CHANGED [${diff.index}]:`);
            console.log(`        OLD: ${diff.old}`);
            console.log(`        NEW: ${diff.new}`);
          }
        });
      } else {
        console.log(`    ${mismatch.field}:`);
        console.log(`      OLD: ${mismatch.old === null ? '(empty)' : `"${mismatch.old}"`}`);
        console.log(`      NEW: ${mismatch.new === null ? '(empty)' : `"${mismatch.new}"`}`);
      }
    });
    console.log();
  });
}

console.log('='.repeat(80));

// Exit with error if there are missing paths or metadata mismatches
if (missing.length > 0 || metadataMismatches.length > 0) {
  const errors = [];
  if (missing.length > 0) {
    errors.push(`${missing.length} paths from old site are missing in new site`);
  }
  if (metadataMismatches.length > 0) {
    errors.push(`${metadataMismatches.length} pages have metadata mismatches`);
  }
  console.log(`\n⚠ ${errors.join(' and ')}`);
  process.exit(1);
} else {
  console.log('\n✓ All old site paths are present in new site with matching metadata!');
  process.exit(0);
}
