# fun-pro-uk

Static site for fun-pro.uk, built with Eleventy.

## Quick Start

1. **Add your content** - Edit markdown files and images under `src/`
2. **Push to GitHub** - The site builds automatically via GitHub Actions
3. **Deploy happens automatically** - Site deploys to Bunny CDN

## What Goes Where

All site content lives under `src/`. The `.pages.yml` defines content types
exposed via the CMS:

- `src/pages/` - Static pages with navigation
- `src/news/` - Blog posts with dates
- `src/products/` - Product listings
- `src/categories/` - Product categories
- `src/team/` - Team member profiles
- `src/reviews/` - Customer testimonials
- `src/events/` - Events
- `src/locations/` - Service locations
- `src/case-studies/` - Case studies
- `src/snippets/` - Reusable content bits
- `src/images/` - All site images

## Configuration

The following GitHub secrets are used by the build:

- `BUNNY_*` - Bunny CDN deployment credentials
- `FORMSPARK_ID` - Contact form provider (optional)
- `BOTPOISON_PUBLIC_KEY` - Spam protection (optional)

## Local Development

```sh
bun install
bun run serve   # dev server with incremental rebuilds
bun run build   # production build into ./_site
bun run test    # run the test suite
```

A Nix flake is provided for a reproducible dev shell:

```sh
nix develop
```
