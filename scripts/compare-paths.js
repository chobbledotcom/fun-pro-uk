#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { extractMetadata } = require('./importer/utils/metadata-extractor');

const root = path.resolve(__dirname, '..');
const oldSite = path.join(root, 'old_site');
const newSite = path.join(root, '_site');

// Clean and build the site
console.log('Building site...\n');

// Remove _site if it exists
if (fs.existsSync(newSite)) {
  fs.rmSync(newSite, { recursive: true, force: true });
}

try {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  console.log('\n');
} catch (error) {
  console.error('Build failed!');
  process.exit(1);
}

// Check if _site exists
if (!fs.existsSync(newSite)) {
  console.error('Error: _site directory does not exist after build.');
  process.exit(1);
}

// Extract path from old site .php.html files
function getOldSitePaths() {
  const paths = [];

  function walkDir(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath, path.join(prefix, entry.name));
      } else if (entry.name.endsWith('.php.html')) {
        // Convert blog.php.html -> /blog
        // Convert blog/some-post.php.html -> /blog/some-post
        const pathName = entry.name.replace('.php.html', '');
        const urlPath = '/' + path.join(prefix, pathName).replace(/\\/g, '/');
        paths.push(urlPath);
      }
    }
  }

  walkDir(oldSite);
  return paths.sort();
}

// Extract paths from new site
function getNewSitePaths() {
  const paths = [];

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
          paths.push(urlPath);
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
  return paths.sort();
}

// Normalize path for comparison
function normalizePath(p) {
  return p.replace(/\/$/, '') || '/';
}

// Map old paths to new paths (for paths that moved)
function mapOldToNew(oldPath) {
  // Blog posts moved to news
  if (oldPath.startsWith('/blog/')) {
    return oldPath.replace('/blog/', '/news/');
  }

  // Contact moved to pages/contact
  if (oldPath === '/contact') {
    return '/pages/contact';
  }

  // Reviews moved to pages/reviews
  if (oldPath === '/reviews') {
    return '/pages/reviews';
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

// Extract metadata from old site HTML file
function getOldSiteMetadata(urlPath) {
  const phpFileName = urlPath === '/' ? 'index.php.html' : urlPath.substring(1) + '.php.html';
  const filePath = path.join(oldSite, phpFileName);

  try {
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const metadata = extractMetadata(htmlContent);
    const isBlogPost = urlPath.startsWith('/blog/') && urlPath !== '/blog';
    metadata.headings = extractHeadings(htmlContent, isBlogPost);
    return metadata;
  } catch (error) {
    return null;
  }
}

// Extract metadata from new site HTML file
function getNewSiteMetadata(urlPath) {
  const htmlPath = urlPath === '/' ? path.join(newSite, 'index.html') : path.join(newSite, urlPath.substring(1), 'index.html');

  try {
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
  } catch (error) {
    return null;
  }
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
const newPaths = getNewSitePaths();

console.log(`Old site paths (*.php.html): ${oldPaths.length}`);
console.log(`New site paths (directories with index.html): ${newPaths.length}`);
console.log();

// Create lookup sets
const oldPathsSet = new Set(oldPaths.map(normalizePath));
const newPathsSet = new Set(newPaths.map(normalizePath));

// Find matches and missing
const matched = [];
const missing = [];
const moved = [];
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
  } else {
    missing.push(oldPath);
  }
}

// Find new paths that don't exist in old site
const newOnly = [];
const movedPaths = new Set(moved.map(m => normalizePath(m.new)));

for (const newPath of newPaths) {
  const normalized = normalizePath(newPath);
  if (!oldPathsSet.has(normalized) && !movedPaths.has(normalized)) {
    newOnly.push(newPath);
  }
}

// Print summary
const totalAccounted = matched.length + moved.length;
console.log('SUMMARY');
console.log('-'.repeat(80));
console.log(`✓ Exact matches: ${matched.length}/${oldPaths.length}`);
console.log(`→ Moved/renamed: ${moved.length}/${oldPaths.length}`);
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

// Print missing paths
if (missing.length > 0) {
  console.log('MISSING PATHS (in old site but not new site)');
  console.log('-'.repeat(80));
  missing.forEach(p => console.log(`  ✗ ${p}`));
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
