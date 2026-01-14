const { patterns, faqPatterns, extract } = require('./html-patterns');
const { htmlToMarkdown } = require('./pandoc-converter');

/**
 * Clean FAQ text - for questions, strip HTML; for answers, convert to markdown
 * @param {string} text - Text to clean
 * @param {boolean} isAnswer - Whether this is an answer (uses turndown for markdown conversion)
 * @returns {string} Cleaned text
 */
const cleanFaqText = (text, isAnswer = false) => {
  if (isAnswer) {
    // Use turndown to properly convert HTML to markdown
    return htmlToMarkdown(text);
  }
  
  // For questions, just decode entities and strip tags
  return text
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/g, '£')
    .replace(/&hellip;/g, '...')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extract FAQs from HTML content
 * Looks for FAQ sections marked by h2 headings containing "FAQ" or "Frequently Asked"
 * Parses question/answer pairs from multiple formats:
 * - Format 1: <p><strong>Question?</strong><br />Answer</p>
 * - Format 2: <h3>Question?</h3><p>Answer</p>
 * @param {string} htmlContent - HTML content to extract FAQs from
 * @returns {Array<Object>} Array of FAQ objects with question and answer
 */
const extractFAQs = (htmlContent) => {
  const faqs = [];
  
  // Use shared pattern from html-patterns.js
  const faqSectionRegex = new RegExp(faqPatterns.htmlSection.source, faqPatterns.htmlSection.flags);
  
  let sectionMatch;
  while ((sectionMatch = faqSectionRegex.exec(htmlContent)) !== null) {
    const faqSection = sectionMatch[1];
    
    // Try Format 1: <p><strong>Question?</strong><br />Answer</p>
    const qaRegex1 = new RegExp(faqPatterns.htmlQAPairFormat1.source, faqPatterns.htmlQAPairFormat1.flags);
    let qaMatch;
    while ((qaMatch = qaRegex1.exec(faqSection)) !== null) {
      const question = cleanFaqText(qaMatch[1].trim(), false);
      const answer = cleanFaqText(qaMatch[2].trim(), true);
      
      if (question && answer) {
        faqs.push({ question, answer });
      }
    }
    
    // Try Format 2: <h3>Question?</h3><p>Answer</p>
    const qaRegex2 = new RegExp(faqPatterns.htmlQAPairFormat2.source, faqPatterns.htmlQAPairFormat2.flags);
    while ((qaMatch = qaRegex2.exec(faqSection)) !== null) {
      const question = cleanFaqText(qaMatch[1].trim(), false);
      const answer = cleanFaqText(qaMatch[2].trim(), true);
      
      if (question && answer) {
        faqs.push({ question, answer });
      }
    }
  }
  
  return faqs;
};

/**
 * Extract breadcrumb text from HTML content
 * @param {string} htmlContent - HTML content to extract breadcrumb from
 * @returns {string|null} Extracted breadcrumb text or null
 */
const extractBreadcrumbText = (htmlContent) => {
  const breadcrumbMatch = htmlContent.match(/<li\s+class=["']breadcrumb-item\s+active["']>([^<]+)<\/li>/i);
  return breadcrumbMatch ? breadcrumbMatch[1].trim() : null;
};

/**
 * Extract the main H1 heading from content
 * For blog posts, prefers the anchor title attribute (clean title without date prefix)
 * @param {string} htmlContent - HTML content to extract H1 from
 * @returns {string|null} Extracted H1 text or null
 */
const extractContentHeading = (htmlContent) => {
  // Find the main content H1 (not in header/footer/nav)
  const h1Match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (h1Match) {
    const h1Content = h1Match[1];

    // For blog posts, the clean title is often in the anchor's title attribute
    // e.g., <h1><a title="Clean Title Here">Date - Clean Title Here</a></h1>
    const anchorTitleMatch = h1Content.match(/<a[^>]*\stitle=["']([^"']+)["'][^>]*>/i);
    if (anchorTitleMatch) {
      return anchorTitleMatch[1]
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&pound;/g, '£')
        .trim();
    }

    // Fallback: extract text content from H1
    return h1Content
      .replace(/<[^>]+>/g, '') // Remove any HTML tags inside
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&pound;/g, '£')
      .trim();
  }
  return null;
};



/**
 * Extract metadata from HTML content using regex patterns
 * @param {string} htmlContent - HTML content to extract metadata from
 * @returns {Object} Extracted metadata
 */
const extractMetadata = (htmlContent) => {
  const metadata = {};

  const title = extract(htmlContent, patterns.title);
  if (title) {
    metadata.title = title;
  }

  const description = extract(htmlContent, patterns.metaTag('description'));
  if (description) {
    metadata.meta_description = description;
  }

  const canonical = extract(htmlContent, patterns.linkRel('canonical'));
  if (canonical) {
    const urlPath = canonical.replace(/^.*?\/([^\/]+\.php).*$/, '$1').replace('.php', '');
    metadata.permalink = `/${urlPath}/`;
  }

  // Extract header text: prefer breadcrumb over og:title for cleaner names
  const breadcrumbText = extractBreadcrumbText(htmlContent);
  if (breadcrumbText) {
    metadata.header_text = breadcrumbText;
  } else {
    // Fallback to og:title
    const ogTitle = extract(htmlContent, patterns.metaProperty('og:title'));
    if (ogTitle) {
      metadata.header_text = ogTitle;
    }
  }

  return metadata;
};

/**
 * Extract price from HTML content
 * Looks for hire price in the pricing table - specifically the first price cell
 * which represents the base/1-day hire price (labeled "Hire from" or similar)
 * @param {string} htmlContent - HTML content to extract price from
 * @returns {string} Extracted price with currency symbol
 */
const extractPrice = (htmlContent) => {
  // Look for the "Hire Prices:" section followed by a table
  // The first <td> in the table contains the base hire price
  // Note: &pound; and the number may be separated by closing tags like </span>
  const hirePricesMatch = htmlContent.match(/Hire [Pp]rices:?<\/\w+>[\s\S]*?<table[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?&pound;(?:<[^>]*>)*([\d,]+)/);
  if (hirePricesMatch) {
    return `£${hirePricesMatch[1].replace(/,/g, '')}`;
  }

  // Alternative: look for "Hire from" label in a table cell followed by price
  // This catches cases where the table structure varies slightly
  const hireFromMatch = htmlContent.match(/<td[^>]*>[\s\S]*?(?:Hire from|hire from)[\s\S]*?&pound;(?:<[^>]*>)*([\d,]+)/i);
  if (hireFromMatch) {
    return `£${hireFromMatch[1].replace(/,/g, '')}`;
  }

  return '';
};

/**
 * Extract multi-day hire prices from HTML content
 * Looks for pricing table cells with "X day hire" labels
 * @param {string} htmlContent - HTML content to extract prices from
 * @returns {Object} Object with price_2_days, price_3_days, price_7_days etc.
 */
const extractMultiDayPrices = (htmlContent) => {
  const prices = {};

  // Pattern to match "X day hire from" followed by price
  // Handles variations like "2 day hire from", "2 Day hire from", "7 day hire From"
  // Price format: &pound;XXX or £XXX with possible span tags in between
  const dayPricePatterns = [
    { key: 'price_2_days', regex: /2\s*day\s*hire\s*(?:from)?[\s\S]*?(?:&pound;|£)(?:<[^>]*>)*\s*([\d,]+)/i },
    { key: 'price_3_days', regex: /3\s*day\s*hire\s*(?:from)?[\s\S]*?(?:&pound;|£)(?:<[^>]*>)*\s*([\d,]+)/i },
    { key: 'price_4_days', regex: /4\s*day\s*hire\s*(?:from)?[\s\S]*?(?:&pound;|£)(?:<[^>]*>)*\s*([\d,]+)/i },
    { key: 'price_5_days', regex: /5\s*day\s*hire\s*(?:from)?[\s\S]*?(?:&pound;|£)(?:<[^>]*>)*\s*([\d,]+)/i },
    { key: 'price_7_days', regex: /7\s*day\s*hire\s*(?:from)?[\s\S]*?(?:&pound;|£)(?:<[^>]*>)*\s*([\d,]+)/i },
  ];

  for (const { key, regex } of dayPricePatterns) {
    const match = htmlContent.match(regex);
    if (match) {
      prices[key] = `£${match[1].replace(/,/g, '')}`;
    }
  }

  return prices;
};

/**
 * Helper to extract a spec value from HTML table
 * @param {string} htmlContent - HTML content
 * @param {RegExp} labelPattern - Pattern to match the label cell
 * @returns {string|null} Extracted and cleaned value or null
 */
const extractSpecValue = (htmlContent, labelPattern) => {
  const match = htmlContent.match(labelPattern);
  if (match) {
    const value = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return value || null;
  }
  return null;
};

/**
 * Extract specifications from HTML specification tables
 * Looks for tables with "Space required", "Electric requirements", etc.
 * @param {string} htmlContent - HTML content to extract specs from
 * @returns {Object} Object with space_required, power, players, setup_time, equipment_size, suitability, access
 */
const extractSpecs = (htmlContent) => {
  const specs = {};

  // Extract Space Required from spec table
  const spaceValue = extractSpecValue(htmlContent,
    /<td[^>]*>[\s\S]*?<strong>Space required<\/strong>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (spaceValue) specs.space_required = spaceValue;

  // Extract Electric/Power requirements from spec table
  const powerValue = extractSpecValue(htmlContent,
    /<td[^>]*>[\s\S]*?<strong>(?:Electric requirements?|Power(?:\s+required)?)<\/strong>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (powerValue) specs.power = powerValue;

  // Extract Equipment size from spec table
  const equipmentValue = extractSpecValue(htmlContent,
    /<td[^>]*>[\s\S]*?<strong>Equipment size<\/strong>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (equipmentValue) specs.equipment_size = equipmentValue;

  // Extract Suitability from spec table
  const suitabilityValue = extractSpecValue(htmlContent,
    /<td[^>]*>[\s\S]*?<strong>Suitability<\/strong>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (suitabilityValue) specs.suitability = suitabilityValue;

  // Extract Access from spec table
  const accessValue = extractSpecValue(htmlContent,
    /<td[^>]*>[\s\S]*?<strong>Access<\/strong>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (accessValue) specs.access = accessValue;

  // Extract Players from description text
  // Handles various patterns: "2-8 players", "4 player", "up to four players", etc.
  const wordToNum = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'eleven': '11', 'twelve': '12'
  };

  // Try multiple patterns in order of specificity
  let playersValue = null;

  // Pattern 1: "X-Y players" or "X to Y players" (numeric)
  const rangeMatch = htmlContent.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)\s*players?/i);
  if (rangeMatch) {
    playersValue = `${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  // Pattern 2: "up to X players" with written numbers
  if (!playersValue) {
    const upToWordMatch = htmlContent.match(/up\s+to\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+players?/i);
    if (upToWordMatch) {
      const num = wordToNum[upToWordMatch[1].toLowerCase()];
      playersValue = `1-${num}`;
    }
  }

  // Pattern 3: "X player" standalone (numeric, including "4 player, 4 lane" style)
  if (!playersValue) {
    const singleNumMatch = htmlContent.match(/(\d+)\s*players?(?:\s|,|$)/i);
    if (singleNumMatch) {
      playersValue = singleNumMatch[1];
    }
  }

  // Pattern 4: Written number + players (e.g., "four players")
  if (!playersValue) {
    const wordMatch = htmlContent.match(/(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+players?/i);
    if (wordMatch) {
      playersValue = wordToNum[wordMatch[1].toLowerCase()];
    }
  }

  if (playersValue) {
    // Add "players" suffix for clarity
    specs.players = playersValue.includes('-') ? `${playersValue} players` : `${playersValue} players`;
  }

  // Extract Setup time from FAQ or description
  // Common patterns: "Setup typically takes around 30 minutes"
  const setupMatch = htmlContent.match(/(?:setup|set up)\s*(?:typically\s+)?(?:takes?\s+)?(?:around\s+)?(\d+\s*(?:minutes?|mins?|hours?))/i);
  if (setupMatch) {
    specs.setup_time = setupMatch[1].replace(/\s+/g, ' ').trim();
  }

  return specs;
};

/**
 * Extract category from breadcrumbs
 * @param {string} htmlContent - HTML content to extract category from
 * @returns {string} Extracted category
 */
const extractCategory = (htmlContent) => {
  // Try Fun Pro UK format - itemprop="category" meta tag
  const categoryMatch = htmlContent.match(/<meta\s+content=["']([^"']+)["']\s+itemprop=["']category["']/i);
  if (categoryMatch) {
    return categoryMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
  }

  // Try breadcrumb format
  const breadcrumbMatch = htmlContent.match(/<li class="breadcrumb-item"><a href="\.\.\/categories\/([^"]+)\.php\.html">/i);
  return breadcrumbMatch ? breadcrumbMatch[1] : '';
};

/**
 * Extract category name from active breadcrumb
 * @param {string} htmlContent - HTML content to extract category name from
 * @returns {string} Extracted category name
 */
const extractCategoryName = (htmlContent) => {
  return extractBreadcrumbText(htmlContent) || '';
};

/**
 * Extract product name from JSON-LD schema or breadcrumb
 * @param {string} htmlContent - HTML content to extract product name from
 * @returns {string} Extracted product name
 */
const extractProductName = (htmlContent) => {
  // Try DetailsTitle div (Fun Pro UK format)
  const detailsMatch = htmlContent.match(/<div class="DetailsTitle"[^>]*>\s*<h1>([^<]+)<\/h1>/i);
  if (detailsMatch) {
    return detailsMatch[1].trim();
  }

  // Try og:title meta tag
  const ogTitleMatch = htmlContent.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitleMatch) {
    return ogTitleMatch[1].trim().replace(/\s*\|.*$/, ''); // Remove anything after |
  }

  // Try JSON-LD schema
  const schemaMatch = htmlContent.match(/"@type":"Product","name":"([^"]+)"/i);
  if (schemaMatch) {
    return schemaMatch[1].replace(/&pound;/g, '£');
  }

  // Fallback to breadcrumb
  const breadcrumbText = extractBreadcrumbText(htmlContent);
  if (breadcrumbText) {
    return breadcrumbText.replace(/&pound;/g, '£');
  }

  return '';
};

/**
 * Extract blog post date from content
 * @param {string} content - Markdown content to extract date from
 * @param {string} defaultDate - Default date to use if none found
 * @returns {string} Date in YYYY-MM-DD format
 */
const extractBlogDate = (content, defaultDate = '2020-01-01') => {
  const dateMatch = content.match(/Posted Date:\s*(?:[A-Za-z]+,\s*)?(.+?)(?:\n|$|\\)/);
  if (dateMatch) {
    const dateStr = dateMatch[1].trim();

    // Parse date string directly without Date constructor to avoid timezone issues
    const monthNames = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    };

    // Format: "Month Day, Year" (e.g., "June 10, 2024")
    const match = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (match) {
      const month = monthNames[match[1].toLowerCase()];
      const day = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }
  return defaultDate;
};

/**
 * Extract reviews from product HTML
 * @param {string} htmlContent - HTML content to extract reviews from
 * @returns {Array<Object>} Array of review objects with name and body
 */
const extractReviews = (htmlContent) => {
  const reviews = [];
  const reviewTableMatch = htmlContent.match(/<div class="menu-heading[^>]*>Our Reviews!<\/div>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/);

  if (!reviewTableMatch) {
    return reviews;
  }

  const tableContent = reviewTableMatch[1];
  const rowRegex = /<tr>\s*<td>[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?<div class="diblock" itemprop="description">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<\/td>\s*<\/tr>/g;

  let match;
  while ((match = rowRegex.exec(tableContent)) !== null) {
    const name = match[1].trim();
    const body = match[2].trim().replace(/\s+/g, ' ');

    if (name && body) {
      reviews.push({ name, body });
    }
  }

  return reviews;
};

/**
 * Extract product images from HTML content
 * Extracts Cloudinary image IDs from product gallery areas (DetailsLeft or ThumbnailsRow)
 * @param {string} htmlContent - HTML content to extract images from
 * @returns {Object} Object with header_image and gallery array
 */
const extractProductImages = (htmlContent) => {
  const images = {
    header_image: '',
    gallery: []
  };

  const CLOUDINARY_BASE = 'https://bouncycastlenetwork-res.cloudinary.com/image/upload';

  // First, try to isolate the main product content area
  // Look for the product div that contains the actual product images
  // Products are in <div class="product ..."> which contains DetailsLeft or ThumbnailsRow
  let productContent = htmlContent;
  
  // Try to extract just the product div to avoid sidebar/footer images
  const productDivMatch = htmlContent.match(/<div class="product [^"]*"[^>]*itemscope[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="columns__homepage-aside/i);
  if (productDivMatch) {
    productContent = productDivMatch[1];
  } else {
    // Fallback: try to find DetailsLeft or ThumbnailsRow specifically
    const detailsLeftMatch = htmlContent.match(/<div class="DetailsLeft">([\s\S]*?)<\/div>\s*<div class="margin-top/i);
    const thumbnailsRowMatch = htmlContent.match(/<div class="ThumbnailsRow">([\s\S]*?)<\/div><div itemprop="description">/i);
    
    if (detailsLeftMatch) {
      productContent = detailsLeftMatch[1];
    } else if (thumbnailsRowMatch) {
      productContent = thumbnailsRowMatch[1];
    }
  }

  // Extract unique Cloudinary image IDs from data-public-image attributes
  const imageIds = new Set();
  
  // Method 1: Extract from data-public-image attributes in product content
  const dataPublicImageRegex = /data-public-image="([a-f0-9]{32})"/gi;
  let match;
  while ((match = dataPublicImageRegex.exec(productContent)) !== null) {
    imageIds.add(match[1]);
  }
  
  // Method 2: Extract from Cloudinary URLs in href attributes (backup)
  if (imageIds.size === 0) {
    const cloudinaryUrlRegex = /bouncycastlenetwork-res\.cloudinary\.com\/image\/upload\/[^"]*\/([a-f0-9]{32})/gi;
    while ((match = cloudinaryUrlRegex.exec(productContent)) !== null) {
      imageIds.add(match[1]);
    }
  }
  
  // Convert to array and build URLs
  const imageIdArray = Array.from(imageIds);
  images.gallery = imageIdArray.map(id => `${CLOUDINARY_BASE}/${id}`);
  images.header_image = images.gallery[0] || '';

  return images;
};

/**
 * Extract blog post image from markdown content
 * Skips tracking pixel URLs and prefers news content images
 * @param {string} markdown - Markdown content to extract image from
 * @returns {string} Image URL or empty string
 */
const extractBlogImage = (markdown) => {
  // Patterns that indicate tracking pixels (not real images)
  const trackingPixelPatterns = [
    'secure.cavy9soho.com',   // Analytics tracking pixel
    'facebook.com/tr',         // Facebook tracking pixel
    '/tr?',                    // Generic tracking pixel pattern
    'pixel.',                  // Generic pixel subdomain
    '&ev=',                    // Event tracking parameter
    'noscript='                // Noscript tracking parameter
  ];

  // Look for all images in markdown: ![alt text](url or path)
  const imageRegex = /!\[.*?\]\(([^\)]+)\)/g;
  let match;
  let fallbackImage = '';

  while ((match = imageRegex.exec(markdown)) !== null) {
    const url = match[1];

    // Skip tracking pixels
    const isTrackingPixel = trackingPixelPatterns.some(pattern => url.includes(pattern));
    if (isTrackingPixel) {
      continue;
    }

    // Skip theme/logo images
    if (url.includes('/theme/') || url.includes('logo')) {
      continue;
    }

    // Prefer news images - check for both /images/news/ (already downloaded)
    // and /userfiles/ (will be downloaded and converted to /images/news/)
    if (url.startsWith('/images/news/')) {
      return url;
    }

    // Convert /userfiles/ paths to /images/news/ paths
    // These will be downloaded by downloadNewsEmbeddedImages
    if (url.startsWith('/userfiles/')) {
      const filename = url.split('/').pop();
      return `/images/news/${filename}`;
    }

    // Keep track of first valid image as fallback
    if (!fallbackImage) {
      if (url.startsWith('/images/') || url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i)) {
        fallbackImage = url;
      }
    }
  }

  return fallbackImage;
};

/**
 * Extract product slugs from PageListings section
 * These are the "More Details" links that appear in category/event pages
 * @param {string} htmlContent - HTML content to extract product slugs from
 * @returns {Array<string>} Array of product slugs (e.g., ["batak-lite", "cash-grabber-machine-hire"])
 */
const extractPageListingProducts = (htmlContent) => {
  const products = [];
  
  // Find the PageListings section - it's a row div that contains product cards
  // The section ends at the next major div (photo-gallery, footer-contact, etc.)
  const pageListingsMatch = htmlContent.match(/<div id="PageListings"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/div>\s*<div id="ctl00_PhotoGallery|<\/div>\s*<\/div>\s*<\/div>\s*<div class="photo-gallery)/i);
  if (!pageListingsMatch) {
    return products;
  }
  
  const listingsContent = pageListingsMatch[1];
  
  // Extract product slugs from "More Details" links (castleCheckBook class)
  // Pattern: <a href="../category/exhibition-games/94/catch-it-reaction-ring-hire.html" class="castleCheckBook noBookButton"
  // Or: <a href="../crack-the-code-safe-cracker.html" class="castleCheckBook
  const linkRegex = /href="[^"]*\/([a-z0-9-]+)\.html"\s+class="castleCheckBook/gi;
  
  let match;
  while ((match = linkRegex.exec(listingsContent)) !== null) {
    const slug = match[1];
    // Avoid duplicates
    if (!products.includes(slug)) {
      products.push(slug);
    }
  }
  
  return products;
};

/**
 * Extract favicon links from HTML content
 * @param {string} htmlContent - HTML content to extract favicon links from
 * @returns {Array<Object>} Array of favicon link objects
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

module.exports = {
  extractBreadcrumbText,
  extractContentHeading,
  extractMetadata,
  extractPrice,
  extractMultiDayPrices,
  extractSpecs,
  extractCategory,
  extractCategoryName,
  extractProductName,
  extractBlogDate,
  extractReviews,
  extractProductImages,
  extractBlogImage,
  extractFaviconLinks,
  extractPageListingProducts,
  extractFAQs
};
