/**
 * Product display order mapping
 * Desired order: Basic, Standard, Pet, Ultimate, Supreme
 */
const PRODUCT_ORDER = {
  'basic-system-539': 1,
  'standard-system-599': 2,
  'pet-package-849': 3,
  'cctv-package-1-999': 4,
  'cctv-package-2-1199-24hr-colour-cctv': 5,
  'ultimate-package-cctv-intruder-alarm-system-1549': 6,
  'supreme-package-24hr-colour-cctv-plus-intruder-alarm-system-1749': 7,
  'servicing-and-repairs': 99
};

/**
 * Find and replace patterns to apply to all generated markdown files
 * Format: { "search": "replacement" }
 */
const FIND_REPLACES = {
  ".php.html": "/",
  "Cctv": "CCTV",
  "My Alarm Security": "MyAlarm Security"
};

module.exports = {
  PRODUCT_ORDER,
  FIND_REPLACES
};
