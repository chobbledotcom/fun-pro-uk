/**
 * Post-processing link fixer
 * 
 * Runs AFTER all content is imported. Fixes all internal links and validates
 * that every link points to a known destination.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Build a set of all valid internal URL destinations
 */
const buildValidDestinations = () => {
  const destinations = new Set();
  
  const patterns = {
    products: (slug) => `/products/${slug}/`,
    categories: (slug) => `/categories/${slug}/`,
    pages: (slug) => `/${slug}/`,  // Pages live at root
    events: (slug) => `/events/${slug}/`,
    news: (slug) => `/news/${slug}/`,
    reviews: (slug) => `/reviews/${slug}/`,
  };
  
  for (const [dir, pattern] of Object.entries(patterns)) {
    const dirPath = path.join(config.OUTPUT_BASE, dir);
    if (!fs.existsSync(dirPath)) continue;
    
    for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.md'))) {
      let slug = file.replace(/\.md$/, '');
      const dateMatch = slug.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
      if (dateMatch) slug = dateMatch[1];
      destinations.add(pattern(slug));
    }
  }
  
  // Locations (nested)
  const locDir = path.join(config.OUTPUT_BASE, 'locations');
  if (fs.existsSync(locDir)) {
    for (const entry of fs.readdirSync(locDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        destinations.add(`/locations/${entry.name.replace('.md', '')}/`);
      } else if (entry.isDirectory()) {
        destinations.add(`/locations/${entry.name}/`);
        const subDir = path.join(locDir, entry.name);
        for (const f of fs.readdirSync(subDir).filter(f => f.endsWith('.md'))) {
          destinations.add(`/locations/${entry.name}/${f.replace('.md', '')}/`);
        }
      }
    }
  }
  
  // Static pages
  destinations.add('/');
  destinations.add('/blog/');
  destinations.add('/reviews/');
  
  return destinations;
};

/**
 * Build redirect map from all markdown files' redirect_from entries
 */
const buildRedirectMap = () => {
  const map = new Map();
  const dirs = ['products', 'categories', 'pages', 'events', 'news', 'locations'];
  
  const scan = (dirPath, urlBase) => {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath, `${urlBase}/${entry.name}`);
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        let slug = entry.name.replace('.md', '');
        const dateMatch = slug.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
        if (dateMatch) slug = dateMatch[1];
        
        const newUrl = `${urlBase}/${slug}/`;
        const match = content.match(/redirect_from:\s*\n((?:\s*-\s*"[^"]+"\n)+)/);
        if (match) {
          for (const m of match[1].matchAll(/-\s*"([^"]+)"/g)) {
            let oldUrl = m[1];
            if (!oldUrl.startsWith('/')) oldUrl = '/' + oldUrl;
            if (!oldUrl.endsWith('/')) oldUrl += '/';
            map.set(oldUrl, newUrl);
          }
        }
      }
    }
  };
  
  for (const dir of dirs) {
    // Pages live at root level, everything else uses /dir/
    const urlBase = dir === 'pages' ? '' : `/${dir}`;
    scan(path.join(config.OUTPUT_BASE, dir), urlBase);
  }
  
  return map;
};

/**
 * Resolve relative path against a base path
 */
const resolvePath = (relative, base) => {
  const baseDir = base.replace(/\/[^/]+\/?$/, '');
  const segments = baseDir.split('/').filter(Boolean);
  
  for (const part of relative.split('/')) {
    if (part === '..') segments.pop();
    else if (part && part !== '.') segments.push(part);
  }
  
  return '/' + segments.join('/') + '/';
};

/**
 * Extract all redirect_from URLs from content (these are the source contexts)
 */
const getSourcePaths = (content) => {
  const match = content.match(/redirect_from:\s*\n((?:\s*-\s*"[^"]+"\n)+)/);
  if (!match) return [];
  return [...match[1].matchAll(/-\s*"([^"]+)"/g)].map(m => m[1]);
};

/**
 * Fix all links in a single file
 */
const fixFileLinks = (filePath, redirectMap, validDests) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const sourcePaths = getSourcePaths(content);
  const currentSlug = path.basename(filePath, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const errors = [];
  
  // More robust regex that handles titles with parentheses
  // Matches: [text](url) or [text](url "title") or [text](url "title with (parens)")
  content = content.replace(/\[([^\]]*)\]\(([^"\s)]+(?:\s+"[^"]*")?)\)/g, (match, text, target) => {
    // Strip title attribute (including ones with parentheses)
    target = target.replace(/\s+"[^"]*"$/, '');
    
    // Extract anchor
    let anchor = '';
    const anchorMatch = target.match(/^(.+?)#(.*)$/);
    if (anchorMatch) {
      target = anchorMatch[1];
      anchor = anchorMatch[2];
    }
    
    // Skip external, mailto, tel, pure anchors, empty
    if (!target || target.startsWith('#') || target.startsWith('http') ||
        target.startsWith('mailto:') || target.startsWith('tel:')) {
      return match;
    }
    
    // Strip .html and sanitize
    if (target.endsWith('.html')) target = target.slice(0, -5);
    target = target.replace(/['']/g, '');  // Remove apostrophes
    
    // Check for self-reference
    const targetSlug = target.split('/').pop();
    if (targetSlug === currentSlug) {
      // Self-referential - keep only meaningful anchors
      if (anchor && !['specification', 'footercontact'].includes(anchor.toLowerCase()) &&
          !anchor.includes(':~:text=')) {
        const cleanAnchor = anchor.toLowerCase() === 'bodycontent' ? 'content' : anchor;
        return `[${text}](#${cleanAnchor})`;
      }
      return text; // Just the text, no link
    }
    
    // Try to resolve the URL
    let resolved = null;
    
    if (target.startsWith('/')) {
      // Already absolute
      resolved = target.endsWith('/') ? target : target + '/';
    } else {
      // Relative - try resolving against each source path
      for (const src of sourcePaths) {
        const attempt = resolvePath(target, src);
        if (redirectMap.has(attempt) || validDests.has(attempt)) {
          resolved = attempt;
          break;
        }
      }
      // Fallback: just make it absolute
      if (!resolved) {
        resolved = '/' + target.replace(/^(?:\.\.\/|\.\/)+/, '');
        if (!resolved.endsWith('/')) resolved += '/';
      }
    }
    
    // Map through redirects
    if (redirectMap.has(resolved)) {
      resolved = redirectMap.get(resolved);
    }
    
    // Validate and try to fix unknown URLs
    if (!validDests.has(resolved)) {
      // Skip obviously broken legacy URLs - just remove the link
      if (resolved.includes('/userfiles/') || resolved.includes('/Controls/') ||
          resolved.includes('.aspx') || resolved.includes('.ashx') ||
          resolved.includes('/theme/')) {
        return text; // Return just the text, no link
      }
      
      // Try common prefixes: maybe it's a page, product, or location without prefix
      let slug = resolved.replace(/^\//, '').replace(/\/$/, '');
      
      // Handle news links that might have date prefix
      // /news/2024-12-05-slug/ or /2024-12-05/slug/ -> /news/slug/
      const newsDateMatch = slug.match(/^(?:news\/)?(\d{4}-\d{2}-\d{2})[-\/](.+)$/);
      if (newsDateMatch) {
        slug = newsDateMatch[2];
      }
      
      // If slug contains a slash, might be category/product - try just the last part
      const lastPart = slug.includes('/') ? slug.split('/').pop() : slug;
      
      const tryPaths = [
        `/products/${lastPart}/`,  // Most common: category/product -> /products/product/
        `/${slug}/`,  // Pages live at root
        `/categories/${slug}/`,  // Categories
        `/products/${slug}/`,
        `/locations/${slug}/`,
        `/events/${slug}/`,
        `/news/${slug}/`,  // Try news without date
        `/${lastPart}/`,  // Try last part at root (for pages)
        `/categories/${lastPart}/`,
        `/locations/${lastPart}/`,
      ];
      
      let found = false;
      for (const tryPath of tryPaths) {
        if (validDests.has(tryPath)) {
          resolved = tryPath;
          found = true;
          break;
        }
      }
      
      // Also try the redirect map with common prefixes
      if (!found) {
        for (const prefix of ['/category', '/pages']) {
          const withPrefix = `${prefix}${resolved}`;
          if (redirectMap.has(withPrefix)) {
            resolved = redirectMap.get(withPrefix);
            found = true;
            break;
          }
        }
      }
      
      // Strip /category/ prefix if present and check again
      if (!found && resolved.startsWith('/category/')) {
        const withoutCat = resolved.replace('/category/', '/');
        if (validDests.has(withoutCat)) {
          resolved = withoutCat;
          found = true;
        }
      }
      
      if (!found) {
        errors.push(`Invalid link: ${resolved} (from "${match}")`);
      }
    }
    
    // Rebuild link
    let finalTarget = resolved;
    if (anchor && !['specification', 'footercontact'].includes(anchor.toLowerCase()) &&
        !anchor.includes(':~:text=')) {
      const cleanAnchor = anchor.toLowerCase() === 'bodycontent' ? 'content' : anchor;
      finalTarget += '#' + cleanAnchor;
    }
    
    return `[${text}](${finalTarget})`;
  });
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
  }
  
  return errors;
};

/**
 * Fix all links across all content
 */
const fixAllLinks = () => {
  console.log('Building valid destinations...');
  const validDests = buildValidDestinations();
  console.log(`  Found ${validDests.size} valid destinations`);
  
  console.log('Building redirect map...');
  const redirectMap = buildRedirectMap();
  console.log(`  Found ${redirectMap.size} redirects`);
  
  const allErrors = [];
  const dirs = ['products', 'categories', 'pages', 'events', 'news', 'locations'];
  
  const processDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) processDir(full);
      else if (entry.name.endsWith('.md')) {
        const errs = fixFileLinks(full, redirectMap, validDests);
        if (errs.length) {
          console.log(`  ${path.relative(config.OUTPUT_BASE, full)}:`);
          errs.forEach(e => console.log(`    ${e}`));
        }
        allErrors.push(...errs.map(e => `${full}: ${e}`));
      }
    }
  };
  
  console.log('Fixing links...');
  for (const d of dirs) processDir(path.join(config.OUTPUT_BASE, d));
  
  if (allErrors.length > 0) {
    console.error(`\n❌ Found ${allErrors.length} invalid links`);
    throw new Error(`Link validation failed with ${allErrors.length} errors`);
  }
  
  console.log('✓ All links valid');
};

module.exports = { fixAllLinks, buildValidDestinations, buildRedirectMap };
