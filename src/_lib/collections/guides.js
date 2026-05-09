import { createFieldIndexer } from "#utils/collection-utils.js";

/** Index guides by category for O(1) lookups, cached per guides array */
const indexByGuideCategory = createFieldIndexer("guide-category");

/**
 * @param {import("#lib/types").EleventyCollectionItem[]} guidePages
 * @param {string} categorySlug
 * @returns {import("#lib/types").EleventyCollectionItem[]}
 */
const guidesByCategory = (guidePages, categorySlug) =>
  indexByGuideCategory(guidePages)[categorySlug] ?? [];

/** @param {*} eleventyConfig */
const configureGuides = (eleventyConfig) => {
  eleventyConfig.addFilter("guidesByCategory", guidesByCategory);
};

export { configureGuides, guidesByCategory };
