#!/usr/bin/env bun

/**
 * Optimize product images
 * 
 * This script:
 * 1. Scans all images in images/products/
 * 2. Resizes images over 1800px to max 1800px (longest side)
 * 3. Converts to JPEG at 95% quality
 * 4. Only replaces if the optimized version is smaller
 * 
 * Usage:
 *   bun scripts/importer/optimize-product-images.js              # Optimize all images
 *   bun scripts/importer/optimize-product-images.js --dry-run    # Preview without changes
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { dryRun: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
};

/**
 * Check if ImageMagick is installed
 */
const checkImageMagick = () => {
  try {
    execSync('convert -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Get image dimensions using ImageMagick
 * @param {string} filePath - Path to image file
 * @returns {{width: number, height: number}|null}
 */
const getImageDimensions = (filePath) => {
  try {
    const output = execSync(`identify -format "%w %h" "${filePath}"`, { encoding: 'utf8' });
    const [width, height] = output.trim().split(' ').map(Number);
    return { width, height };
  } catch (error) {
    console.error(`  Error getting dimensions for ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
};

/**
 * Optimize a single image
 * @param {string} filePath - Path to image file
 * @param {boolean} dryRun - If true, don't actually optimize
 * @returns {{optimized: boolean, originalSize: number, newSize: number, saved: number}}
 */
const optimizeImage = (filePath, dryRun) => {
  const stats = fs.statSync(filePath);
  const originalSize = stats.size;
  
  // Get dimensions
  const dims = getImageDimensions(filePath);
  if (!dims) {
    return { optimized: false, originalSize, newSize: originalSize, saved: 0 };
  }
  
  const maxDimension = Math.max(dims.width, dims.height);
  const needsResize = maxDimension > 1800;
  
  if (!needsResize && path.extname(filePath).toLowerCase() === '.jpg') {
    // Already small enough and already JPEG, skip
    return { optimized: false, originalSize, newSize: originalSize, saved: 0 };
  }
  
  // Create temporary output file
  const tempPath = filePath + '.tmp.jpg';
  
  try {
    // Build ImageMagick command
    let cmd = `convert "${filePath}"`;
    
    if (needsResize) {
      cmd += ` -resize 1800x1800\\>`;
    }
    
    // Convert to JPEG with 95% quality
    cmd += ` -quality 95 "${tempPath}"`;
    
    if (dryRun) {
      // In dry run, just report what would happen
      return { 
        optimized: true, 
        originalSize, 
        newSize: originalSize, // Can't know without actually processing
        saved: 0,
        wouldResize: needsResize
      };
    }
    
    // Execute conversion
    execSync(cmd, { stdio: 'pipe' });
    
    // Check new file size
    const newStats = fs.statSync(tempPath);
    const newSize = newStats.size;
    
    // Only replace if smaller
    if (newSize < originalSize) {
      fs.renameSync(tempPath, filePath);
      return { 
        optimized: true, 
        originalSize, 
        newSize, 
        saved: originalSize - newSize,
        replaced: true
      };
    } else {
      // New file is larger, keep original
      fs.unlinkSync(tempPath);
      return { 
        optimized: true, 
        originalSize, 
        newSize, 
        saved: 0,
        replaced: false,
        keptOriginal: true
      };
    }
  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error(`  Error optimizing ${path.basename(filePath)}: ${error.message}`);
    return { optimized: false, originalSize, newSize: originalSize, saved: 0, error: true };
  }
};

/**
 * Format bytes to human readable
 */
const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/**
 * Main execution function
 */
const main = () => {
  const args = parseArgs();
  
  const dryRunLabel = args.dryRun ? ' (DRY RUN)' : '';
  console.log(`Optimizing product images${dryRunLabel}...`);
  
  // Check for ImageMagick
  if (!checkImageMagick()) {
    console.error('Error: ImageMagick not found. Please install it first:');
    console.error('  macOS: brew install imagemagick');
    console.error('  Ubuntu/Debian: sudo apt-get install imagemagick');
    console.error('  NixOS: Should already be available');
    process.exit(1);
  }
  
  const imagesDir = path.join(__dirname, '..', '..', 'images', 'products');
  
  if (!fs.existsSync(imagesDir)) {
    console.error(`Error: Images directory not found: ${imagesDir}`);
    process.exit(1);
  }
  
  // Get all image files
  const imageFiles = fs.readdirSync(imagesDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map(f => path.join(imagesDir, f));
  
  console.log(`  Found ${imageFiles.length} image(s)`);
  
  let processed = 0;
  let optimized = 0;
  let replaced = 0;
  let keptOriginal = 0;
  let errors = 0;
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let totalSaved = 0;
  
  for (const filePath of imageFiles) {
    const result = optimizeImage(filePath, args.dryRun);
    
    processed++;
    totalOriginalSize += result.originalSize;
    totalNewSize += result.newSize;
    
    if (result.optimized) {
      optimized++;
      
      if (result.replaced) {
        replaced++;
        totalSaved += result.saved;
        const percent = ((result.saved / result.originalSize) * 100).toFixed(1);
        console.log(`  ✓ ${path.basename(filePath)}: ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (${percent}% smaller)`);
      } else if (result.keptOriginal) {
        keptOriginal++;
        console.log(`  • ${path.basename(filePath)}: Kept original (optimized version was larger)`);
      } else if (result.wouldResize) {
        console.log(`  • ${path.basename(filePath)}: Would resize and optimize`);
      }
    } else if (result.error) {
      errors++;
    }
    
    // Progress indicator every 10 files
    if (processed % 10 === 0) {
      process.stdout.write(`\r  Processed ${processed}/${imageFiles.length}...`);
    }
  }
  
  if (processed % 10 !== 0) {
    console.log(`\r  Processed ${processed}/${imageFiles.length}`);
  } else {
    console.log('');
  }
  
  console.log('');
  console.log(`Summary:`);
  console.log(`  Processed: ${processed} files`);
  console.log(`  Optimized: ${optimized} files`);
  
  if (!args.dryRun) {
    console.log(`  Replaced: ${replaced} files`);
    console.log(`  Kept original: ${keptOriginal} files`);
    console.log(`  Skipped: ${processed - optimized - errors} files (already optimal)`);
    console.log(`  Errors: ${errors} files`);
    console.log(`  Total saved: ${formatBytes(totalSaved)}`);
    console.log(`  Original total: ${formatBytes(totalOriginalSize)}`);
    console.log(`  New total: ${formatBytes(totalNewSize)}`);
    const percentSaved = totalOriginalSize > 0 ? ((totalSaved / totalOriginalSize) * 100).toFixed(1) : 0;
    console.log(`  Space saved: ${percentSaved}%`);
  }
  
  console.log('');
  if (args.dryRun) {
    console.log('✓ Dry run complete (no changes made)');
  } else {
    console.log('✓ Image optimization complete!');
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
