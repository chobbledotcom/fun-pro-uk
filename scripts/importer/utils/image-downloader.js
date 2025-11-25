const path = require('path');
const fs = require('fs');
const { ensureDir, downloadFile } = require('./filesystem');

/**
 * Remove Cloudinary transformation parameters to get original source URL
 * @param {string} url - Cloudinary URL with transformations
 * @returns {string} URL without f_auto,q_auto transformations
 */
const removeCloudinaryTransformations = (url) => url.replace(/\/f_auto,q_auto\//g, '/');

/**
 * Convert Fun Pro UK thumbs.ashx URL to direct image URL
 * @param {string} url - URL that might be a thumbs.ashx URL
 * @returns {Object} Object with sourceUrl and filename
 */
const convertFunProImageUrl = (url) => {
  if (!url) return { sourceUrl: url, filename: null };

  // Handle thumbs.ashx URLs like https://www.funprouk.co.uk/thumbs.ashx?img=batak-lite-27.jpg&cs=1200
  const thumbsMatch = url.match(/thumbs\.ashx\?(?:.*&)?img=([^&]+)/i);
  if (thumbsMatch) {
    const filename = decodeURIComponent(thumbsMatch[1]);
    // Try to download from userfiles/images directory
    return {
      sourceUrl: `https://www.funprouk.co.uk/userfiles/images/${filename}`,
      filename
    };
  }

  return { sourceUrl: url, filename: null };
};

/**
 * Generate a unique filename from URL
 * @param {string} url - Image URL
 * @param {string} contentType - Type of content (page, category, product)
 * @param {string} slug - Content slug
 * @returns {string} Unique filename
 */
const generateImageFilename = (url, contentType, slug) => {
  // First check if it's a Fun Pro UK URL
  const funProResult = convertFunProImageUrl(url);
  if (funProResult.filename) {
    return funProResult.filename;
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const cloudinaryId = pathParts[pathParts.length - 1].split('.')[0];
    const extension = pathParts[pathParts.length - 1].split('.').pop() || 'webp';
    return `${contentType}-${slug}-${cloudinaryId}.${extension}`;
  } catch (e) {
    // Fallback for invalid URLs
    return `${contentType}-${slug}-image.webp`;
  }
};

/**
 * Resolve the local file path for an image URL
 * @param {string} imageUrl - Image URL
 * @param {string} contentType - Type of content (products, pages, categories)
 * @param {string} slug - Content slug
 * @param {string} filename - Optional custom filename
 * @returns {{localPath: string, webPath: string, sourceUrl: string}} Resolved paths
 */
const resolveImagePath = (imageUrl, contentType, slug, filename = null) => {
  const funProResult = convertFunProImageUrl(imageUrl);
  const sourceUrl = removeCloudinaryTransformations(funProResult.sourceUrl || imageUrl);
  const finalFilename = filename || funProResult.filename || generateImageFilename(sourceUrl, contentType, slug);
  const imagesDir = path.join(__dirname, '..', '..', '..', 'images', contentType);
  const localPath = path.join(imagesDir, finalFilename);
  const webPath = `/images/${contentType}/${finalFilename}`;
  
  return { localPath, webPath, sourceUrl, imagesDir };
};

/**
 * Download a single image and return local path
 * @param {string} imageUrl - Image URL
 * @param {string} contentType - Type of content (products, pages, categories)
 * @param {string} slug - Content slug
 * @param {string} filename - Optional custom filename
 * @returns {Promise<{webPath: string, wasCached: boolean, failed: boolean}>} Result with path and status
 */
const downloadImage = async (imageUrl, contentType, slug, filename = null) => {
  if (!imageUrl) {
    return { webPath: '', wasCached: false, failed: false, skipped: true };
  }

  const { localPath, webPath, sourceUrl, imagesDir } = resolveImagePath(imageUrl, contentType, slug, filename);
  ensureDir(imagesDir);

  // Check if file already exists (cached)
  if (fs.existsSync(localPath)) {
    return { webPath, wasCached: true, failed: false, skipped: false };
  }

  try {
    await downloadFile(sourceUrl, localPath);
    return { webPath, wasCached: false, failed: false, skipped: false };
  } catch (error) {
    return { webPath: '', wasCached: false, failed: true, skipped: false };
  }
};

/**
 * Download product header image
 * @param {string} imageUrl - Image URL
 * @param {string} slug - Product slug
 * @returns {Promise<string>} Local image path
 */
const downloadProductImage = async (imageUrl, slug) => {
  const funProResult = convertFunProImageUrl(imageUrl);
  const filename = funProResult.filename || `${slug}.webp`;
  const result = await downloadImage(imageUrl, 'products', slug, filename);
  return result.webPath;
};

/**
 * Download all product gallery images with live progress
 * @param {string[]} imageUrls - Array of image URLs
 * @param {string} slug - Product slug
 * @returns {Promise<string[]>} Array of local image paths
 */
const downloadProductGallery = async (imageUrls, slug) => {
  if (!imageUrls || imageUrls.length === 0) return [];

  const total = imageUrls.length;
  
  // Show initial count
  process.stdout.write(` (${total} imgs:`);
  
  const localPaths = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const funProResult = convertFunProImageUrl(imageUrl);
    const filename = funProResult.filename || `${slug}-${i}.webp`;
    
    const result = await downloadImage(imageUrl, 'products', slug, filename);
    
    // Show progress indicator: . for cached, + for downloaded, x for failed
    if (result.webPath) {
      process.stdout.write(result.wasCached ? '.' : '+');
      localPaths.push(result.webPath);
    } else {
      process.stdout.write('x');
    }
  }
  
  process.stdout.write(')');
  
  return localPaths;
};

/**
 * Download embedded images from content and update URLs
 * @param {string} content - Content with image URLs
 * @param {string} contentType - Type of content (page, category, product)
 * @param {string} slug - Content slug
 * @returns {Promise<string>} Content with updated local image paths
 */
const downloadEmbeddedImages = async (content, contentType, slug) => {
  // Match both Cloudinary URLs and Fun Pro UK URLs
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+?)(?:\s+"[^"]*")?\)/g;
  const matches = [...content.matchAll(imageRegex)];

  // Filter out images without alt text upfront
  const validMatches = matches.filter(match => match[1] && match[1].trim() !== '');
  
  let updatedContent = content;
  
  // Remove images without alt text
  for (const match of matches) {
    if (!match[1] || match[1].trim() === '') {
      updatedContent = updatedContent.replace(match[0], '');
    }
  }

  if (validMatches.length === 0) return updatedContent;
  
  // Show progress for embedded images
  process.stdout.write(` [embed:`);

  for (const match of validMatches) {
    const fullMatch = match[0];
    const altText = match[1];
    const imageUrl = match[2];

    const result = await downloadImage(imageUrl, contentType, slug);

    if (result.webPath) {
      process.stdout.write(result.wasCached ? '.' : '+');
      updatedContent = updatedContent.replace(fullMatch, `![${altText}](${result.webPath})`);
    } else {
      process.stdout.write('x');
    }
  }
  
  process.stdout.write(']');

  return updatedContent;
};

module.exports = {
  removeCloudinaryTransformations,
  convertFunProImageUrl,
  downloadImage,
  downloadProductImage,
  downloadProductGallery,
  downloadEmbeddedImages
};
