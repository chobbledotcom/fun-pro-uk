#!/usr/bin/env node

/**
 * Download a website using wget for offline processing
 * This creates a mirror suitable for the site conversion scripts
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if wget is installed
 * @throws {Error} If wget is not found
 */
const checkWget = () => {
  try {
    execSync('wget --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('\n❌ ERROR: wget is not installed!');
    console.error('   Please install wget before running the importer:');
    console.error('   - Ubuntu/Debian: sudo apt-get install wget');
    console.error('   - macOS: brew install wget');
    console.error('   - Windows: https://www.gnu.org/software/wget/\n');
    process.exit(1);
  }
};

/**
 * Download a website using wget
 * @param {string} url - The URL to download
 * @param {string} outputPath - Where to save the downloaded site
 */
const downloadSite = (url, outputPath) => {
  console.log(`Downloading site from ${url}...`);
  console.log(`Output directory: ${outputPath}\n`);

  // Clean old_site directory if it exists
  if (fs.existsSync(outputPath)) {
    console.log('Removing existing old_site directory...');
    fs.rmSync(outputPath, { recursive: true, force: true });
  }

  // Create output directory
  fs.mkdirSync(outputPath, { recursive: true });

  try {
    // wget options:
    // -r: recursive
    // -l 10: max recursion depth of 10
    // -k: convert links for local viewing
    // -p: download all page requisites (images, css, js)
    // -E: adjust extension (save .html)
    // -np: don't ascend to parent directory
    // --restrict-file-names=windows: sanitize filenames
    // -P: output directory
    const wgetCommand = `wget -r -l 10 -k -p -E -np --restrict-file-names=windows -P "${outputPath}" "${url}"`;

    console.log('Running wget (this may take a few minutes)...');
    execSync(wgetCommand, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    console.log('\n✓ Site downloaded successfully\n');

    // Find the domain directory created by wget
    const files = fs.readdirSync(outputPath);
    if (files.length > 0) {
      const domainDir = path.join(outputPath, files[0]);
      console.log(`Site saved to: ${domainDir}\n`);
      return domainDir;
    }

    return outputPath;
  } catch (error) {
    console.error('\n❌ Error downloading site:', error.message);
    throw error;
  }
};

module.exports = {
  checkWget,
  downloadSite
};

// Run if called directly
if (require.main === module) {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: node wget-site.js <url>');
    console.error('Example: node wget-site.js https://www.myalarmsecurity.co.uk');
    process.exit(1);
  }

  checkWget();
  const outputPath = path.join(__dirname, '..', 'old_site');
  downloadSite(url, outputPath);
}
