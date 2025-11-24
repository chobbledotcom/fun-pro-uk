const path = require('path');
const { readHtmlFile, listHtmlFiles } = require('./filesystem');
const config = require('../config');

/**
 * Scan all category HTML files to build a map of product slugs to their categories
 * @returns {Map<string, string[]>} Map of product slug to array of category slugs
 */
const scanProductCategories = () => {
  const productCategoriesMap = new Map();

  const categoriesDir = path.join(config.OLD_SITE_PATH, config.paths.categories);
  const categoryFiles = listHtmlFiles(categoriesDir);

  if (categoryFiles.length === 0) {
    return productCategoriesMap;
  }

  categoryFiles.forEach(file => {
    const categorySlug = file.replace('.php.html', '');
    const htmlPath = path.join(categoriesDir, file);
    const htmlContent = readHtmlFile(htmlPath);

    // Find all product links in the category page
    // Pattern: href="../products/PRODUCT-SLUG.php.html"
    const productLinkRegex = /href="\.\.\/products\/([^"]+)\.php\.html"/g;
    let match;

    while ((match = productLinkRegex.exec(htmlContent)) !== null) {
      const productSlug = match[1];

      if (!productCategoriesMap.has(productSlug)) {
        productCategoriesMap.set(productSlug, []);
      }

      const categories = productCategoriesMap.get(productSlug);
      const categoryPath = `categories/${categorySlug}.md`;
      if (!categories.includes(categoryPath)) {
        categories.push(categoryPath);
      }
    }
  });

  return productCategoriesMap;
};

module.exports = {
  scanProductCategories
};
