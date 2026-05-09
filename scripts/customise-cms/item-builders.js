/**
 * Field builders for item-style collections.
 *
 * "Item" collections share the standard layout (title/subtitle/thumbnail/order
 * on top, body/header/meta on bottom) wrapped around a collection-specific
 * middle section — see `buildItem` in `generator-helpers.js`. A few
 * collections (news, reviews, menu-items, menu-categories, guide-pages) use
 * `withEnabled` directly instead because their field order diverges from the
 * standard item layout.
 */

import {
  categoriesRef,
  productsRefList,
} from "#scripts/customise-cms/field-builders.js";
import {
  COMMON_FIELDS,
  createReferenceField,
  FEATURES_FIELD,
  FILTER_ATTRIBUTES_FIELD,
  KEYWORDS_FIELD,
  PRODUCT_OPTIONS_FIELD,
} from "#scripts/customise-cms/fields.js";
import {
  buildItem,
  getContentFields,
  getItemBottom,
  getItemTop,
  META_FIELDS,
  withEnabled,
} from "#scripts/customise-cms/generator-helpers.js";

/**
 * @typedef {import('./generator-helpers.js').CmsConfig} CmsConfig
 * @typedef {import('./generator-helpers.js').CmsField} CmsField
 * @typedef {import('./generator-helpers.js').FieldContext} FieldContext
 */

/**
 * Build fields for the news collection
 * @param {CmsConfig} config - CMS configuration
 * @param {FieldContext} fields - Precomputed fields
 * @returns {CmsField[]} News collection fields
 */
export const buildNewsFields = (config, fields) =>
  withEnabled((enabled) => [
    COMMON_FIELDS.title,
    config.features.header_images && COMMON_FIELDS.header_image,
    { name: "date", label: "Date", type: "date" },
    enabled("team") && createReferenceField("author", "Author", "team", false),
    ...getContentFields(config, fields),
    config.features.no_index && COMMON_FIELDS.no_index,
  ])(config);

/**
 * Build fields for the products collection
 * @param {CmsConfig} config - CMS configuration
 * @param {FieldContext} fields - Precomputed fields
 * @returns {CmsField[]} Products collection fields
 */
export const buildProductsFields = (config, fields) => {
  const [title, subtitle, thumbnail, order] = getItemTop();
  return withEnabled((enabled) => [
    title,
    subtitle,
    thumbnail,
    { name: "price", type: "string", label: "Price" },
    order,
    categoriesRef(enabled),
    enabled("events") && createReferenceField("events", "Events", "events"),
    PRODUCT_OPTIONS_FIELD,
    config.features.external_purchases && {
      name: "purchase_url",
      label: "Purchase URL",
      type: "string",
    },
    config.features.features && FEATURES_FIELD,
    config.features.keywords && KEYWORDS_FIELD,
    FILTER_ATTRIBUTES_FIELD,
    ...getItemBottom(config, fields),
  ])(config);
};

/**
 * Build fields for the reviews collection
 * @param {CmsConfig} config - CMS configuration
 * @param {FieldContext} fields - Precomputed fields
 * @returns {CmsField[]} Reviews collection fields
 */
export const buildReviewsFields = (config, fields) =>
  withEnabled((enabled) => [
    COMMON_FIELDS.name,
    { name: "rating", type: "number", label: "Rating" },
    fields.body,
    enabled("products") &&
      createReferenceField("products", "Products", "products"),
  ])(config);

/**
 * Build fields for the case-studies collection
 * @param {CmsConfig} config - CMS configuration
 * @param {FieldContext} fields - Precomputed fields
 * @returns {CmsField[]} Case studies collection fields
 */
export const buildCaseStudiesFields = (config, fields) =>
  withEnabled(() => [
    COMMON_FIELDS.title,
    COMMON_FIELDS.subtitle,
    COMMON_FIELDS.thumbnail,
    fields.body,
    ...META_FIELDS,
    config.features.no_index && COMMON_FIELDS.no_index,
    { name: "layout", type: "string", label: "Layout" },
    config.features.permalinks && COMMON_FIELDS.permalink,
    config.features.redirects && COMMON_FIELDS.redirect_from,
  ])(config);

/**
 * Build fields for the events collection
 * @param {CmsConfig} config - CMS configuration
 * @param {FieldContext} fields - Precomputed fields
 * @returns {CmsField[]} Events collection fields
 */
export const buildEventsFields = (config, fields) =>
  buildItem((enabled) => [
    COMMON_FIELDS.featured,
    config.features.event_locations_and_dates && {
      name: "event_date",
      label: "Event Date",
      type: "date",
      required: false,
    },
    config.features.event_locations_and_dates && {
      name: "recurring_date",
      type: "string",
      label: 'Recurring Date (e.g. "Every Friday at 2 PM")',
      required: false,
    },
    config.features.event_locations_and_dates && {
      name: "event_location",
      type: "string",
      label: "Event Location",
    },
    productsRefList(enabled),
    config.features.event_locations_and_dates && {
      name: "map_embed_src",
      type: "string",
      label: "Map Embed URL",
      required: false,
    },
  ])(config, fields);

/**
 * Build fields for the locations collection
 * @param {CmsConfig} config - CMS configuration
 * @param {FieldContext} fields - Precomputed fields
 * @returns {CmsField[]} Locations collection fields
 */
export const buildLocationsFields = (config, fields) =>
  buildItem((enabled) => [categoriesRef(enabled)])(config, fields);

/**
 * Build fields for the guide-pages collection
 * @param {CmsConfig} config - CMS configuration
 * @param {FieldContext} fields - Precomputed fields
 * @returns {CmsField[]} Guide pages collection fields
 */
export const buildGuidePagesFields = (config, fields) =>
  withEnabled((enabled) => [
    COMMON_FIELDS.title,
    COMMON_FIELDS.subtitle,
    enabled("guide-categories") &&
      createReferenceField(
        "guide-category",
        "Guide Category",
        "guide-categories",
        false,
      ),
    COMMON_FIELDS.order,
    fields.body,
  ])(config);
