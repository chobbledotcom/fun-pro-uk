const path = require('path');
const { ensureDir, downloadFile } = require('./filesystem');

/**
 * Remove Cloudinary transformation parameters to get original source URL
 * @param {string} url - Cloudinary URL with transformations
 * @returns {string} URL without f_auto,q_auto transformations
 */
const removeCloudinaryTransformations = (url) => url.replace(/\/f_auto,q_auto\//g, '/');

/**
 * Generate a unique filename from URL
 * @param {string} url - Image URL
 * @param {string} contentType - Type of content (page, category, product)
 * @param {string} slug - Content slug
 * @returns {string} Unique filename
 */
const generateImageFilename = (url, contentType, slug) => {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const cloudinaryId = pathParts[pathParts.length - 1].split('.')[0];
  const extension = pathParts[pathParts.length - 1].split('.').pop() || 'webp';
  return `${contentType}-${slug}-${cloudinaryId}.${extension}`;
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

  const sourceUrl = removeCloudinaryTransformations(imageUrl);
  const imagesDir = path.join(__dirname, '..', '..', '..', 'images', contentType);
  ensureDir(imagesDir);

  const finalFilename = filename || generateImageFilename(sourceUrl, contentType, slug);
  const localPath = path.join(imagesDir, finalFilename);

  try {
    await downloadFile(sourceUrl, localPath);
    return `/images/${contentType}/${finalFilename}`;
  } catch (error) {
    console.error(`    Warning: Failed to download image for ${slug}:`, error.message);
    return '';
  }
};

/**
 * Download product header image
 * @param {string} imageUrl - Cloudinary URL
 * @param {string} slug - Product slug
 * @returns {Promise<string>} Local image path
 */
const downloadProductImage = async (imageUrl, slug) =>
  downloadImage(imageUrl, 'products', slug, `${slug}.webp`);

/**
 * Download embedded images from content and update URLs
 * @param {string} content - Content with image URLs
 * @param {string} contentType - Type of content (page, category, product)
 * @param {string} slug - Content slug
 * @returns {Promise<string>} Content with updated local image paths
 */
const downloadEmbeddedImages = async (content, contentType, slug) => {
  const imageRegex = /!\[([^\]]*)\]\((https:\/\/res\.cloudinary\.com\/[^)]+?)(?:\s+"[^"]*")?\)/g;
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
  downloadImage,
  downloadProductImage,
  downloadEmbeddedImages
};
