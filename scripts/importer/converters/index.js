/**
 * Export all converter modules
 */

const { convertPages } = require('./page-converter');
const { convertLocations } = require('./location-converter');
const { convertBlogPosts } = require('./blog-converter');
const { convertProducts } = require('./product-converter');
const { convertCategories } = require('./category-converter');
const { convertEvents } = require('./event-converter');
const { convertHomeContent } = require('./home-converter');
const { convertBlogIndex } = require('./blog-index-converter');
const { convertReviewsIndex } = require('./reviews-index-converter');
const { convertReviews } = require('./reviews-converter');
const { convertSpecialPages } = require('./special-pages-converter');
const { convertSiteConfig } = require('./config-converter');
const { convertStaticPages } = require('./static-page-converter');

module.exports = {
  convertPages,
  convertLocations,
  convertBlogPosts,
  convertProducts,
  convertCategories,
  convertEvents,
  convertHomeContent,
  convertBlogIndex,
  convertReviewsIndex,
  convertReviews,
  convertSpecialPages,
  convertSiteConfig,
  convertStaticPages
};