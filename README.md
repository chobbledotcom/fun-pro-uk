# Fun Pro UK

This is the website for **Fun Pro UK**, a nationwide corporate entertainment and interactive game hire company. Based in Coventry and operating across the UK since 2009, they supply everything from Batak reaction games and racing simulators to photo booths, branded exhibition stands and inflatable assault courses — all delivered, set up and collected from your venue.

Built by [Chobble](https://www.chobble.com).

## Password-protected pages

Some pages (risk assessments, RAMS, staff documents) are published encrypted: the content is encrypted at build time with AES-256-GCM using a password from a build-time secret, and visitors decrypt it in their own browser with the Web Crypto API. The plaintext **never exists on the web server**, and the original documents are never uploaded — only `.enc` payloads.

### Set-up

1. In the repository: *Settings → Secrets and variables → Actions → New repository secret*, name it `PROTECTED_PAGES_PASSWORD`.
2. That's it — `.github/workflows/build-and-deploy.yml` already passes the secret to the build as an environment variable. Builds without the secret fail fast rather than publishing a "protected" page in the clear.

### Publishing a protected page

Add `protected: true` to a page's front matter (e.g. `src/pages/rams.md`):

```markdown
---
title: "Staff Documents"
meta_title: "Staff Documents"
layout: page
protected: true
---

# Staff documents

{% protectedAsset "rams.pdf", "Download our RAMS (PDF)" %}
```

Notes:

- The gate UI labels live in `protected_pages` in `src/_data/strings.json`.
- Put the actual documents in `src/protected-assets/` (create the folder when you first need it) and reference them with the `protectedAsset` shortcode — plain file names only, and encrypted at build time to `_site/protected-assets/<name>.enc`.
- Pages needing a different password than the site-wide one can set `passwordEnv: "OTHER_SECRET_NAME"` in their front matter instead (register that secret in GitHub too).
- Every visitor who unlocks the page gets all files on it; passwords are cached per browser tab (sessionStorage) so linked protected pages don't ask twice.
- The page's `<title>`/social preview stays public — keep it bland — and the page is marked `noindex` so search engines ignore it.
- Limitations to keep in mind: visitors need a modern browser and JavaScript; the password derives the decryption key, so it's as strong as the password; and anybody who legitimately unlocks a file can share it.

### Editing protected pages through the CMS

The Pages CMS (`.pages.yml`) supports this out of the box:

- Pages in the CMS gain a **"Private page (needs a password to view)"** toggle and a **"Hidden files"** upload list (files go into `src/protected-assets/` via the named `protected` media source).
- Any `protected_documents` entries are rendered automatically — as encrypted download links below the page text — so editors never have to touch the `{% protectedAsset %}` shortcode (that shortcode still works for hand-authored markdown).
- The password is normalised (trimmed + lowercased) on both the build and in the browser, so typed capitalisation/spacing doesn't matter, and the gate input is a visible text field.
- Pages that need a *different* password than the site-wide one: a developer adds `passwordEnv: "OTHER_SECRET_NAME"` to the front matter by hand and registers that secret in GitHub — kept out of the CMS on purpose so nobody types the real password into the repo.
