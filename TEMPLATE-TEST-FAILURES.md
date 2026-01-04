# Chobble Template Test Failures Report

**Status: All tests now pass (1246/1246)**

This document tracked test failures when running the chobble-template test suite against this site. All issues have been resolved.

---

## Resolved Issues

### 1. Reviews Pagination Tests (5 failures) - FIXED IN TEMPLATE

The template was updated to add a default fallback for `reviews_truncate_limit` in `getReviewsLimit()`.

### 2. Unused CSS Class (1 failure) - FIXED LOCALLY

Added `.homepage-events` styling by combining it with `.homepage-products` in `css/theme.scss`.

### 3. SCSS Variables Test (1 failure) - FIXED LOCALLY

Removed custom CSS variables (`--background`, `--color-border`) that weren't defined in the template's `style.scss`. Applied background styles directly in themed sections instead of via CSS variables.

### 4. Code Duplication (1 failure) - FIXED IN TEMPLATE

The template was updated to reduce code duplication below the threshold.

---

## Summary

All 1246 tests now pass. The fixes were split between:
- **Template fixes**: Reviews pagination default, code duplication
- **Local fixes**: SCSS variables, unused CSS class
