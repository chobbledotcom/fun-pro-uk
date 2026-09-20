---
title: "Protected Demo"
meta_title: "Protected Documents (Demo)"
meta_description: "A demo of the password-protected documents area. The content and files below are encrypted at build time and unlocked in the browser."
layout: page
protected: true
no_index: true
---

# Protected documents demo

Everything in this box is encrypted at build time with the site's
document password. The server only ever stores the ciphertext — the
browser decrypts it locally once the password is entered, so the
original text and files never exist unprotected on the web server.

Ask us for the document password, then unlock the page to open the
sample file below. The password box shows what you type and ignores
capitalisation and extra spaces, so it isn't case sensitive:

{% protectedAsset "demo.jpg", "Open the demo document (JPG)" %}

Once unlocked, the link above points to a locally decrypted copy of the
file. Anyone without the password sees only the prompt you are looking
at now, and search engines are asked to ignore this page entirely.
