import { normaliseSlug } from "#utils/slug-utils.js";

/** @type {{ eleventyComputed: Record<string, (data: *) => *> }} */
export default {
  eleventyComputed: {
    title: (data) => data.title || data.name,
    products: (data) => {
      const products = data.products || [];
      return products.map(normaliseSlug);
    },
  },
};
