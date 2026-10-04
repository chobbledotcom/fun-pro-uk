import strings from "#data/strings.js";
import { buildPermalink } from "#utils/slug-utils.js";

/**
 * The merged strings object mixes flat labels with the nested
 * protected_pages section, so bracket access is cast through unknown.
 * @type {Record<string, string | undefined>}
 */
const stringsByKey = /** @type {Record<string, string | undefined>} */ (
  /** @type {unknown} */ (strings)
);

/**
 * Look up a strings key by computed name.
 * @param {string} key
 * @returns {string | undefined}
 */
const getString = (key) => stringsByKey[key];

/**
 * Factory for creating 11tydata.js exports with shared eleventyComputed shape.
 *
 * Most content types need the same boilerplate: import strings, set
 * navigationParent, compute permalink via buildPermalink. This factory
 * eliminates that duplication.
 *
 * @param {string} type - String key prefix (e.g. "event" -> strings.event_name,
 *   strings.event_permalink_dir)
 * @param {Record<string, (data: *) => *>} [extraComputed] - Additional computed
 *   properties merged into eleventyComputed. These override the defaults, so
 *   a custom permalink function can be passed here.
 * @returns {{ eleventyComputed: Record<string, (data: *) => *> }}
 */
const linkableContent = (type, extraComputed = {}) => {
  const nameKey = `${type}_name`;
  const dirKey = `${type}_permalink_dir`;

  if (!getString(dirKey)) {
    throw new Error(
      `Missing strings.${dirKey} — cannot build content type data for "${type}"`,
    );
  }

  return {
    eleventyComputed: {
      navigationParent: () => getString(nameKey),
      permalink: (data) => buildPermalink(data, getString(dirKey)),
      ...extraComputed,
    },
  };
};

export { linkableContent };
