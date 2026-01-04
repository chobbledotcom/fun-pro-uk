# Chobble Template Test Failures Report

When running the chobble-template test suite against this site, **8 tests fail** out of 1,246 total tests. This document identifies issues that need to be addressed in the **chobble-template** repository.

---

## 1. Reviews Pagination Tests (5 failures)

### Affected Tests
- `test/collections/properties.test.js`
  - "Returns only properties exceeding the truncate limit"
  - "Returns redirect data for properties not needing separate pages"
- `test/collections/reviews.test.js`
  - "Returns only items exceeding the truncate limit"
  - "Transforms items through the optional processItem callback"
  - "Returns redirect data for items not needing separate pages"

### Root Cause
There's a mismatch between test assumptions and production code regarding the `reviews_truncate_limit` config value.

**In tests** (`reviews.test.js:21`):
```javascript
const TRUNCATE_LIMIT = configData.reviews_truncate_limit || 10;
```

**In production code** (`src/_lib/collections/reviews.js:124-125`):
```javascript
const getReviewsLimit = (limitOverride) =>
  limitOverride !== undefined ? limitOverride : config().reviews_truncate_limit;
```

When an inheriting site's `config.json` doesn't define `reviews_truncate_limit`, the tests use the fallback value of `10`, but the production code returns `undefined`. This causes comparisons like `countReviews(...) > undefined` to always return `false`, filtering out all items.

### Suggested Fix
Add a fallback to `getReviewsLimit()` in `reviews.js`:
```javascript
const DEFAULT_REVIEWS_LIMIT = 10;

const getReviewsLimit = (limitOverride) =>
  limitOverride !== undefined
    ? limitOverride
    : (config().reviews_truncate_limit ?? DEFAULT_REVIEWS_LIMIT);
```

---

## 2. Unused CSS Class (1 failure)

### Affected Test
- `test/code-quality/unused-classes.test.js`
  - "Scans project files and reports unused classes/IDs"

### Issue
The class `homepage-events` is defined in `src/_layouts/home.html:51` but has no corresponding CSS rule:
```html
{%- render_snippet "homepage-events-header", "<h3>Regular Events</h3>" -%}
```

### Suggested Fix
Either:
1. Add CSS styling for `.homepage-events` class
2. Remove the unused class from the layout if it's not needed

---

## 3. Code Duplication Threshold Exceeded (1 failure)

### Affected Test
- `test/code-quality/cpd.test.js`
  - "code duplication stays within threshold"

### Issue
The copy-paste detector found **28 code clones** (0.96% duplication), which exceeds the configured threshold. Notable duplications include:

| Location | Lines | Tokens |
|----------|-------|--------|
| `test/frontend/theme-editor.test.js` (two locations) | 11 | 83 |
| `test/frontend/config.test.js` / `test/utils/helpers.test.js` | 7 | 72 |
| `test/filters/item-filters.test.js` (two locations) | 15 | 111 |
| `test/build/autosizes.test.js` (two locations) | 12 | 97 |
| `src/assets/js/template.js` / `test/frontend/template.test.js` | 12 | 120 |
| `src/_includes/email-link.html` / `src/_includes/phone-link.html` | 10 | 65 |

### Suggested Fix
1. Extract common test helpers into shared utility functions
2. Consider abstracting similar HTML include patterns
3. Review and refactor duplicated code in test files

---

## Summary

| Issue | Test File | Type | Severity |
|-------|-----------|------|----------|
| Missing default for `reviews_truncate_limit` | properties.test.js, reviews.test.js | Bug | High |
| Unused `homepage-events` class | unused-classes.test.js | Code quality | Low |
| Code duplication exceeds threshold | cpd.test.js | Code quality | Medium |

The reviews pagination bug is the most critical issue as it affects 5 tests and could indicate a real production bug when sites don't configure `reviews_truncate_limit`.

---

## Note: Local Issues (Not Template Bugs)

The following test failure is a **local site issue**, not a template bug:

### SCSS Variables Test
- `test/build/scss.variables.test.js` - "All CSS variables used in SCSS are defined in :root"

**Issue**: The site's `css/theme.scss` uses two CSS variables that aren't defined in `:root`:
- `--background` - Used on line 6, defined only within `.homepage-header` scope (line 557)
- `--color-border` - Used on line 610, not defined anywhere

**Fix needed in this repo**: Add these variables to the `:root` block in `css/theme.scss`, or ensure they're properly scoped/defined.
