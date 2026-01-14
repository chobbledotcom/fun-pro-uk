import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, relative } from "node:path";
import { path, read, write } from "./utils.js";
import { parse as parseYaml } from "yaml";

// Parse frontmatter using proper YAML parser
const parseFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: "" };

  try {
    const data = parseYaml(match[1]) || {};
    const body = match[2].trim();
    return { data, body };
  } catch (e) {
    console.error("YAML parse error:", e.message);
    return { data: {}, body: match[2].trim() };
  }
};

// Get all markdown files recursively
const getMarkdownFiles = (dir) => {
  const files = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getMarkdownFiles(fullPath));
    } else if (item.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
};

// Check if body is empty or minimal
const isBodyEmpty = (body) => {
  const cleaned = body
    .replace(/^#\s+.*$/gm, "") // Remove headings that just repeat title
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length < 50;
};

// Main report generation
const generateReport = async () => {
  const issues = {
    products: {
      tbdSpecs: [],
      tbdFilterAttributes: [],
      missingFeatures: [],
      missingFaqs: [],
      missingThumbnail: [],
      emptyTabs: [],
    },
    categories: {
      missingFaqs: [],
      emptyBody: [],
    },
    events: {
      missingFaqs: [],
      emptyBody: [],
      missingThumbnail: [],
    },
    locations: {
      emptyBody: [],
      missingThumbnail: [],
      missingFaqs: [],
    },
  };

  // Process products
  const productsDir = path("products");
  if (existsSync(productsDir)) {
    const productFiles = getMarkdownFiles(productsDir);

    for (const file of productFiles) {
      const content = await read(file);
      const { data, body } = parseFrontmatter(content);
      const name = data.title || basename(file, ".md");
      const relPath = relative(path(), file);

      // Check for TBD specs
      if (data.specs && Array.isArray(data.specs)) {
        const tbdSpecs = data.specs.filter(
          (s) => s.value && String(s.value).toUpperCase() === "TBD"
        );
        if (tbdSpecs.length > 0) {
          issues.products.tbdSpecs.push({
            file: relPath,
            name,
            specs: tbdSpecs.map((s) => s.name),
          });
        }
      }

      // Check for TBD filter attributes
      if (data.filter_attributes && Array.isArray(data.filter_attributes)) {
        const tbdAttrs = data.filter_attributes.filter(
          (a) => a.value && String(a.value).toUpperCase() === "TBD"
        );
        if (tbdAttrs.length > 0) {
          issues.products.tbdFilterAttributes.push({
            file: relPath,
            name,
            attributes: tbdAttrs.map((a) => a.name),
          });
        }
      }

      // Check for missing features
      if (!data.features || data.features.length === 0) {
        issues.products.missingFeatures.push({ file: relPath, name });
      }

      // Check for missing FAQs
      if (!data.faqs || data.faqs.length === 0) {
        issues.products.missingFaqs.push({ file: relPath, name });
      }

      // Check for missing thumbnail (only if no gallery either)
      if (!data.thumbnail && (!data.gallery || data.gallery.length === 0) && (!data.gallery_cloudinary || data.gallery_cloudinary.length === 0)) {
        issues.products.missingThumbnail.push({ file: relPath, name });
      }

      // Check for empty tabs
      if (data.tabs && Array.isArray(data.tabs)) {
        const emptyTabs = data.tabs.filter((t) => !t.body || t.body.trim() === "");
        if (emptyTabs.length > 0) {
          issues.products.emptyTabs.push({
            file: relPath,
            name,
            tabs: emptyTabs.map((t) => t.title),
          });
        }
      }
    }
  }

  // Process categories
  const categoriesDir = path("categories");
  if (existsSync(categoriesDir)) {
    const categoryFiles = getMarkdownFiles(categoriesDir);

    for (const file of categoryFiles) {
      const content = await read(file);
      const { data, body } = parseFrontmatter(content);
      const name = data.title || basename(file, ".md");
      const relPath = relative(path(), file);

      // Check for missing FAQs
      if (!data.faqs || data.faqs.length === 0) {
        issues.categories.missingFaqs.push({ file: relPath, name });
      }

      // Check for empty body
      if (isBodyEmpty(body)) {
        issues.categories.emptyBody.push({ file: relPath, name });
      }
    }
  }

  // Process events
  const eventsDir = path("events");
  if (existsSync(eventsDir)) {
    const eventFiles = getMarkdownFiles(eventsDir);

    for (const file of eventFiles) {
      const content = await read(file);
      const { data, body } = parseFrontmatter(content);
      const name = data.title || basename(file, ".md");
      const relPath = relative(path(), file);

      // Check for missing FAQs
      if (!data.faqs || data.faqs.length === 0) {
        issues.events.missingFaqs.push({ file: relPath, name });
      }

      // Check for empty body
      if (isBodyEmpty(body)) {
        issues.events.emptyBody.push({ file: relPath, name });
      }

      // Check for missing thumbnail
      if (!data.thumbnail) {
        issues.events.missingThumbnail.push({ file: relPath, name });
      }
    }
  }

  // Process locations
  const locationsDir = path("locations");
  if (existsSync(locationsDir)) {
    const locationFiles = getMarkdownFiles(locationsDir);

    for (const file of locationFiles) {
      const content = await read(file);
      const { data, body } = parseFrontmatter(content);
      const name = data.title || basename(file, ".md");
      const relPath = relative(path(), file);

      // Check for empty body
      if (isBodyEmpty(body)) {
        issues.locations.emptyBody.push({ file: relPath, name });
      }

      // Check for missing thumbnail
      if (!data.thumbnail) {
        issues.locations.missingThumbnail.push({ file: relPath, name });
      }

      // Check for missing FAQs
      if (!data.faqs || data.faqs.length === 0) {
        issues.locations.missingFaqs.push({ file: relPath, name });
      }
    }
  }

  return issues;
};

// Format report as human-readable text
const formatReport = (issues) => {
  const lines = [];
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  lines.push(`# Missing Information Report`);
  lines.push(`Generated: ${date}\n`);

  // Summary
  lines.push(`## Summary\n`);

  const productIssues =
    issues.products.tbdSpecs.length +
    issues.products.tbdFilterAttributes.length +
    issues.products.missingFeatures.length +
    issues.products.missingFaqs.length +
    issues.products.emptyTabs.length;

  const categoryIssues =
    issues.categories.missingFaqs.length + issues.categories.emptyBody.length;

  const eventIssues =
    issues.events.missingFaqs.length +
    issues.events.emptyBody.length +
    issues.events.missingThumbnail.length;

  const locationIssues =
    issues.locations.emptyBody.length +
    issues.locations.missingThumbnail.length +
    issues.locations.missingFaqs.length;

  lines.push(`| Section | Issues |`);
  lines.push(`|---------|--------|`);
  lines.push(`| Products | ${productIssues} |`);
  lines.push(`| Categories | ${categoryIssues} |`);
  lines.push(`| Events | ${eventIssues} |`);
  lines.push(`| Locations | ${locationIssues} |`);
  lines.push(`| **Total** | **${productIssues + categoryIssues + eventIssues + locationIssues}** |`);
  lines.push(``);

  // Products section
  lines.push(`## Products\n`);

  if (issues.products.tbdSpecs.length > 0) {
    lines.push(`### TBD Specs (${issues.products.tbdSpecs.length} products)\n`);
    for (const item of issues.products.tbdSpecs) {
      lines.push(`- **${item.name}** (${item.file})`);
      lines.push(`  - Missing: ${item.specs.join(", ")}`);
    }
    lines.push(``);
  }

  if (issues.products.tbdFilterAttributes.length > 0) {
    lines.push(
      `### TBD Filter Attributes (${issues.products.tbdFilterAttributes.length} products)\n`
    );
    for (const item of issues.products.tbdFilterAttributes) {
      lines.push(`- **${item.name}** (${item.file})`);
      lines.push(`  - Missing: ${item.attributes.join(", ")}`);
    }
    lines.push(``);
  }

  if (issues.products.missingFeatures.length > 0) {
    lines.push(
      `### Missing Features (${issues.products.missingFeatures.length} products)\n`
    );
    for (const item of issues.products.missingFeatures) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  if (issues.products.missingFaqs.length > 0) {
    lines.push(
      `### Missing FAQs (${issues.products.missingFaqs.length} products)\n`
    );
    for (const item of issues.products.missingFaqs) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  if (issues.products.emptyTabs.length > 0) {
    lines.push(
      `### Empty Tabs (${issues.products.emptyTabs.length} products)\n`
    );
    for (const item of issues.products.emptyTabs) {
      lines.push(`- **${item.name}** (${item.file})`);
      lines.push(`  - Empty tabs: ${item.tabs.join(", ")}`);
    }
    lines.push(``);
  }

  // Categories section
  lines.push(`## Categories\n`);

  if (issues.categories.missingFaqs.length > 0) {
    lines.push(
      `### Missing FAQs (${issues.categories.missingFaqs.length} categories)\n`
    );
    for (const item of issues.categories.missingFaqs) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  if (issues.categories.emptyBody.length > 0) {
    lines.push(
      `### Empty/Minimal Body (${issues.categories.emptyBody.length} categories)\n`
    );
    for (const item of issues.categories.emptyBody) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  // Events section
  lines.push(`## Events\n`);

  if (issues.events.missingFaqs.length > 0) {
    lines.push(
      `### Missing FAQs (${issues.events.missingFaqs.length} events)\n`
    );
    for (const item of issues.events.missingFaqs) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  if (issues.events.emptyBody.length > 0) {
    lines.push(
      `### Empty/Minimal Body (${issues.events.emptyBody.length} events)\n`
    );
    for (const item of issues.events.emptyBody) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  if (issues.events.missingThumbnail.length > 0) {
    lines.push(
      `### Missing Thumbnail (${issues.events.missingThumbnail.length} events)\n`
    );
    for (const item of issues.events.missingThumbnail) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  // Locations section
  lines.push(`## Locations\n`);

  if (issues.locations.emptyBody.length > 0) {
    lines.push(
      `### Empty/Minimal Body (${issues.locations.emptyBody.length} locations)\n`
    );
    for (const item of issues.locations.emptyBody) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  if (issues.locations.missingThumbnail.length > 0) {
    lines.push(
      `### Missing Thumbnail (${issues.locations.missingThumbnail.length} locations)\n`
    );
    for (const item of issues.locations.missingThumbnail) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  if (issues.locations.missingFaqs.length > 0) {
    lines.push(
      `### Missing FAQs (${issues.locations.missingFaqs.length} locations)\n`
    );
    for (const item of issues.locations.missingFaqs) {
      lines.push(`- **${item.name}** (${item.file})`);
    }
    lines.push(``);
  }

  return lines.join("\n");
};

// Generate markdown page with no_index
const generateMarkdownPage = (report) => {
  return `---
title: "Missing Information Report"
no_index: true
eleventyExcludeFromCollections: true
---

${report}
`;
};

// Main execution
const main = async () => {
  console.log("Generating missing information report...\n");

  const issues = await generateReport();
  const report = formatReport(issues);

  // Print to console
  console.log(report);

  // Check for --save flag
  if (process.argv.includes("--save")) {
    const pageContent = generateMarkdownPage(report);
    const outputPath = path("pages", "missing.md");
    await write(outputPath, pageContent);
    console.log(`\nReport saved to: ${outputPath}`);
  } else {
    console.log("\nTip: Run with --save to output to pages/missing.md");
  }
};

main().catch(console.error);
