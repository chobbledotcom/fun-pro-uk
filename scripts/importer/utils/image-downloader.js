const path = require('path');
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
 * Download a single image and return local path
 * @param {string} imageUrl - Image URL
 * @param {string} contentType - Type of content (products, pages, categories)
 * @param {string} slug - Content slug
 * @param {string} filename - Optional custom filename
 * @returns {Promise<string>} Local image path
 */
const downloadImage = async (imageUrl, contentType, slug, filename = null) => {
  if (!imageUrl) return '';

  // Convert Fun Pro UK URLs to direct image URLs
  const funProResult = convertFunProImageUrl(imageUrl);
  const sourceUrl = removeCloudinaryTransformations(funProResult.sourceUrl || imageUrl);

  const imagesDir = path.join(__dirname, '..', '..', '..', 'images', contentType);
  ensureDir(imagesDir);

  const finalFilename = filename || funProResult.filename || generateImageFilename(sourceUrl, contentType, slug);
  const localPath = path.join(imagesDir, finalFilename);

  try {
    await downloadFile(sourceUrl, localPath);
    return `/images/${contentType}/${finalFilename}`;
  } catch (error) {
    // Don't log warning for expected failures (like old ASP.NET dynamic URLs)
    if (!imageUrl.includes('thumbs.ashx')) {
      console.error(`    Warning: Failed to download image for ${slug}:`, error.message);
    }
    return '';
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
  return downloadImage(imageUrl, 'products', slug, filename);
};

/**
 * Download all product gallery images
 * @param {string[]} imageUrls - Array of image URLs
 * @param {string} slug - Product slug
 * @returns {Promise<string[]>} Array of local image paths
 */
const downloadProductGallery = async (imageUrls, slug) => {
  if (!imageUrls || imageUrls.length === 0) return [];

  if (imageUrls.length > 0) {
    process.stdout.write(` (${imageUrls.length} images)`);
  }

  const localPaths = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const funProResult = convertFunProImageUrl(imageUrl);
    const filename = funProResult.filename || `${slug}-${i}.webp`;
    const localPath = await downloadImage(imageUrl, 'products', slug, filename);
    if (localPath) {
      localPaths.push(localPath);
    }
  }
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

  let updatedContent = content;

  for (const match of matches) {
    const fullMatch = match[0];
    const altText = match[1];
    const imageUrl = match[2];

    // Skip images without alt text (e.g., decorative icons)
    if (!altText || altText.trim() === '') {
      updatedContent = updatedContent.replace(fullMatch, '');
      continue;
    }

    const webPath = await downloadImage(imageUrl, contentType, slug);

    if (webPath) {
      updatedContent = updatedContent.replace(fullMatch, `![${altText}](${webPath})`);
    }
  }

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
