#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONTENT_DIRS = ['pages', 'news', 'products', 'categories'];

// Fix image references in markdown content
const fixImageReferences = (content) => {
  return content
    // Fix local image references that start with ../images or /images
    .replace(/!\[([^\]]*)\]\(\.\.\/images\//g, '![$1](/images/')
    .replace(/!\[([^\]]*)\]\(\/images\//g, '![$1](/images/')

    // Fix relative image references without leading slash
    .replace(/!\[([^\]]*)\]\(images\//g, '![$1](/images/')

    // Fix any remaining ../images references in regular links
    .replace(/\[([^\]]*)\]\(\.\.\/images\//g, '[$1](/images/')
    .replace(/\[([^\]]*)\]\(\/images\//g, '[$1](/images/')

    // Fix any remaining images references without leading slash in links
    .replace(/\[([^\]]*)\]\(images\//g, '[$1](/images/');
};

// Process each content directory
CONTENT_DIRS.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${dir} does not exist, skipping...`);
    return;
  }

  console.log(`Fixing image references in ${dir}...`);

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const fixedContent = fixImageReferences(content);

    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent);
      console.log(`  Fixed: ${file}`);
    }
  });
});

console.log('Image reference fixes completed!');