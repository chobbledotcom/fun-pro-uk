#!/usr/bin/env node

/**
 * Convert remote images to local files
 * 
 * This script scans markdown files for remote image URLs and downloads them locally.
 * Run this after the main import to fetch images separately.
 * 
 * Usage:
 *   node scripts/convert-remote-images.js [--dry-run] [--type products|pages|categories|news]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONTENT_DIRS = ['products', 'pages', 'category', 'news'];
const BASE_DIR = path.join(__dirname, '..');

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { dryRun: false, type: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      result.dryRun = true;
    } else if (args[i] === '--type' && args[i + 1]) {
      result.type = args[i + 1];
      i++;
    }
  }

  return result;
};

/**
 * Download a file from URL
 */
const downloadFile = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
      }
      
      if (response.statusCode === 200) {
        const writeStream = fs.createWriteStream(filepath);
        response.pipe(writeStream);
        writeStream.on('finish', () => {
          writeStream.close();
          resolve();
        });
        writeStream.on('error', reject);
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', reject);
  });
};

/**
 * Generate a local filename from a URL
 */
const generateFilename = (url, contentType, slug) => {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const originalName = pathParts[pathParts.length - 1];
  
  // If it has a reasonable filename, use it
  if (originalName && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(originalName)) {
    return originalName;
  }
  
  // Generate one based on slug
  const extension = originalName.split('.').pop() || 'jpg';
  return `${slug}-${Date.now()}.${extension}`;
};

/**
 * Extract remote image URLs from markdown content
 */
const extractRemoteImages = (content) => {
  const images = [];
  
  // Match markdown images: ![alt](url)
  const mdImageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let match;
  while ((match = mdImageRegex.exec(content)) !== null) {
    images.push({ alt: match[1], url: match[2], fullMatch: match[0] });
  }
  
  // Match YAML frontmatter image fields
  const yamlImageRegex = /^(header_image|image):\s*["']?(https?:\/\/[^\s"']+)["']?/gm;
  while ((match = yamlImageRegex.exec(content)) !== null) {
    images.push({ field: match[1], url: match[2], fullMatch: match[0] });
  }
  
  // Match gallery arrays in YAML
  const galleryRegex = /gallery:\s*\n((?:\s*-\s*["']?https?:\/\/[^\s"'\n]+["']?\n?)+)/g;
  while ((match = galleryRegex.exec(content)) !== null) {
    const galleryBlock = match[1];
    const itemRegex = /-\s*["']?(https?:\/\/[^\s"'\n]+)["']?/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(galleryBlock)) !== null) {
      images.push({ gallery: true, url: itemMatch[1], fullMatch: itemMatch[0] });
    }
  }
  
  return images;
};

/**
 * Process a single markdown file
 */
const processFile = async (filePath, contentType, dryRun) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const slug = path.basename(filePath, '.md');
  const images = extractRemoteImages(content);
  
  if (images.length === 0) {
    return { processed: 0, downloaded: 0, cached: 0, failed: 0 };
  }
  
  const imagesDir = path.join(BASE_DIR, 'images', contentType);
  if (!dryRun && !fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  let updatedContent = content;
  let downloaded = 0;
  let cached = 0;
  let failed = 0;
  
  for (const image of images) {
    const filename = generateFilename(image.url, contentType, slug);
    const localPath = path.join(imagesDir, filename);
    const webPath = `/images/${contentType}/${filename}`;
    
    // Check if already downloaded
    if (fs.existsSync(localPath)) {
      process.stdout.write('.');
      cached++;
      // Still update the content to use local path
      if (image.fullMatch) {
        if (image.field) {
          updatedContent = updatedContent.replace(image.fullMatch, `${image.field}: "${webPath}"`);
        } else if (image.gallery) {
          updatedContent = updatedContent.replace(image.url, webPath);
        } else {
          updatedContent = updatedContent.replace(image.fullMatch, `![${image.alt}](${webPath})`);
        }
      }
      continue;
    }
    
    if (dryRun) {
      process.stdout.write('?');
      downloaded++;
      continue;
    }
    
    await downloadFile(image.url, localPath);
    process.stdout.write('+');
    downloaded++;
    
    // Update content with local path
    if (image.field) {
      updatedContent = updatedContent.replace(image.fullMatch, `${image.field}: "${webPath}"`);
    } else if (image.gallery) {
      updatedContent = updatedContent.replace(image.url, webPath);
    } else {
      updatedContent = updatedContent.replace(image.fullMatch, `![${image.alt}](${webPath})`);
    }
  }
  
  // Write updated content back
  if (!dryRun && updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent);
  }
  
  return { processed: images.length, downloaded, cached, failed };
};

/**
 * Process all markdown files in a directory
 */
const processDirectory = async (dirName, dryRun) => {
  const dirPath = path.join(BASE_DIR, dirName);
  
  if (!fs.existsSync(dirPath)) {
    return { files: 0, processed: 0, downloaded: 0, cached: 0, failed: 0 };
  }
  
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  
  if (files.length === 0) {
    return { files: 0, processed: 0, downloaded: 0, cached: 0, failed: 0 };
  }
  
  console.log(`\nProcessing ${dirName}/ (${files.length} files)`);
  
  let totals = { files: files.length, processed: 0, downloaded: 0, cached: 0, failed: 0 };
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(dirPath, file);
    const slug = path.basename(file, '.md');
    
    process.stdout.write(`  [${i + 1}/${files.length}] ${slug}: `);
    
    const result = await processFile(filePath, dirName, dryRun);
    
    if (result.processed === 0) {
      console.log('(no remote images)');
    } else {
      console.log('');
    }
    
    totals.processed += result.processed;
    totals.downloaded += result.downloaded;
    totals.cached += result.cached;
    totals.failed += result.failed;
  }
  
  return totals;
};

/**
 * Main execution
 */
const main = async () => {
  const args = parseArgs();
  
  console.log('Converting remote images to local files...');
  if (args.dryRun) {
    console.log('(DRY RUN - no files will be modified)\n');
  }
  console.log('Legend: . = cached, + = downloaded, x = failed, ? = would download\n');
  
  const dirs = args.type ? [args.type] : CONTENT_DIRS;
  const startTime = Date.now();
  
  let grandTotals = { files: 0, processed: 0, downloaded: 0, cached: 0, failed: 0 };
  
  for (const dir of dirs) {
    const result = await processDirectory(dir, args.dryRun);
    grandTotals.files += result.files;
    grandTotals.processed += result.processed;
    grandTotals.downloaded += result.downloaded;
    grandTotals.cached += result.cached;
    grandTotals.failed += result.failed;
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n=== Summary ===');
  console.log(`Files scanned: ${grandTotals.files}`);
  console.log(`Remote images found: ${grandTotals.processed}`);
  console.log(`  Downloaded: ${grandTotals.downloaded}`);
  console.log(`  Cached: ${grandTotals.cached}`);
  console.log(`  Failed: ${grandTotals.failed}`);
  console.log(`Time: ${elapsed}s`);
  
  if (args.dryRun) {
    console.log('\nRun without --dry-run to download images.');
  }
};

main().catch(console.error);
