#!/usr/bin/env bun

/**
 * Mirror product images from Cloudinary to local storage
 * 
 * This script:
 * 1. Scans all product markdown files for Cloudinary image URLs
 * 2. Builds a mapping of images to products (handling shared images)
 * 3. Generates smart filenames based on which products use each image
 * 4. Downloads images to images/products/ (with deduplication)
 * 5. Updates markdown files to use local paths
 * 
 * Usage:
 *   bun scripts/importer/mirror-product-images.js              # Mirror all images
 *   bun scripts/importer/mirror-product-images.js --dry-run    # Preview without changes
 *   bun scripts/importer/mirror-product-images.js --only batak-lite,batak-pro
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const {
  scanProductImages,
  buildFilenameMapping
} = require('./utils/product-image-mapper');
const { ensureDir } = require('./utils/filesystem');
const config = require('./config');

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { dryRun: false, only: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      result.dryRun = true;
    } else if (args[i] === '--only' && args[i + 1]) {
      result.only = args[i + 1].split(',').map(s => s.trim());
      i++;
    }
  }

  return result;
};

/**
 * Download a single image file
 * @param {string} url - Image URL
 * @param {string} filepath - Local path to save file
 * @returns {Promise<{cached: boolean}>}
 */
const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    // Check if file already exists (cached)
    if (fs.existsSync(filepath)) {
      resolve({ cached: true });
      return;
    }

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const writeStream = fs.createWriteStream(filepath);
        response.pipe(writeStream);
        writeStream.on('finish', () => {
          writeStream.close();
          resolve({ cached: false });
        });
        writeStream.on('error', reject);
      } else {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
      }
    }).on('error', reject);
  });
};

/**
 * Download all images
 * @param {Map} filenameMapping - Map of hash -> {url, filename, products}
 * @param {string} imagesDir - Directory to save images
 * @param {boolean} dryRun - If true, skip actual downloads
 * @returns {Promise<{downloaded: number, cached: number, failed: number}>}
 */
const downloadAllImages = async (filenameMapping, imagesDir, dryRun) => {
  if (dryRun) {
    return { downloaded: 0, cached: 0, failed: 0 };
  }

  ensureDir(imagesDir);

  const total = filenameMapping.size;
  let downloaded = 0;
  let cached = 0;
  let failed = 0;
  let processed = 0;

  console.log(`  Downloading ${total} images...`);

  for (const [hash, data] of filenameMapping) {
    // Create per-product folder and save image there
    const productDir = path.join(imagesDir, data.folder);
    ensureDir(productDir);
    const filepath = path.join(productDir, data.filename);

    try {
      const result = await downloadImage(data.url, filepath);
      if (result.cached) {
        cached++;
      } else {
        downloaded++;
      }
    } catch (error) {
      console.error(`\n  ✗ Failed to download ${data.folder}/${data.filename} (${hash}): ${error.message}`);
      failed++;
      // Abort on any download failure as requested
      throw new Error(`Image download failed for ${data.url}`);
    }

    processed++;
    if (processed % 10 === 0 || processed === total) {
      process.stdout.write(`\r  Progress: ${processed}/${total} (downloaded: ${downloaded}, cached: ${cached})`);
    }
  }

  console.log(''); // New line after progress
  return { downloaded, cached, failed };
};

/**
 * Update a single product markdown file with local image paths
 * Preserves original Cloudinary URLs in gallery_cloudinary field
 * @param {string} filePath - Path to product markdown file
 * @param {Map} hashToFileData - Map of Cloudinary hash -> {filename, folder}
 * @param {boolean} dryRun - If true, skip actual file writes
 * @returns {number} Number of images updated
 */
const updateProductMarkdown = (filePath, hashToFileData, dryRun) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const extractCloudinaryHash = require('./utils/product-image-mapper').extractCloudinaryHash;

  let updatedContent = content;
  let updateCount = 0;

  // Find all gallery URLs in frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return 0;

  const frontmatter = frontmatterMatch[1];
  const galleryMatch = frontmatter.match(/gallery:\s*\n((?:\s+-\s+"[^"]+"\n?)+)/);

  if (!galleryMatch) return 0;

  const gallerySection = galleryMatch[0];
  let updatedGallery = gallerySection;
  const cloudinaryUrls = [];

  // Replace each Cloudinary URL with local path
  const urlMatches = gallerySection.matchAll(/\s+-\s+"([^"]+)"/g);
  for (const match of urlMatches) {
    const url = match[1];
    const hash = extractCloudinaryHash(url);

    if (hash && hashToFileData.has(hash)) {
      cloudinaryUrls.push(url);
      const { filename, folder } = hashToFileData.get(hash);
      const localPath = `/images/products/${folder}/${filename}`;
      updatedGallery = updatedGallery.replace(`"${url}"`, `"${localPath}"`);
      updateCount++;
    }
  }

  if (updateCount > 0) {
    // Create gallery_cloudinary section with original URLs
    const cloudinaryGallery = '\ngallery_cloudinary:\n' +
      cloudinaryUrls.map(url => `  - "${url}"`).join('\n') + '\n';

    // Insert gallery_cloudinary right after gallery section
    const replacementText = updatedGallery + cloudinaryGallery;
    updatedContent = content.replace(gallerySection, replacementText);

    if (!dryRun) {
      fs.writeFileSync(filePath, updatedContent);
    }
  }

  return updateCount;
};

/**
 * Update all product markdown files
 * @param {string} productsDir - Directory containing product markdown files
 * @param {Map} filenameMapping - Map of hash -> {url, filename, folder, products}
 * @param {boolean} dryRun - If true, skip actual file writes
 * @param {string[]|null} onlyProducts - Optional array of product slugs to process
 * @returns {{filesUpdated: number, imagesUpdated: number}}
 */
const updateAllMarkdownFiles = (productsDir, filenameMapping, dryRun, onlyProducts) => {
  // Build hash -> {filename, folder} lookup map
  const hashToFileData = new Map();
  for (const [hash, data] of filenameMapping) {
    hashToFileData.set(hash, { filename: data.filename, folder: data.folder });
  }

  const productFiles = fs.readdirSync(productsDir)
    .filter(f => f.endsWith('.md'));

  // Filter by --only if specified
  const filesToProcess = onlyProducts
    ? productFiles.filter(f => onlyProducts.includes(path.basename(f, '.md')))
    : productFiles;

  console.log(`  Updating ${filesToProcess.length} product file(s)...`);

  let filesUpdated = 0;
  let imagesUpdated = 0;

  for (const file of filesToProcess) {
    const filePath = path.join(productsDir, file);
    const updateCount = updateProductMarkdown(filePath, hashToFileData, dryRun);

    if (updateCount > 0) {
      filesUpdated++;
      imagesUpdated += updateCount;
      const slug = path.basename(file, '.md');
      console.log(`  ✓ ${slug} (${updateCount} image${updateCount > 1 ? 's' : ''})`);
    }
  }

  return { filesUpdated, imagesUpdated };
};

/**
 * Display image mapping preview
 * @param {Map} filenameMapping - Map of hash -> {url, filename, products}
 * @param {number} maxExamples - Maximum examples to show
 */
const displayMapping = (filenameMapping, maxExamples = 10) => {
  console.log('\n  Image mapping examples:');

  let count = 0;
  for (const [hash, data] of filenameMapping) {
    if (count >= maxExamples) {
      const remaining = filenameMapping.size - maxExamples;
      console.log(`  ... and ${remaining} more images`);
      break;
    }

    const productList = data.products.map(p => p.slug).join(', ');
    console.log(`    ${hash.substring(0, 8)}... -> ${data.filename}`);
    console.log(`      Used by: ${productList}`);

    count++;
  }
  console.log('');
};

/**
 * Main execution function
 */
const main = async () => {
  const args = parseArgs();
  const productsDir = path.join(config.OUTPUT_BASE, config.paths.products);
  const imagesDir = path.join(config.OUTPUT_BASE, 'images', 'products');

  const dryRunLabel = args.dryRun ? ' (DRY RUN)' : '';
  console.log(`Mirroring product images${dryRunLabel}...`);

  // Scan ALL products for images (don't filter by --only yet)
  // This is important because multiple products can share the same image
  console.log(`  Scanning product files...`);
  const { imageMap, products } = scanProductImages(productsDir, null);

  const totalProducts = products.length;
  const totalImageRefs = Array.from(imageMap.values())
    .reduce((sum, img) => sum + img.products.length, 0);
  const uniqueImages = imageMap.size;

  console.log(`  Found ${totalProducts} product(s)`);
  console.log(`  Found ${totalImageRefs} total image references`);
  console.log(`  Found ${uniqueImages} unique images`);

  // Build filename mapping from FULL imageMap (always use all products for naming)
  // This ensures filenames accurately reflect which products share images
  // All images are JPEG format
  const fullFilenameMapping = buildFilenameMapping(imageMap);
  
  // Filter to only images we need to download if --only is specified
  let filenameMapping = fullFilenameMapping;
  if (!args.dryRun && args.only && args.only.length > 0) {
    filenameMapping = new Map();
    for (const [hash, data] of fullFilenameMapping) {
      if (data.products.some(p => args.only.includes(p.slug))) {
        filenameMapping.set(hash, data);
      }
    }
    console.log(`  Filtered to ${filenameMapping.size} images for selected products`);
  }

  // Display mapping preview (show full mapping for dry runs)
  if (args.dryRun) {
    displayMapping(fullFilenameMapping, 15);
  }

  // Download images
  const stats = await downloadAllImages(filenameMapping, imagesDir, args.dryRun);

  if (!args.dryRun && stats.downloaded + stats.cached > 0) {
    console.log(`  Downloaded: ${stats.downloaded}, Cached: ${stats.cached}, Failed: ${stats.failed}`);
  }

  // Update markdown files (use full mapping so all products get correct paths)
  const updateStats = updateAllMarkdownFiles(productsDir, fullFilenameMapping, args.dryRun, args.only);

  console.log('');
  if (args.dryRun) {
    // Calculate how many images would actually be downloaded if --only is specified
    let imagesToDownloadCount = uniqueImages;
    if (args.only && args.only.length > 0) {
      imagesToDownloadCount = 0;
      for (const [, data] of imageMap) {
        if (data.products.some(p => args.only.includes(p.slug))) {
          imagesToDownloadCount++;
        }
      }
    }
    
    console.log(`  Would download ${imagesToDownloadCount} images to images/products/`);
    console.log(`  Would update ${updateStats.filesUpdated} markdown file(s) (${updateStats.imagesUpdated} image references)`);
    if (args.only) {
      console.log(`  (Filtered to products: ${args.only.join(', ')})`);
    }
    console.log('\n✓ Dry run complete (no changes made)');
  } else {
    console.log(`  Updated ${updateStats.filesUpdated} file(s) successfully (${updateStats.imagesUpdated} image references)`);
    console.log('\n✓ Image mirroring complete!');
  }

  return { successful: updateStats.filesUpdated, failed: 0, total: totalProducts };
};

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { main };
