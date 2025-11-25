#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONTENT_DIRS = ['pages', 'products', 'categories', 'reviews'];

// Fix .html links in markdown content - replace with trailing slash URLs
const fixHtmlLinks = (content) => {
  // Match markdown links with .html extension: [text](path.html) or [text](path.html "title")
  // Replace .html with /
  return content.replace(
    /\]\(([^)"]+)\.html(\s*"[^"]*")?\)/g,
    (match, urlPath, title) => {
      // Ensure the URL ends with a trailing slash
      const cleanPath = urlPath.endsWith('/') ? urlPath : urlPath + '/';
      return title ? `](${cleanPath}${title})` : `](${cleanPath})`;
    }
  );
};

// Process each content directory
CONTENT_DIRS.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${dir} does not exist, skipping...`);
    return;
  }

  console.log(`Fixing .html links in ${dir}...`);

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  let fixedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const fixedContent = fixHtmlLinks(content);

    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent);
      console.log(`  Fixed: ${file}`);
      fixedCount++;
    }
  });

  console.log(`  ${fixedCount} files updated in ${dir}`);
});

console.log('\n.html link fixes completed!');
