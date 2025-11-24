const path = require('path');
const fs = require('fs');

// Configuration for the importer
const config = {
  OLD_SITE_PATH: path.join(__dirname, '../../old_site'),
  OUTPUT_BASE: path.join(__dirname, '../..'),

  // Default values for content
  DEFAULT_DATE: '2020-01-01',

  // Paths for different content types
  paths: {
    pages: 'pages',
    news: 'news', // Output directory for blog posts
    products: 'products',
    categories: 'categories',
    blog: 'blog', // Source directory in old site
    favicon: 'assets/favicon'
  }
};

// Load importer options
const loadOptions = () => {
  const optionsPath = path.join(__dirname, '../../_data/importer-options.json');
  if (fs.existsSync(optionsPath)) {
    try {
      return JSON.parse(fs.readFileSync(optionsPath, 'utf8'));
    } catch (error) {
      console.warn('Warning: Failed to parse importer-options.json, using defaults');
      return {};
    }
  }
  return {};
};

config.options = loadOptions();

module.exports = config;