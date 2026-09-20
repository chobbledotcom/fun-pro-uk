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
- Every visitor who unlocks the page gets all files on it; passwords are cached per browser tab (sessionStorage) so linked protected pages don't ask twice.
- To protect pages with different passwords, set `passwordEnv: "OTHER_SECRET_NAME"` in the front matter and add that secret to the workflow. Document assets use the default `PROTECTED_PAGES_PASSWORD`, so they can be unlocked from any page using the default password.
- The page's `<title>`/social preview stays public — keep it bland — and the page is marked `noindex` so search engines ignore it.
- Limitations to keep in mind: visitors need a modern browser and JavaScript; the password derives the decryption key, so it's as strong as the password; and anybody who legitimately unlocks a file can share it.
