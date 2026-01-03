# Chobble Template Test Failures Report

This report documents test failures that occur when projects using `chobble-template` run the template's test suite. These failures occur because certain tests have expectations tied to template-specific content rather than testing functionality independently.

## Summary

**1073 tests pass, 10 tests fail**

The failing tests can be grouped into 5 categories:

| Category | Failing Tests | Root Cause |
|----------|---------------|------------|
| Site-specific file expectations | 2 | Tests expect template-specific pages to exist |
| Hardcoded site identifiers | 1 | PDF test expects "the-chobble-template" slug |
| Template-specific CSS variables | 1 | Tests for CSS vars that projects may override |
| Hardcoded config values | 4 | Tests assume `truncate_limit: 10` |
| Template-specific CSS classes | 2 | Tests for unused classes in project-specific layouts |

---

## Category 1: Site-specific File Expectations

### Failing Tests
- `config > validateStripePages passes with real stripe-checkout.md and order-complete.md`
- `config > validateCartConfig passes for stripe with checkout_api_url and valid pages`

### Location
`test/frontend/config.test.js` (lines 366-388)

### Problem
Tests call `validateStripePages()` which expects `src/pages/stripe-checkout.md` and `src/pages/order-complete.md` to exist. Projects using `cart_mode: "quote"` (or other modes) won't have these files.

### Current Code
```javascript
test("validateStripePages passes with real stripe-checkout.md and order-complete.md", () => {
  // These pages exist in src/pages with correct frontmatter
  validateStripePages();
  expect(true).toBe(true);
});
```

### Recommendation
These tests should be conditional based on the project's actual `cart_mode` config:

```javascript
test("validateStripePages passes when cart_mode is stripe", () => {
  const config = readConfig();
  if (config.cart_mode !== "stripe") {
    // Skip test - not applicable to this cart mode
    return;
  }
  validateStripePages();
  expect(true).toBe(true);
});
```

Or use test skipping:
```javascript
test.skipIf(readConfig().cart_mode !== "stripe")(
  "validateStripePages passes with real stripe-checkout.md and order-complete.md",
  () => { ... }
);
```

---

## Category 2: Hardcoded Site Identifiers

### Failing Test
- `pdf-integration > PDF file is generated when menu exists with categories and items`

### Location
`test/build/pdf-integration.test.js` (lines 26, 88)

### Problem
The test hardcodes `SITE_SLUG = "the-chobble-template"` and expects PDF filenames to match this pattern. Projects with different site names (e.g., "Fun Pro UK Ltd" → "fun-pro-uk-ltd") will fail.

### Current Code
```javascript
const SITE_SLUG = "the-chobble-template";

// Later in test:
expect(pdfPath.endsWith(`${SITE_SLUG}-lunch.pdf`)).toBe(true);
```

### Recommendation
Derive the site slug dynamically from `src/_data/site.json`:

```javascript
import site from "../src/_data/site.json" with { type: "json" };

const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const SITE_SLUG = slugify(site.name);

// Or simply check that *a* PDF exists with the menu slug:
test("PDF file is generated when menu exists with categories and items", async () => {
  await withTestSite({ files: [...] }, (site) => {
    const pdfPath = findPdfInMenuDir(site, "lunch");
    expect(pdfPath !== null).toBe(true);
    // Just verify it contains the menu slug, not the exact filename
    expect(pdfPath).toContain("-lunch.pdf");
  });
});
```

---

## Category 3: Template-specific CSS Variables

### Failing Test
- `scss.variables > All CSS variables used in SCSS are defined in :root`

### Location
`test/build/scss.variables.test.js` (line 138)

### Problem
The test scans SCSS files for CSS variable usage and expects all variables to be defined in `:root`. Projects may use additional CSS variables (e.g., `--background`, `--color-border`) that aren't in the template's default style definitions.

### Detected Variables
```
--background
--color-border
```

### Recommendation
Option A: Maintain an allowlist of project-specific variables that can be defined at the project level:

```javascript
const PROJECT_VARIABLES_ALLOWLIST = [
  "--background",
  "--color-border",
  // Projects can extend this list
];

// Filter out allowlisted variables before failing
const undefinedVars = found.filter(v =>
  !definedVars.has(v) &&
  !CONSUMED_VIA_JS.includes(v) &&
  !PROJECT_VARIABLES_ALLOWLIST.includes(v)
);
```

Option B: Allow projects to provide a `.test-config.json` file listing expected variables:

```javascript
const projectConfig = fs.existsSync(".test-config.json")
  ? JSON.parse(fs.readFileSync(".test-config.json"))
  : {};
const extraVars = projectConfig.cssVariables || [];
```

---

## Category 4: Hardcoded Config Values

### Failing Tests
- `properties > Returns only properties exceeding the truncate limit`
- `properties > Returns redirect data for properties not needing separate pages`
- `reviews > Returns only items exceeding the truncate limit`
- `reviews > Transforms items through the optional processItem callback`
- `reviews > Returns redirect data for items not needing separate pages`

### Locations
- `test/collections/properties.test.js` (lines 201, 237)
- `test/collections/reviews.test.js` (lines 382, 395, 416)

### Problem
These tests assume a `truncate_limit` of 10 and create mock data with 11 and 10 reviews to test boundary conditions. If the project has a different (or undefined) `truncate_limit`, the tests fail.

### Current Code
```javascript
// 11 reviews for product-a (above limit of 10), 10 for product-b (at limit)
const reviews = [
  ...createReviews("product-a", 11, 5, "01"),
  ...createReviews("product-b", 10, 4, "02"),
];
```

### Recommendation
Read the actual config value and create test data relative to it:

```javascript
import config from "../src/_data/config.json" with { type: "json" };

const TRUNCATE_LIMIT = config.truncate_limit || 10; // Default to 10 if not set

test("Returns only items exceeding the truncate limit", () => {
  const reviews = [
    ...createReviews("product-a", TRUNCATE_LIMIT + 1, 5, "01"), // Above limit
    ...createReviews("product-b", TRUNCATE_LIMIT, 4, "02"),     // At limit
  ];
  // ...
});
```

---

## Category 5: Template-specific CSS Classes

### Failing Test
- `unused-classes > Scans project files and reports unused classes/IDs`

### Location
`test/code-quality/unused-classes.test.js` (line 425)

### Problem
The test scans all layout/template files for CSS class definitions and flags any that aren't used in SCSS/CSS. Projects may have layout files with classes that are used conditionally or in project-specific contexts.

### Detected Unused Classes
```
homepage-events (in src/_layouts/home.html)
```

### Recommendation
Option A: Allow projects to provide an allowlist of intentionally unused or conditionally-used classes:

```javascript
const ALLOWLIST_PATH = ".unused-classes-allowlist.json";
const allowlist = fs.existsSync(ALLOWLIST_PATH)
  ? JSON.parse(fs.readFileSync(ALLOWLIST_PATH))
  : [];

const unusedClasses = detected.filter(c => !allowlist.includes(c));
```

Option B: Change the test to warn rather than fail, letting projects decide severity:

```javascript
if (unusedClasses.length > 0) {
  console.warn(`⚠️ Found ${unusedClasses.length} potentially unused classes`);
  // Don't fail - just report
}
```

---

## General Recommendations

### 1. Use Config-Driven Test Expectations
Tests should read configuration from `src/_data/config.json` and `src/_data/site.json` rather than hardcoding values that may differ between projects.

### 2. Support Project-Level Overrides
Allow projects to provide `.test-config.json` or similar files to customize test behavior:

```json
{
  "cssVariablesAllowlist": ["--background", "--color-border"],
  "unusedClassesAllowlist": ["homepage-events"],
  "skipTests": ["validateStripePages"]
}
```

### 3. Conditional Test Execution
Tests that only apply to certain configurations should check the config and skip when not applicable:

```javascript
test.skipIf(condition)("test name", () => { ... });
```

### 4. Separate Template Tests from Project Tests
Consider categorizing tests:
- **Core tests**: Test template functionality with mock data (should always pass)
- **Integration tests**: Test with actual project content (may need project-specific config)

---

## Files That Need Updates

| File | Changes Needed |
|------|----------------|
| `test/frontend/config.test.js` | Make stripe page tests conditional on `cart_mode` |
| `test/build/pdf-integration.test.js` | Derive `SITE_SLUG` from `site.json` |
| `test/build/scss.variables.test.js` | Support allowlist for project CSS variables |
| `test/collections/properties.test.js` | Read `truncate_limit` from config |
| `test/collections/reviews.test.js` | Read `truncate_limit` from config |
| `test/code-quality/unused-classes.test.js` | Support project allowlist |

---

*Report generated for: fun-pro-uk project using chobble-template*
