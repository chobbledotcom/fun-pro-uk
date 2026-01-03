# Site Importer

Modular site conversion tool for migrating content from the old MyAlarm Security site to the new Jekyll-based site.

## Structure

The importer is organized into separate modules for better maintainability and parallel development:

```
scripts/importer/
├── config.js                 # Configuration and paths
├── index.js                  # Main orchestrator
├── mirror-product-images.js  # Mirror product images from Cloudinary
├── converters/
│   ├── index.js                  # Exports all converters
│   ├── page-converter.js         # Converts static pages
│   ├── blog-converter.js         # Converts blog posts to news
│   ├── product-converter.js      # Converts product pages
│   ├── category-converter.js     # Converts category pages
│   ├── special-pages-converter.js # Generates special pages from data
│   ├── home-converter.js         # Converts homepage content
│   ├── blog-index-converter.js   # Generates blog index
│   └── reviews-index-converter.js # Generates reviews index
└── utils/
    ├── filesystem.js         # File operations
    ├── metadata-extractor.js # HTML metadata extraction
    ├── pandoc-converter.js   # HTML to Markdown conversion
    ├── content-processor.js  # Content cleaning and extraction
    ├── frontmatter-generator.js # YAML frontmatter generation
    ├── image-downloader.js   # Downloads embedded images
    ├── product-image-mapper.js # Maps product images for mirroring
    └── favicon-extractor.js  # Extracts favicon files
```

## Usage

Run the conversion:
```bash
# From project root
bun run import

# Or directly
node scripts/importer/index.js

# Run specific converters
node scripts/importer/index.js --only products,categories

# List available converters
node scripts/importer/index.js --list
```

### Mirroring Product Images

After the initial import, product images are still hosted on Cloudinary. To mirror them locally:

```bash
# Preview what would happen (dry run)
node scripts/importer/mirror-product-images.js --dry-run

# Mirror all product images
node scripts/importer/mirror-product-images.js

# Mirror specific products only
node scripts/importer/mirror-product-images.js --only batak-lite,batak-pro

# Run via main importer
node scripts/importer/index.js --only mirrorimages
```

### Optimizing Product Images

After mirroring images, optimize them to reduce file size:

```bash
# Preview what would happen (dry run)
optimize-images --dry-run

# Optimize all product images
optimize-images

# Or run directly
./scripts/optimize-images.sh
```

The optimization process:
1. Scans all images in `images/products/`
2. Decodes images to uncompressed pixels (avoids double-compression)
3. Resizes images over 1800px to max 1800px (longest side)
4. Compresses with mozjpeg at 95% quality (progressive, optimized)
5. Only replaces if the optimized version is smaller than original

This typically reduces total image size by 30-50% without visible quality loss.
Uses mozjpeg for superior compression compared to standard libjpeg.

**Requirements:**
- ImageMagick (for resizing and format conversion)
- mozjpeg (for optimal JPEG compression)

Both are included in the Nix development shell. If you see "mozjpeg (cjpeg) not found", run:
```bash
exit  # Exit current shell
nix develop  # Re-enter the development environment
```

The image mirroring process:
1. Scans all product markdown files for Cloudinary URLs
2. Builds a mapping of unique images to products (handling duplicates)
3. Generates smart filenames:
   - Single product: `product-name-1.jpg`, `product-name-2.jpg`, etc.
   - Multiple products sharing same image: `product-1-product-2.jpg`
4. Downloads images to `images/products/` with deduplication
5. Updates product markdown files to use local paths
6. Preserves original Cloudinary URLs in `gallery_cloudinary` field

Images are cached, so re-running is fast if images already exist.

**Important**: When re-importing products, the importer will:
- Check for existing `gallery_cloudinary` field in the markdown
- If found, use those URLs instead of extracting from HTML
- This preserves the Cloudinary → local path mapping
- Allows you to re-import without losing the image mirroring setup

## Folder Cleaning Behavior

The importer uses smart cleanup to preserve non-imported files:

**Full cleanup (all files):**
- `news/` - All files removed (only contains imported blog posts)
- `products/` - All files removed (only contains imported products)
- `categories/` - All files removed (only contains imported categories)
- `pages/` - All files removed (all pages now generated from old_site or by special-pages-converter)
- `assets/favicon/` - All files removed (only contains imported favicons)

**Selective cleanup (only imported files):**
- `reviews/` - Only deletes product reviews from old_site (preserves Google reviews with `-google-` in filename)

**Preserved folders (never cleaned, cached between runs):**
- `images/` - All images preserved for caching (subdirectories for products, pages, etc.)

**Protected folders (never touched):**
- `.git/`, `scripts/`, `old_site/`, `css/`, `app/`, `_data/`, `_includes/`, `_layouts/`

**How it works:**

The `prepDir()` function accepts an optional filter function:
```javascript
prepDir(dir, shouldDelete)  // shouldDelete(filename) returns true to delete
```

Examples:
```javascript
// Delete all files
prepDir(outputDir);

// Delete only specific files (preserve others)
const googleReviews = (filename) => !filename.includes('-google-');
prepDir(outputDir, googleReviews);
```

This ensures:
- Fresh content on each import
- No stale files from previous runs
- Google reviews are not deleted
- Protected folders remain intact

## Module Responsibilities

### Config (`config.js`)
- Defines input/output paths
- Stores default values
- Central configuration

### Converters
Each converter handles a specific content type:
- **page-converter**: Static pages from old_site/pages/
- **special-pages-converter**: Generates special pages (home, products, service-areas, not-found, thank-you, blog, reviews) from old_site data
- **blog-converter**: Blog posts → news articles
- **product-converter**: Product pages with pricing
- **category-converter**: Category landing pages
- **home-converter**: Homepage content (banners, features, etc.)
- **blog-index-converter**: Blog index page
- **reviews-index-converter**: Reviews index page

### Utils

#### `filesystem.js`
- Directory creation
- File reading/writing
- HTML file listing

#### `metadata-extractor.js`
- Extracts title, description, og:tags
- Extracts prices (products)
- Extracts categories (products)
- Extracts dates (blog posts)

#### `pandoc-converter.js`
- Converts HTML to Markdown via pandoc

#### `content-processor.js`
- Removes navigation/footer elements
- Cleans inline styles
- Removes pandoc artifacts
- Normalizes whitespace

#### `frontmatter-generator.js`
- Generates YAML frontmatter for each content type
- Ensures consistent field ordering

## Adding New Features

### To modify content cleaning:
Edit `utils/content-processor.js`

### To add new metadata fields:
1. Extract in `utils/metadata-extractor.js`
2. Add to frontmatter in `utils/frontmatter-generator.js`
3. Update relevant converter

### To add a new content type:
1. Create `converters/new-type-converter.js`
2. Export from `converters/index.js`
3. Add to orchestrator in `index.js`

## Dependencies

- Node.js built-in modules only
- pandoc (system dependency for HTML→Markdown conversion)

## Output

Converted files are placed in:
- `/pages/` - Static pages
- `/news/` - Blog posts
- `/products/` - Product pages (permalink: `/{slug}/` to match old site)
- `/categories/` - Category pages (permalink: `/category/{slug}/` to match old site)

Each file includes appropriate Eleventy frontmatter.