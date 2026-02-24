#!/usr/bin/env bun

/**
 * Verify that all old site URLs either return 200 or 301 redirect
 * on the live site. Reports any paths that return 404 or other errors.
 *
 * Usage:
 *   bun scripts/verify-live-urls.js [--base-url https://www.funprouk.co.uk]
 */

const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const oldSite = path.join(root, "old_site");

// Parse args
const args = process.argv.slice(2);
let baseUrl = "https://www.funprouk.co.uk";
const baseUrlIndex = args.indexOf("--base-url");
if (baseUrlIndex !== -1 && args[baseUrlIndex + 1]) {
  baseUrl = args[baseUrlIndex + 1].replace(/\/$/, "");
}

// Directories/files to ignore in old site (non-content)
const IGNORE_PATHS = new Set([
  "/theme",
  "/Controls",
  "/userfiles",
  "/images",
  "/login",
  "/robots",
]);

// Patterns to ignore
const IGNORE_PATTERNS = [
  /^\/news\/\d+$/, // Pagination pages like /news/2, /news/4
];

// Extract paths from old site .html files
function getOldSitePaths() {
  const paths = [];

  function walkDir(dir, prefix = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(prefix, entry.name);

      if (entry.isDirectory()) {
        const dirPath = "/" + prefix.replace(/\\/g, "/");
        if (
          IGNORE_PATHS.has(dirPath) ||
          IGNORE_PATHS.has("/" + entry.name)
        ) {
          continue;
        }
        walkDir(fullPath, relativePath);
      } else if (entry.name.endsWith(".html")) {
        const pathName = entry.name.replace(".html", "");
        let urlPath;

        if (prefix) {
          urlPath =
            "/" + path.join(prefix, pathName).replace(/\\/g, "/");
        } else {
          urlPath = "/" + pathName;
        }

        // Skip ignored paths
        if (IGNORE_PATHS.has(urlPath)) {
          continue;
        }

        // Skip pagination and other patterns
        if (IGNORE_PATTERNS.some((pattern) => pattern.test(urlPath))) {
          continue;
        }

        paths.push(urlPath);
      }
    }
  }

  walkDir(oldSite);
  return paths.sort();
}

// Check a single URL, following redirects manually to track the chain
async function checkUrl(urlPath) {
  const fullUrl = baseUrl + urlPath;
  const result = {
    oldPath: urlPath,
    url: fullUrl,
    status: null,
    redirectChain: [],
    finalUrl: null,
    error: null,
  };

  try {
    // First request: don't follow redirects so we can see 301s
    const response = await fetch(fullUrl, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "FunProUK-URLVerifier/1.0 (redirect check script)",
      },
    });

    result.status = response.status;

    if (response.status >= 300 && response.status < 400) {
      // It's a redirect - follow the chain
      let currentUrl = response.headers.get("location");
      result.redirectChain.push({
        status: response.status,
        location: currentUrl,
      });

      // Follow up to 10 redirects
      let hops = 0;
      while (currentUrl && hops < 10) {
        // Resolve relative URLs
        if (currentUrl.startsWith("/")) {
          currentUrl = baseUrl + currentUrl;
        }

        const nextResponse = await fetch(currentUrl, {
          redirect: "manual",
          headers: {
            "User-Agent":
              "FunProUK-URLVerifier/1.0 (redirect check script)",
          },
        });

        if (
          nextResponse.status >= 300 &&
          nextResponse.status < 400
        ) {
          const nextLocation =
            nextResponse.headers.get("location");
          result.redirectChain.push({
            status: nextResponse.status,
            location: nextLocation,
          });
          currentUrl = nextLocation;
          hops++;
        } else {
          result.finalUrl = currentUrl;
          result.finalStatus = nextResponse.status;
          break;
        }
      }

      if (!result.finalUrl) {
        result.finalUrl = currentUrl;
      }
    } else {
      result.finalUrl = fullUrl;
      result.finalStatus = response.status;
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

// Rate-limited batch processing
async function checkAllUrls(paths, concurrency = 5) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < paths.length) {
      const i = index++;
      const urlPath = paths[i];
      const pct = Math.round(((i + 1) / paths.length) * 100);
      process.stdout.write(
        `\r  Checking ${i + 1}/${paths.length} (${pct}%) - ${urlPath.substring(0, 60).padEnd(60)}`
      );
      const result = await checkUrl(urlPath);
      results.push(result);
      // Small delay to be polite to the server
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Run workers concurrently
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  process.stdout.write("\r" + " ".repeat(120) + "\r");
  return results;
}

// Main
async function main() {
  console.log("=".repeat(80));
  console.log("LIVE URL VERIFICATION REPORT");
  console.log(`Base URL: ${baseUrl}`);
  console.log("=".repeat(80));
  console.log();

  const oldPaths = getOldSitePaths();
  console.log(`Found ${oldPaths.length} paths from old site to verify.\n`);

  console.log("Checking URLs against live site...\n");
  const results = await checkAllUrls(oldPaths, 5);

  // Categorize results
  const ok200 = [];
  const redirected = [];
  const notFound = [];
  const serverErrors = [];
  const networkErrors = [];
  const otherErrors = [];

  for (const r of results) {
    if (r.error) {
      networkErrors.push(r);
    } else if (r.status === 200) {
      ok200.push(r);
    } else if (r.status >= 300 && r.status < 400) {
      // Check if redirect ultimately lands on a 200
      if (r.finalStatus === 200) {
        redirected.push(r);
      } else if (r.finalStatus === 404) {
        notFound.push(r);
      } else {
        otherErrors.push(r);
      }
    } else if (r.status === 404) {
      notFound.push(r);
    } else if (r.status >= 500) {
      serverErrors.push(r);
    } else {
      otherErrors.push(r);
    }
  }

  // Summary
  console.log("SUMMARY");
  console.log("-".repeat(80));
  console.log(
    `  200 OK:              ${ok200.length}/${results.length}`
  );
  console.log(
    `  301/302 Redirect:    ${redirected.length}/${results.length}`
  );
  console.log(
    `  404 Not Found:       ${notFound.length}/${results.length}`
  );
  console.log(
    `  5xx Server Error:    ${serverErrors.length}/${results.length}`
  );
  console.log(
    `  Network Error:       ${networkErrors.length}/${results.length}`
  );
  console.log(
    `  Other:               ${otherErrors.length}/${results.length}`
  );
  console.log();

  const totalOk = ok200.length + redirected.length;
  console.log(
    `  Total OK (200 + redirects to 200): ${totalOk}/${results.length} (${Math.round((totalOk / results.length) * 100)}%)`
  );
  console.log();

  // Print redirects
  if (redirected.length > 0) {
    console.log("REDIRECTED (old path -> new location)");
    console.log("-".repeat(80));
    for (const r of redirected) {
      const chain = r.redirectChain
        .map((c) => `${c.status} -> ${c.location}`)
        .join(" -> ");
      console.log(`  ${r.oldPath}`);
      console.log(`    ${chain}`);
    }
    console.log();
  }

  // Print 404s - this is the main thing the user wants
  if (notFound.length > 0) {
    console.log("404 NOT FOUND - These old URLs are broken:");
    console.log("-".repeat(80));
    for (const r of notFound) {
      if (r.redirectChain.length > 0) {
        const chain = r.redirectChain
          .map((c) => `${c.status} -> ${c.location}`)
          .join(" -> ");
        console.log(`  ${r.oldPath} (redirects then 404: ${chain})`);
      } else {
        console.log(`  ${r.oldPath}`);
      }
    }
    console.log();
  }

  // Print server errors
  if (serverErrors.length > 0) {
    console.log("SERVER ERRORS (5xx):");
    console.log("-".repeat(80));
    for (const r of serverErrors) {
      console.log(`  ${r.oldPath} -> ${r.status}`);
    }
    console.log();
  }

  // Print network errors
  if (networkErrors.length > 0) {
    console.log("NETWORK ERRORS:");
    console.log("-".repeat(80));
    for (const r of networkErrors) {
      console.log(`  ${r.oldPath} -> ${r.error}`);
    }
    console.log();
  }

  // Print other errors
  if (otherErrors.length > 0) {
    console.log("OTHER STATUS CODES:");
    console.log("-".repeat(80));
    for (const r of otherErrors) {
      console.log(`  ${r.oldPath} -> ${r.status}`);
    }
    console.log();
  }

  console.log("=".repeat(80));

  if (notFound.length > 0) {
    console.log(
      `\n${notFound.length} old URL(s) are returning 404 on the live site.`
    );
    process.exit(1);
  } else {
    console.log(
      "\nAll old URLs are accounted for (200 or redirect to 200)."
    );
    process.exit(0);
  }
}

main();
