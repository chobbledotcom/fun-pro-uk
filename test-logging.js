#!/usr/bin/env node

/**
 * Test script to demonstrate the improved logging
 * This simulates what the logs would look like with the new changes
 */

const products = [
  { name: 'roll-and-bowl-game-hire', images: 34, cached: 30, downloaded: 4, failed: 0 },
  { name: 'batak-lite', images: 12, cached: 12, downloaded: 0, failed: 0 },
  { name: 'mega-wire-branded-game', images: 8, cached: 3, downloaded: 5, failed: 0 },
  { name: 'air-hockey-table', images: 15, cached: 0, downloaded: 14, failed: 1 },
  { name: 'prize-crane-grabber', images: 0, cached: 0, downloaded: 0, failed: 0 },
  { name: 'photo-booth-deluxe', images: 22, cached: 10, downloaded: 10, failed: 2 },
  { name: 'giant-jenga', images: 5, cached: 5, downloaded: 0, failed: 0 },
  { name: 'dance-machine-pro', images: 18, cached: 0, downloaded: 18, failed: 0 }
];

console.log('Starting conversion of old Fun Pro UK site...\n');
console.log('✓ Images directory exists (using cached images)\n');
console.log('Converting products...');
console.log(`  Found ${products.length} product files`);
console.log('  Scanning categories for product relationships...');

products.forEach((product, index) => {
  const progressPrefix = `  [${index + 1}/${products.length}]`;
  process.stdout.write(`${progressPrefix} Converting: ${product.name}...`);
  
  // Simulate the status message based on image stats
  let statusMsg = '';
  if (product.images === 0) {
    statusMsg = ' ✓ (no images)';
  } else if (product.cached > 0 && product.downloaded === 0) {
    statusMsg = ` ✓ (${product.cached} cached)`;
  } else if (product.downloaded > 0 && product.failed === 0 && product.cached === 0) {
    statusMsg = ` ✓ (${product.downloaded} downloaded)`;
  } else if (product.failed > 0) {
    const ok = product.cached + product.downloaded;
    statusMsg = ` ⚠ (${ok}/${product.images} ok, ${product.failed} failed)`;
  } else if (product.cached > 0 && product.downloaded > 0) {
    statusMsg = ` ✓ (${product.cached} cached, ${product.downloaded} new)`;
  } else {
    statusMsg = ' ✓';
  }
  
  console.log(statusMsg);
});

console.log('\n=== Conversion Summary ===');
console.log('Products: 8 successful, 0 failed (8 total)');

const totalImages = products.reduce((sum, p) => sum + p.images, 0);
const totalCached = products.reduce((sum, p) => sum + p.cached, 0);
const totalDownloaded = products.reduce((sum, p) => sum + p.downloaded, 0);
const totalFailed = products.reduce((sum, p) => sum + p.failed, 0);

console.log(`\nImage Statistics:`);
console.log(`  Total images processed: ${totalImages}`);
console.log(`  Images cached: ${totalCached} (${Math.round(totalCached/totalImages*100)}%)`);
console.log(`  Images downloaded: ${totalDownloaded} (${Math.round(totalDownloaded/totalImages*100)}%)`);
console.log(`  Images failed: ${totalFailed} (${Math.round(totalFailed/totalImages*100)}%)`);

console.log('\nTime elapsed: 12.34 seconds');
console.log('\n✨ Conversion completed successfully!');