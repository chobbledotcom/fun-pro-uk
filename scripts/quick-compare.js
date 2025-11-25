#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const root = process.cwd();
const oldSite = path.join(root, 'old_site');
const newSite = path.join(root, '_site');

const IGNORE_PATHS = new Set(['/theme', '/Controls', '/userfiles', '/images', '/login', '/robots']);
const IGNORE_PATTERNS = [/^\/news\/\d+$/];

function getOldSitePaths() {
  const paths = [];
  function walkDir(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        const dirPath = '/' + prefix.replace(/\\/g, '/');
        if (IGNORE_PATHS.has(dirPath) || IGNORE_PATHS.has('/' + entry.name)) continue;
        walkDir(fullPath, relativePath);
      } else if (entry.name.endsWith('.html')) {
        const pathName = entry.name.replace('.html', '');
        let urlPath = prefix ? '/' + path.join(prefix, pathName).replace(/\\/g, '/') : '/' + pathName;
        if (IGNORE_PATHS.has(urlPath)) continue;
        if (IGNORE_PATTERNS.some(p => p.test(urlPath))) continue;
        paths.push(urlPath);
      }
    }
  }
  walkDir(oldSite);
  return paths.sort();
}

function getNewSitePaths() {
  const paths = [];
  function walkDir(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '_site') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const indexPath = path.join(fullPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          const urlPath = '/' + path.join(prefix, entry.name).replace(/\\/g, '/');
          paths.push(urlPath);
        }
        walkDir(fullPath, path.join(prefix, entry.name));
      }
    }
  }
  if (fs.existsSync(path.join(newSite, 'index.html'))) paths.push('/');
  walkDir(newSite);
  return paths.sort();
}

function mapOldToNew(oldPath) {
  if (oldPath === '/index') return '/';
  
  // Category product pages: /category/arcade-games/47/prize-crane -> /products/prize-crane
  if (oldPath.startsWith('/category/')) {
    const rest = oldPath.replace('/category/', '');
    const parts = rest.split('/');
    if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
      return '/products/' + parts[parts.length - 1];
    }
    // Category index pages stay the same
    return oldPath;
  }
  
  // News posts: /news/2024-09-04/slug -> /blog/slug
  if (oldPath.startsWith('/news/')) {
    const parts = oldPath.split('/');
    if (parts.length >= 4) return '/blog/' + parts[parts.length - 1];
    if (oldPath === '/news') return '/blog';
    return oldPath;
  }
  
  // Pages stay at /pages/
  if (oldPath.startsWith('/pages/')) return oldPath;
  
  // Root-level category pages
  const categoryPages = ['corporate-entertainment', 'exhibition-games', 'interactive-game-hire', 'fun-days'];
  const pageName = oldPath.substring(1);
  if (categoryPages.includes(pageName)) return '/category/' + pageName;
  
  // Root-level product pages
  const rootProducts = ['batak-lite', 'batak-pro', 'prize-crane-arcade-grabber', 'whack-a-mole-game-hire', 'crack-the-code-safe-cracker', 'ballnado-grabber', 'prize-wheel'];
  if (rootProducts.includes(pageName)) return '/products/' + pageName;
  
  // Old numeric product URLs: /43/batak-pro -> /products/batak-pro
  if (/^\/\d+\//.test(oldPath)) {
    const parts = oldPath.split('/');
    return '/products/' + parts[parts.length - 1];
  }
  
  return oldPath;
}

const oldPaths = getOldSitePaths();
const newPaths = getNewSitePaths();
const newPathsSet = new Set(newPaths);

console.log('='.repeat(80));
console.log('PATH COMPARISON REPORT');
console.log('='.repeat(80));
console.log('');
console.log('Old site paths:', oldPaths.length);
console.log('New site paths:', newPaths.length);
console.log('');

const matched = [], moved = [], missing = [];
for (const oldPath of oldPaths) {
  const mapped = mapOldToNew(oldPath);
  if (newPathsSet.has(oldPath)) {
    matched.push(oldPath);
  } else if (mapped !== oldPath && newPathsSet.has(mapped)) {
    moved.push({ old: oldPath, new: mapped });
  } else {
    missing.push({ old: oldPath, mapped: mapped !== oldPath ? mapped : null });
  }
}

// Find new-only paths
const oldPathsSet = new Set(oldPaths);
const movedNewPaths = new Set(moved.map(m => m.new));
const newOnly = newPaths.filter(p => !oldPathsSet.has(p) && !movedNewPaths.has(p));

const totalAccounted = matched.length + moved.length;
console.log('SUMMARY');
console.log('-'.repeat(80));
console.log(`✓ Exact matches: ${matched.length}/${oldPaths.length}`);
console.log(`→ Moved/renamed: ${moved.length}/${oldPaths.length}`);
console.log(`✓ Total accounted: ${totalAccounted}/${oldPaths.length} (${Math.round(totalAccounted / oldPaths.length * 100)}%)`);
console.log(`✗ Missing paths: ${missing.length}`);
console.log(`+ New paths only: ${newOnly.length}`);
console.log('');

if (matched.length > 0 && matched.length <= 50) {
  console.log('EXACT MATCHES');
  console.log('-'.repeat(80));
  matched.forEach(p => console.log(`  ✓ ${p}`));
  console.log('');
}

if (moved.length > 0) {
  console.log('MOVED/RENAMED PATHS');
  console.log('-'.repeat(80));
  moved.forEach(m => console.log(`  → ${m.old} => ${m.new}`));
  console.log('');
}

if (missing.length > 0) {
  console.log('MISSING PATHS (in old site but not new site)');
  console.log('-'.repeat(80));
  missing.forEach(m => {
    if (m.mapped) console.log(`  ✗ ${m.old} (tried: ${m.mapped})`);
    else console.log(`  ✗ ${m.old}`);
  });
  console.log('');
}

if (newOnly.length > 0 && newOnly.length <= 100) {
  console.log('NEW PATHS (in new site but not old site)');
  console.log('-'.repeat(80));
  newOnly.forEach(p => console.log(`  + ${p}`));
  console.log('');
}

console.log('='.repeat(80));

if (missing.length > 0) {
  console.log(`\n⚠ ${missing.length} paths from old site are missing in new site`);
  process.exit(1);
} else {
  console.log('\n✓ All old site paths are accounted for in new site!');
  process.exit(0);
}
