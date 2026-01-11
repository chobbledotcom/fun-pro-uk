const fs = require('fs');
const path = require('path');

/**
 * Navigation Extractor
 * Programmatically extracts navigation structure from HTML by detecting
 * the pattern of nested LI and UL elements (dropdown menus).
 * Uses regex patterns to avoid additional dependencies.
 */

/**
 * Extract text content from HTML, stripping tags
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
const stripHtmlTags = (html) => {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

/**
 * Extract navigation structure from HTML
 * Looks for nested UL elements inside LI elements to detect dropdown menus
 * @param {string} htmlPath - Path to HTML file (usually index.html)
 * @returns {Object} Navigation structure
 */
const extractNavigationFromHtml = (htmlPath) => {
  if (!fs.existsSync(htmlPath)) {
    console.warn(`Navigation source not found: ${htmlPath}`);
    return { items: [], dropdowns: {}, slugToParent: {} };
  }

  const html = fs.readFileSync(htmlPath, 'utf8');

  const navigation = {
    items: [],        // Top-level nav items in order
    dropdowns: {},    // Map of parent key -> array of child slugs
    slugToParent: {}, // Reverse map: slug -> parent key (for quick lookup)
    topLevelLinks: {}, // Map of slug -> { key, order } for non-dropdown top-level items
  };

  // Find the main navigation list - look for toplinks__ul class
  const navListMatch = html.match(/<ul\s+class=["'][^"']*toplinks__ul[^"']*["'][^>]*>([\s\S]*?)<\/ul>\s*<\/nav>/i);
  
  if (!navListMatch) {
    console.warn('Could not find main navigation list (toplinks__ul)');
    return navigation;
  }

  const navListHtml = navListMatch[1];

  // Parse top-level LI elements
  // We need to be careful to only get direct children, not nested LI elements
  // Strategy: find each top-level LI by looking for <li class="toplinks__li">
  const topLevelLiRegex = /<li\s+class=["'][^"']*toplinks__li[^"']*["'][^>]*>([\s\S]*?)(?=<li\s+class=["'][^"']*toplinks__li|$)/gi;
  
  let liMatch;
  let navIndex = 0;
  
  while ((liMatch = topLevelLiRegex.exec(navListHtml)) !== null) {
    const liContent = liMatch[1];

    // Get the first anchor tag (the main nav link)
    const anchorMatch = liContent.match(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/i);
    if (!anchorMatch) continue;

    const anchorAttrs = anchorMatch[1];
    // Extract link text (remove caret tags)
    const linkText = stripHtmlTags(anchorMatch[2]).replace(/\s+/g, ' ').trim();
    if (!linkText || linkText === 'Home') continue; // Skip Home

    // Extract href from anchor attributes
    const hrefMatch = anchorAttrs.match(/href=["']([^"'#]+)/i);
    const href = hrefMatch ? hrefMatch[1] : null;

    // Check if this LI contains a nested dropdown-menu UL
    const dropdownMatch = liContent.match(/<ul\s+class=["'][^"']*dropdown-menu[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
    const isDropdown = !!dropdownMatch;

    const navItem = {
      key: linkText,
      order: navIndex + 1,
      isDropdown,
      href,
    };

    navigation.items.push(navItem);

    // For non-dropdown items, extract the slug and store in topLevelLinks
    if (!isDropdown && href) {
      const slug = extractSlugFromHref(href);
      if (slug) {
        navigation.topLevelLinks[slug] = {
          key: linkText,
          order: navIndex + 1,
          href,
        };
      }
    }

    // If this is a dropdown, extract all children
    if (isDropdown && dropdownMatch) {
      navigation.dropdowns[linkText] = [];

      const dropdownHtml = dropdownMatch[1];
      
      // Find all dropdown items
      const dropdownItemRegex = /<li[^>]*>\s*<a\s+[^>]*href=["']([^"'#]*)["'][^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;
      
      let itemMatch;
      let childIndex = 0;
      
      while ((itemMatch = dropdownItemRegex.exec(dropdownHtml)) !== null) {
        const childHref = itemMatch[1];
        const childText = stripHtmlTags(itemMatch[2]).trim();
        const childSlug = extractSlugFromHref(childHref);

        if (childSlug) {
          childIndex++;
          const childInfo = {
            slug: childSlug,
            text: childText,
            href: childHref,
            order: childIndex,
            type: detectContentType(childHref),
          };

          navigation.dropdowns[linkText].push(childInfo);
          navigation.slugToParent[childSlug] = linkText;
        }
      }
    }

    navIndex++;
  }

  return navigation;
};

/**
 * Extract slug from href
 * @param {string} href - The href attribute value
 * @returns {string|null} The extracted slug
 */
const extractSlugFromHref = (href) => {
  if (!href || href === '#' || href.startsWith('#')) return null;

  // Remove hash fragments
  href = href.split('#')[0];

  // Handle various URL patterns
  // pages/some-page.html -> some-page
  // category/some-category.html -> some-category
  // category/arcade-games/2/lights-out-game.html -> arcade-games
  // some-page.html -> some-page

  // For category URLs like category/arcade-games/2/lights-out-game.html
  // or category/some-category.html
  // We want the category slug (arcade-games or some-category)
  const categoryMatch = href.match(/category\/([^/.]+)/);
  if (categoryMatch) {
    return categoryMatch[1];
  }

  // For pages like pages/some-page.html
  const pagesMatch = href.match(/pages\/([^/.]+)(?:\.html?)?$/);
  if (pagesMatch) {
    return pagesMatch[1];
  }

  // For Controls/category paths (e.g., Controls/category/batak.html)
  const controlsCategoryMatch = href.match(/Controls\/category\/([^/.]+)/);
  if (controlsCategoryMatch) {
    return controlsCategoryMatch[1];
  }

  // Extract filename without extension for root-level pages
  const match = href.match(/([^/.]+)\.html?$/);
  if (match) {
    return match[1];
  }

  return null;
};

/**
 * Detect content type from href
 * @param {string} href - The href attribute value
 * @returns {string} Content type: 'page', 'category', 'product', or 'other'
 */
const detectContentType = (href) => {
  if (!href) return 'other';
  if (href.includes('/pages/')) return 'page';
  if (href.includes('/category/')) return 'category';
  if (href.includes('/products/')) return 'product';
  if (href.match(/^[^/]+\.html$/)) return 'page'; // Root-level pages
  return 'other';
};

/**
 * Convert a navigation key to a slug format for comparison
 * @param {string} key - Navigation key (e.g., "Event Type", "How We Help")
 * @returns {string} Slugified version (e.g., "event-type", "how-we-help")
 */
const slugifyKey = (key) => {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Get navigation info for a specific slug using the new NAVIGATION_STRUCTURE
 * @param {Object} navigation - Navigation structure (ignored, kept for compatibility)
 * @param {string} slug - The content slug
 * @returns {Object|null} Navigation info with parent and order, or null
 */
const getNavigationForSlug = (navigation, slug) => {
  const { NAVIGATION_STRUCTURE, OLD_SLUG_TO_NEW } = require('../constants');

  // Map old slug to new slug if needed
  const actualSlug = OLD_SLUG_TO_NEW[slug] || slug;

  // Check if this slug is a top-level dropdown parent (e.g., "events" matches "Event Type")
  // Note: Special handling for event-type -> events rename
  if (actualSlug === 'event-type' || actualSlug === 'events') {
    const topLevelItem = NAVIGATION_STRUCTURE.topLevel.find(item => item.key === "Event Type");
    if (topLevelItem) {
      return {
        parent: null,
        parentOrder: null,
        order: topLevelItem.order,
        text: topLevelItem.key,
        type: 'page',
        isTopLevel: true,
        isDropdownParent: true,
      };
    }
  }

  // Search all dropdowns for this slug
  for (const [parentKey, children] of Object.entries(NAVIGATION_STRUCTURE.dropdowns)) {
    const child = children.find(c => c.slug === actualSlug);
    if (child) {
      // Find the parent's order in the top-level navigation
      const parentItem = NAVIGATION_STRUCTURE.topLevel.find(item => item.key === parentKey);
      const parentOrder = parentItem ? parentItem.order : 1;

      return {
        parent: parentKey,
        parentOrder,
        order: child.order,
        text: child.text,
        type: child.type,
        isTopLevel: false,
      };
    }
  }

  return null;
};

/**
 * Extract and cache navigation from old site
 * @param {string} oldSitePath - Path to old site directory
 * @returns {Object} Navigation structure
 */
let cachedNavigation = null;

const getNavigation = (oldSitePath) => {
  if (cachedNavigation) return cachedNavigation;

  const indexPath = path.join(oldSitePath, 'index.html');
  cachedNavigation = extractNavigationFromHtml(indexPath);

  // Log extracted navigation for debugging
  const dropdownCount = Object.keys(cachedNavigation.dropdowns).length;
  const itemCount = Object.keys(cachedNavigation.slugToParent).length;
  const topLevelCount = Object.keys(cachedNavigation.topLevelLinks).length;
  console.log(`  Extracted navigation: ${dropdownCount} dropdowns, ${itemCount} dropdown items, ${topLevelCount} top-level links`);

  return cachedNavigation;
};

/**
 * Clear cached navigation (useful for testing)
 */
const clearNavigationCache = () => {
  cachedNavigation = null;
};

module.exports = {
  extractNavigationFromHtml,
  extractSlugFromHref,
  detectContentType,
  getNavigationForSlug,
  getNavigation,
  clearNavigationCache,
};
