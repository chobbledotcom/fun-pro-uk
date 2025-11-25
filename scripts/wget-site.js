#!/usr/bin/env node

/**
 * Download a website using wget for offline processing
 * This creates a mirror suitable for the site conversion scripts
 *
 * Updated to parse sitemap.ashx and download all URLs listed there
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Check if wget is installed
 * @throws {Error} If wget is not found
 */
const checkWget = () => {
  execSync('wget --version', { stdio: 'ignore' });
};

/**
 * Fetch a URL with proper headers
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} - The response body
 */
const fetchUrl = (url) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    };

    protocol.get(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
};

/**
 * Parse sitemap XML and extract all URLs
 * @param {string} xml - The sitemap XML content
 * @returns {string[]} - Array of URLs
 */
const parseSitemap = (xml) => {
  const urls = [];
  const locRegex = /<loc>([^<]+)<\/loc>/g;
  let match;

  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]);
  }

  return urls;
};

/**
 * Download a single URL with wget
 * @param {string} url - The URL to download
 * @param {string} outputPath - Where to save the file
 * @returns {Promise<boolean>} - Whether the download succeeded
 */
const downloadUrl = (url, outputPath) => {
  return new Promise((resolve) => {
    // wget options:
    // -q: quiet mode
    // -x: force directories (create path structure)
    // -nH: no host directories
    // -E: adjust extension (save .html)
    // --restrict-file-names=windows: sanitize filenames
    // -P: output directory
    // -U: user agent
    const wgetArgs = [
      '-q',
      '-x',
      '-nH',
      '-E',
      '--restrict-file-names=windows',
      '-P', outputPath,
      '-U', USER_AGENT,
      url
    ];

    const wget = spawn('wget', wgetArgs, { stdio: 'ignore' });

    wget.on('close', (code) => {
      resolve(code === 0);
    });

    wget.on('error', () => {
      resolve(false);
    });
  });
};

/**
 * Download all URLs from a sitemap
 * @param {string} baseUrl - The base URL of the site
 * @param {string} outputPath - Where to save the downloaded site
 */
const downloadFromSitemap = async (baseUrl, outputPath) => {
  // Try common sitemap locations
  const sitemapPaths = ['/sitemap.ashx', '/sitemap.xml', '/sitemap'];
  let sitemapUrl = null;
  let sitemapContent = null;

  for (const sitemapPath of sitemapPaths) {
    const tryUrl = baseUrl.replace(/\/$/, '') + sitemapPath;
    console.log(`Trying sitemap at: ${tryUrl}`);
    sitemapContent = await fetchUrl(tryUrl);
    if (sitemapContent && sitemapContent.includes('<urlset')) {
      sitemapUrl = tryUrl;
      console.log(`Found sitemap at: ${sitemapUrl}`);
      break;
    }
  }

  if (!sitemapContent) {
    console.error('\n ERROR: Could not find sitemap. Falling back to recursive crawl.');
    return downloadSiteRecursive(baseUrl, outputPath);
  }

  // Parse URLs from sitemap
  const urls = parseSitemap(sitemapContent);
  console.log(`\nFound ${urls.length} URLs in sitemap\n`);

  if (urls.length === 0) {
    console.error(' ERROR: No URLs found in sitemap. Falling back to recursive crawl.');
    return downloadSiteRecursive(baseUrl, outputPath);
  }

  // Clean old_site directory if it exists
  if (fs.existsSync(outputPath)) {
    console.log('Removing existing old_site directory...');
    fs.rmSync(outputPath, { recursive: true, force: true });
  }

  // Create output directory
  fs.mkdirSync(outputPath, { recursive: true });

  // Download each URL with progress reporting
  let succeeded = 0;
  let failed = 0;
  const total = urls.length;
  const concurrency = 5; // Number of parallel downloads

  console.log(`Downloading ${total} URLs (${concurrency} concurrent)...\n`);

  // Process URLs in batches for concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(url => downloadUrl(url, outputPath)));

    results.forEach((success, j) => {
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    });

    // Progress update every 10 batches
    if ((i / concurrency) % 10 === 0 || i + concurrency >= urls.length) {
      const percent = Math.round(((i + batch.length) / total) * 100);
      process.stdout.write(`\rProgress: ${i + batch.length}/${total} (${percent}%) - ${succeeded} succeeded, ${failed} failed`);
    }
  }

  console.log(`\n\n Downloaded ${succeeded}/${total} URLs successfully`);
  if (failed > 0) {
    console.log(` ${failed} URLs failed to download`);
  }

  // Find the domain directory created by wget
  const files = fs.readdirSync(outputPath);
  if (files.length > 0) {
    const domainDir = path.join(outputPath, files[0]);
    if (fs.statSync(domainDir).isDirectory()) {
      console.log(`\nSite saved to: ${domainDir}\n`);
      return domainDir;
    }
  }

  return outputPath;
};

/**
 * Download a website using recursive wget (fallback method)
 * @param {string} url - The URL to download
 * @param {string} outputPath - Where to save the downloaded site
 */
const downloadSiteRecursive = (url, outputPath) => {
  console.log(`Downloading site recursively from ${url}...`);
  console.log(`Output directory: ${outputPath}\n`);

  // Clean old_site directory if it exists
  if (fs.existsSync(outputPath)) {
    console.log('Removing existing old_site directory...');
    fs.rmSync(outputPath, { recursive: true, force: true });
  }

  // Create output directory
  fs.mkdirSync(outputPath, { recursive: true });

  // wget options:
  // -r: recursive
  // -l 10: max recursion depth of 10
  // -k: convert links for local viewing
  // -p: download all page requisites (images, css, js)
  // -E: adjust extension (save .html)
  // -np: don't ascend to parent directory
  // --restrict-file-names=windows: sanitize filenames
  // -P: output directory
  // -U: user agent
  const wgetCommand = `wget -r -l 10 -k -p -E -np --restrict-file-names=windows -U "${USER_AGENT}" -P "${outputPath}" "${url}"`;

  console.log('Running wget (this may take a few minutes)...');
  execSync(wgetCommand, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('\n Site downloaded successfully\n');

  // Find the domain directory created by wget
  const files = fs.readdirSync(outputPath);
  if (files.length > 0) {
    const domainDir = path.join(outputPath, files[0]);
    console.log(`Site saved to: ${domainDir}\n`);
    return domainDir;
  }

  return outputPath;
};

/**
 * Download a website - tries sitemap first, falls back to recursive crawl
 * @param {string} url - The URL to download
 * @param {string} outputPath - Where to save the downloaded site
 */
const downloadSite = async (url, outputPath) => {
  console.log(`Downloading site from ${url}...`);
  console.log(`Output directory: ${outputPath}\n`);

  return downloadFromSitemap(url, outputPath);
};

module.exports = {
  checkWget,
  downloadSite,
  downloadFromSitemap,
  downloadSiteRecursive
};

// Run if called directly
if (require.main === module) {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: node wget-site.js <url>');
    console.error('Example: node wget-site.js https://www.funprouk.co.uk');
    process.exit(1);
  }

  checkWget();
  const outputPath = path.join(__dirname, '..', 'old_site');
  downloadSite(url, outputPath).then(() => {
    console.log('Download complete!');
  }).catch((error) => {
    console.error('Download failed:', error.message);
    process.exit(1);
  });
}
