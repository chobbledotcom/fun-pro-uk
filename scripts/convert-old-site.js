#!/usr/bin/env node

/**
 * Site conversion script - wrapper for the modular importer
 *
 * This script maintains backward compatibility while using
 * the new modular importer structure.
 *
 * Usage:
 *   npm run import https://www.myalarmsecurity.co.uk
 *   node scripts/convert-old-site.js https://www.myalarmsecurity.co.uk
 */

const importer = require('./importer');
const { checkWget, downloadSite } = require('./wget-site');
const path = require('path');
const fs = require('fs');

/**
 * Main execution
 */
const main = async () => {
  const url = process.argv[2];

  // If URL is provided, download the site first
  if (url) {
    console.log('URL provided, downloading site with wget...\n');

    try {
      checkWget();

      const oldSitePath = path.join(__dirname, '..', 'old_site');
      const domainDir = downloadSite(url, oldSitePath);

      // Update the old_site path to point to the downloaded domain directory
      if (domainDir && fs.existsSync(domainDir)) {
        // Temporarily update the config to use the domain directory
        const config = require('./importer/config');
        config.OLD_SITE_PATH = domainDir;
      }
    } catch (error) {
      console.error('Failed to download site:', error.message);
      process.exit(1);
    }
  } else {
    console.log('No URL provided, using existing old_site directory...\n');

    // Check if old_site directory exists
    const oldSitePath = path.join(__dirname, '..', 'old_site');
    if (!fs.existsSync(oldSitePath)) {
      console.error('❌ ERROR: old_site directory does not exist!');
      console.error('   Please provide a URL to download:');
      console.error('   npm run import https://www.myalarmsecurity.co.uk\n');
      process.exit(1);
    }
  }

  // Run the conversion
  await importer.main();
};

main();