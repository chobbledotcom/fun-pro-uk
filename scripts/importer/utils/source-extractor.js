/**
 * Source Extractor Utility
 * 
 * Extracts common data from the old site's index.html to be used by various converters.
 * This centralizes source data extraction and eliminates hard-coded text.
 * 
 * No fallbacks are used - if data cannot be extracted, null is returned and
 * callers should throw an error if the data is required.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// Cache the extracted data to avoid re-reading the file
let cachedData = null;

/**
 * Extract all common data from the old site's index.html
 * @returns {Object} Extracted data
 */
const extractSourceData = () => {
  if (cachedData) return cachedData;
  
  const indexPath = path.join(config.OLD_SITE_PATH, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Source file not found: ${indexPath}`);
  }
  
  const html = fs.readFileSync(indexPath, 'utf8');
  
  // Extract title from <title> tag
  const titleMatch = html.match(/<title>\s*([^<]+)\s*<\/title>/i);
  const siteTitle = titleMatch ? titleMatch[1].trim() : null;
  
  // Extract meta description
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  const metaDescription = descMatch ? descMatch[1] : null;
  
  // Extract JSON-LD Organization schema
  let orgData = {};
  const orgSchemaMatch = html.match(/<script type="application\/ld\+json">\s*(\{[^}]*"@type":\s*"Organization"[\s\S]*?\})\s*<\/script>/);
  if (orgSchemaMatch) {
    try {
      orgData = JSON.parse(orgSchemaMatch[1]);
    } catch (e) {
      throw new Error(`Failed to parse Organization schema: ${e.message}`);
    }
  }
  
  // Extract JSON-LD LocalBusiness schema
  let localBusinessData = {};
  const localBusinessMatch = html.match(/<script type="application\/ld\+json">\s*(\{[^}]*"@type":\s*"LocalBusiness"[\s\S]*?\})\s*<\/script>/);
  if (localBusinessMatch) {
    try {
      localBusinessData = JSON.parse(localBusinessMatch[1]);
    } catch (e) {
      throw new Error(`Failed to parse LocalBusiness schema: ${e.message}`);
    }
  }
  
  // Extract social URLs from sameAs arrays
  const allSameAs = [...(orgData.sameAs || []), ...(localBusinessData.sameAs || [])];
  const socials = {
    facebook: allSameAs.find(u => u.includes('facebook.com')) || null,
    instagram: allSameAs.find(u => u.includes('instagram.com')) || null,
    twitter: allSameAs.find(u => u.includes('twitter.com')) || null,
    linkedin: allSameAs.find(u => u.includes('linkedin.com')) || null,
    tiktok: allSameAs.find(u => u.includes('tiktok.com')) || null,
  };
  
  // Extract organization name
  const orgName = orgData.name || localBusinessData.name || null;
  
  // Extract contact info
  const phone = localBusinessData.telephone || 
                (orgData.contactPoint && orgData.contactPoint.telephone) || null;
  
  // Extract email from header
  const emailMatch = html.match(/href="mailto:([^"]+)"/i);
  const email = emailMatch ? emailMatch[1] : null;
  
  // Extract reviews/testimonials heading
  const reviewsHeadingMatch = html.match(/<h2[^>]*>\s*What our customers are saying[^<]*<\/h2>/i);
  const reviewsHeading = reviewsHeadingMatch 
    ? reviewsHeadingMatch[0].replace(/<[^>]+>/g, '').replace(/&hellip;/g, '...').trim()
    : null;
  
  // Extract "Some of our popular products" heading
  const popularProductsMatch = html.match(/<h2[^>]*>[^<]*popular products[^<]*<\/h2>/i);
  const popularProductsHeading = popularProductsMatch
    ? popularProductsMatch[0].replace(/<[^>]+>/g, '').trim()
    : null;
  
  // Extract address from LocalBusiness schema
  const address = localBusinessData.address || {};
  
  // Extract aggregate rating if available
  const aggregateRating = localBusinessData.aggregateRating || null;
  
  cachedData = {
    siteTitle,
    metaDescription,
    orgName,
    socials,
    phone,
    email,
    reviewsHeading,
    popularProductsHeading,
    address: {
      streetAddress: address.streetAddress || null,
      addressLocality: address.addressLocality || null,
      addressRegion: address.addressRegion || null,
      postalCode: address.postalCode || null,
      addressCountry: address.addressCountry || null,
    },
    aggregateRating,
    // Derived values
    siteName: orgName ? orgName.replace(/ Ltd$/, '') : null,
    siteUrl: orgData.url || localBusinessData.url || null,
  };
  
  return cachedData;
};

/**
 * Clear the cached data (useful for testing)
 */
const clearCache = () => {
  cachedData = null;
};

/**
 * Get the site title
 * @returns {string|null}
 */
const getSiteTitle = () => {
  const data = extractSourceData();
  return data.siteTitle;
};

/**
 * Get the meta description
 * @returns {string|null}
 */
const getMetaDescription = () => {
  const data = extractSourceData();
  return data.metaDescription;
};

/**
 * Get the organization name
 * @returns {string|null}
 */
const getOrgName = () => {
  const data = extractSourceData();
  return data.orgName;
};

/**
 * Get the site name (org name without "Ltd")
 * @returns {string|null}
 */
const getSiteName = () => {
  const data = extractSourceData();
  return data.siteName;
};

/**
 * Get a social media URL
 * @param {string} platform - Platform name (facebook, instagram, twitter, linkedin, tiktok)
 * @returns {string|null}
 */
const getSocialUrl = (platform) => {
  const data = extractSourceData();
  return data.socials[platform.toLowerCase()] || null;
};

/**
 * Get all social media URLs
 * @returns {Object}
 */
const getAllSocials = () => {
  const data = extractSourceData();
  return data.socials;
};

/**
 * Get the reviews/testimonials heading
 * @returns {string|null}
 */
const getReviewsHeading = () => {
  const data = extractSourceData();
  return data.reviewsHeading;
};

/**
 * Get the phone number
 * @returns {string|null}
 */
const getPhone = () => {
  const data = extractSourceData();
  return data.phone;
};

/**
 * Get the email address
 * @returns {string|null}
 */
const getEmail = () => {
  const data = extractSourceData();
  return data.email;
};

/**
 * Get the site URL
 * @returns {string|null}
 */
const getSiteUrl = () => {
  const data = extractSourceData();
  return data.siteUrl;
};

/**
 * Get address data
 * @returns {Object}
 */
const getAddress = () => {
  const data = extractSourceData();
  return data.address;
};

module.exports = {
  extractSourceData,
  clearCache,
  getSiteTitle,
  getMetaDescription,
  getOrgName,
  getSiteName,
  getSocialUrl,
  getAllSocials,
  getReviewsHeading,
  getPhone,
  getEmail,
  getSiteUrl,
  getAddress,
};
