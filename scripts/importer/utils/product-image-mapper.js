const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Extract Cloudinary hash from URL
 * @param {string} url - Cloudinary image URL
 * @returns {string|null} Hash identifier or null
 */
const extractCloudinaryHash = (url) => {
  if (!url) return null;
  
  const match = url.match(/cloudinary\.com\/image\/upload\/([a-f0-9]+)/i);
  return match ? match[1] : null;
};

/**
 * Parse frontmatter and extract gallery URLs from a markdown file
 * @param {string} filePath - Path to markdown file
 * @returns {{slug: string, gallery: string[], title: string}} Product data
 */
const parseProductMarkdown = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const slug = path.basename(filePath, '.md');
  
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { slug, gallery: [], title: slug };
  }
  
  const frontmatter = frontmatterMatch[1];
  
  // Extract title
  const titleMatch = frontmatter.match(/^title:\s*"([^"]+)"/m);
  const title = titleMatch ? titleMatch[1] : slug;
  
  // Extract gallery array
  const gallery = [];
  const galleryMatch = frontmatter.match(/gallery:\s*\n((?:\s+-\s+"[^"]+"\n?)+)/);
  
  if (galleryMatch) {
    const galleryLines = galleryMatch[1];
    const urlMatches = galleryLines.matchAll(/\s+-\s+"([^"]+)"/g);
    for (const match of urlMatches) {
      gallery.push(match[1]);
    }
  }
  
  return { slug, gallery, title };
};

/**
 * Scan all product markdown files and build image mappings
 * @param {string} productsDir - Directory containing product markdown files
 * @param {string[]|null} onlyProducts - Optional array of product slugs to process
 * @returns {Object} Mapping data structure
 */
const scanProductImages = (productsDir, onlyProducts = null) => {
  const productFiles = fs.readdirSync(productsDir)
    .filter(f => f.endsWith('.md'));
  
  // Filter by --only if specified
  const filesToProcess = onlyProducts 
    ? productFiles.filter(f => onlyProducts.includes(path.basename(f, '.md')))
    : productFiles;
  
  // Map structure: hash -> { url, products: [{slug, title, imageIndex}] }
  const imageMap = new Map();
  
  // Track all products processed
  const products = [];
  
  for (const file of filesToProcess) {
    const filePath = path.join(productsDir, file);
    const productData = parseProductMarkdown(filePath);
    
    products.push(productData);
    
    productData.gallery.forEach((url, index) => {
      const hash = extractCloudinaryHash(url);
      if (!hash) return;
      
      if (!imageMap.has(hash)) {
        imageMap.set(hash, {
          url,
          products: []
        });
      }
      
      imageMap.get(hash).products.push({
        slug: productData.slug,
        title: productData.title,
        imageIndex: index
      });
    });
  }
  
  return { imageMap, products };
};

/**
 * Generate a smart filename for an image based on which products use it
 * @param {Array} products - Array of {slug, title, imageIndex} objects
 * @param {Map} filenameUsage - Map to track filename usage for deduplication
 * @returns {string} Generated filename (without extension)
 */
const generateImageFilename = (products, filenameUsage = new Map()) => {
  // Sort products alphabetically by slug for consistency
  const sortedProducts = [...products].sort((a, b) => 
    a.slug.localeCompare(b.slug)
  );
  
  let baseFilename;
  
  if (sortedProducts.length === 1) {
    // Single product - use slug with image index
    const product = sortedProducts[0];
    
    // All images numbered: product-1, product-2, etc.
    baseFilename = `${product.slug}-${product.imageIndex + 1}`;
  } else {
    // Multiple products share this image
    // Join product slugs with hyphens
    baseFilename = sortedProducts.map(p => p.slug).join('-');
  }
  
  // Handle filename collisions by appending -2, -3, etc.
  let finalFilename = baseFilename;
  let counter = 2;
  
  while (filenameUsage.has(finalFilename)) {
    finalFilename = `${baseFilename}-${counter}`;
    counter++;
  }
  
  // Track this filename as used
  filenameUsage.set(finalFilename, true);
  
  // Track how many images this product has
  if (sortedProducts.length === 1) {
    const product = sortedProducts[0];
    const count = filenameUsage.get(product.slug) || 0;
    filenameUsage.set(product.slug, count + 1);
  }
  
  return finalFilename;
};

/**
 * Detect image extension from Content-Type header
 * @param {string} url - Image URL
 * @returns {Promise<string>} File extension (e.g., 'jpg', 'png', 'webp')
 */
const detectImageExtension = (url) => {
  return new Promise((resolve) => {
    https.get(url, { method: 'HEAD' }, (response) => {
      const contentType = response.headers['content-type'];
      
      // Map common MIME types to extensions
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/svg+xml': 'svg'
      };
      
      const ext = mimeToExt[contentType] || 'jpg'; // Default to jpg
      resolve(ext);
    }).on('error', () => {
      // On error, default to jpg
      console.warn(`  Warning: Failed to detect extension for ${url}, using .jpg`);
      resolve('jpg');
    });
  });
};

/**
 * Build complete filename mapping for all images
 * @param {Map} imageMap - Map of hash -> {url, products}
 * @param {boolean} detectExtensions - Whether to detect extensions (slow) or use default
 * @returns {Promise<Map>} Map of hash -> {url, filename, products}
 */
const buildFilenameMapping = async (imageMap, detectExtensions = true) => {
  const filenameUsage = new Map();
  const result = new Map();
  
  // First pass: generate base filenames
  for (const [hash, data] of imageMap) {
    const baseFilename = generateImageFilename(data.products, filenameUsage);
    result.set(hash, {
      url: data.url,
      baseFilename,
      products: data.products
    });
  }
  
  if (detectExtensions) {
    // Second pass: detect extensions from Content-Type headers
    console.log('  Detecting image formats...');
    let processed = 0;
    const total = result.size;
    
    for (const [, data] of result) {
      const ext = await detectImageExtension(data.url);
      data.filename = `${data.baseFilename}.${ext}`;
      
      processed++;
      if (processed % 10 === 0 || processed === total) {
        process.stdout.write(`\r  Detected ${processed}/${total} formats...`);
      }
    }
    
    console.log(''); // New line after progress
  } else {
    // Just use .jpg as default (faster for dry runs)
    for (const [, data] of result) {
      data.filename = `${data.baseFilename}.jpg`;
    }
  }
  
  return result;
};

module.exports = {
  extractCloudinaryHash,
  parseProductMarkdown,
  scanProductImages,
  generateImageFilename,
  detectImageExtension,
  buildFilenameMapping
};
