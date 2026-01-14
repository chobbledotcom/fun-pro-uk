# Screenshot Tool Setup Guide

This document explains how to get the screenshot tool working for future agents.

## Prerequisites

The screenshot tool requires two dependencies that may not be pre-installed:

### 1. rsync

The build system uses rsync to merge template files. Install it:

```bash
apt-get update && apt-get install -y rsync
```

### 2. Playwright with Chromium

The screenshot tool uses Playwright for browser automation. Install it globally with the Chromium browser:

```bash
npm install -g playwright@1.57.0
npx playwright install chromium
```

Note: The version (1.57.0) should match what's used in the template's package.json. If you see errors about missing browser executables, the versions may be mismatched.

## Using the Screenshot Tool

Once dependencies are installed, use the screenshot tool with:

```bash
# Basic usage - screenshot homepage at desktop viewport
bun run screenshot

# Mobile viewport
bun run screenshot -v mobile /

# Full-page screenshot (captures entire scrollable page)
bun run screenshot -v full-page /

# All viewports for a specific page
bun run screenshot -a /products/

# Custom output directory
bun run screenshot -d ./my-screenshots /
```

### Speed Optimization

Use the `PLACEHOLDER_IMAGES` environment variable to skip image processing and speed up builds:

```bash
PLACEHOLDER_IMAGES=1 bun run screenshot -v mobile /
```

This is highly recommended for testing/debugging as it reduces build time significantly.

## Available Viewports

- `mobile` - Mobile phone viewport (375px wide)
- `tablet` - Tablet viewport
- `desktop` - Desktop viewport (default)
- `full-page` - Full scrollable page capture

## Output

Screenshots are saved to `./screenshots/` by default, named as:
- `{page}-{viewport}.png` (e.g., `home-mobile.png`, `products-desktop.png`)

## Troubleshooting

### "Executable doesn't exist" error
This means Playwright browsers aren't installed. Run:
```bash
npx playwright install chromium
```

### "rsync: command not found"
Install rsync:
```bash
apt-get install -y rsync
```

### Pages showing "Not found"
The template merge copies files from the project root to the template's `src/` directory. Ensure your page files (in `pages/`) have correct frontmatter with `permalink` set.

## How It Works

The screenshot tool:
1. Creates a temp directory
2. Clones the chobble-template repository
3. Merges your site content into the template
4. Runs the Eleventy build
5. Starts a local server
6. Uses Playwright to capture screenshots
7. Copies screenshots to your output directory
8. Cleans up the temp directory
