import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dir, "..");
const path = (...segments) => join(root, "src", ...segments);
const read = (p) => Bun.file(p).text();
const write = Bun.write;

const getMarkdownFiles = (dir) => {
  const files = [];
  for (const item of readdirSync(dir)) {
    const fullPath = join(dir, item);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getMarkdownFiles(fullPath));
    } else if (item.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
};

const parseFrontmatter = (content) => {
  const [, yaml, body] = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return { data: parse(yaml), body: body.trim() };
};

const isBodyEmpty = (body) =>
  body
    .replace(/^#\s+.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim().length < 50;

const isTbd = (entry) => String(entry.value).toUpperCase() === "TBD";

const collectTbdIssues = (products, data, name, relPath) => {
  const tbdSpecs = data.specs?.filter((spec) => isTbd(spec)) || [];
  if (tbdSpecs.length)
    products.tbdSpecs.push({
      file: relPath,
      name,
      specs: tbdSpecs.map((spec) => spec.name),
    });

  const tbdAttrs = data.filter_attributes?.filter((attr) => isTbd(attr)) || [];
  if (tbdAttrs.length)
    products.tbdFilterAttributes.push({
      file: relPath,
      name,
      attributes: tbdAttrs.map((attr) => attr.name),
    });
};

const collectProductIssues = (products, { data, name, relPath }) => {
  collectTbdIssues(products, data, name, relPath);
  if (!data.features?.length)
    products.missingFeatures.push({ file: relPath, name });
  if (!data.faqs?.length) products.missingFaqs.push({ file: relPath, name });

  const emptyTabs = data.tabs?.filter((tab) => !tab.body?.trim()) || [];
  if (emptyTabs.length) products.emptyTabs++;
};

const collectContentIssues = (collection, { data, body, name, relPath }) => {
  if (!data.faqs?.length) collection.missingFaqs.push({ file: relPath, name });
  if (isBodyEmpty(body)) collection.emptyBody.push({ file: relPath, name });
};

const collectEventIssues = (events, entry) => {
  collectContentIssues(events, entry);
  if (!entry.data.thumbnail)
    events.missingThumbnail.push({ file: entry.relPath, name: entry.name });
};

const collectLocationIssues = (locations, entry) => {
  collectContentIssues(locations, entry);
  if (!entry.data.thumbnail)
    locations.missingThumbnail.push({ file: entry.relPath, name: entry.name });
};

/**
 * Read every markdown file in a collection and collect issues found by
 * `collect` into `target`.
 * @param {string} dir - Collection directory under src/
 * @param {object} target - Issues bucket for the collection
 * @param {(target: object, entry: object) => void} collect - Issue collector
 */
const scanCollection = async (dir, target, collect) => {
  for (const file of getMarkdownFiles(path(dir))) {
    const { data, body } = parseFrontmatter(await read(file));
    collect(target, {
      data,
      body,
      name: data.title,
      relPath: relative(path(), file),
    });
  }
};

const generateReport = async () => {
  const issues = {
    products: {
      tbdSpecs: [],
      tbdFilterAttributes: [],
      missingFeatures: [],
      missingFaqs: [],
      emptyTabs: 0,
    },
    categories: { missingFaqs: [], emptyBody: [] },
    events: { missingFaqs: [], emptyBody: [], missingThumbnail: [] },
    locations: { emptyBody: [], missingThumbnail: [], missingFaqs: [] },
  };

  await scanCollection("products", issues.products, collectProductIssues);
  await scanCollection("categories", issues.categories, collectContentIssues);
  await scanCollection("events", issues.events, collectEventIssues);
  await scanCollection("locations", issues.locations, collectLocationIssues);

  return issues;
};

const formatReport = (issues) => {
  const lines = [];
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  lines.push("# Missing Information Report", `Generated: ${date}\n`);
  lines.push("## Summary\n");

  const counts = {
    Products:
      issues.products.tbdSpecs.length +
      issues.products.tbdFilterAttributes.length +
      issues.products.missingFeatures.length +
      issues.products.missingFaqs.length +
      issues.products.emptyTabs,
    Categories:
      issues.categories.missingFaqs.length + issues.categories.emptyBody.length,
    Events:
      issues.events.missingFaqs.length +
      issues.events.emptyBody.length +
      issues.events.missingThumbnail.length,
    Locations:
      issues.locations.emptyBody.length +
      issues.locations.missingThumbnail.length +
      issues.locations.missingFaqs.length,
  };

  lines.push("| Section | Issues |", "|---------|--------|");
  for (const [section, count] of Object.entries(counts))
    lines.push(`| ${section} | ${count} |`);
  lines.push(
    `| **Total** | **${Object.values(counts).reduce((a, b) => a + b)}** |`,
    "",
  );

  const formatItemDetail = (item, detailKey) =>
    detailKey && item[detailKey]
      ? `  - Missing: ${item[detailKey].join(", ")}`
      : "";

  const addSection = (title, items, label, detailKey) => {
    if (!items.length) return;
    lines.push(`### ${title} (${items.length} ${label})\n`);
    for (const item of items) {
      lines.push(`- **${item.name}** (${item.file})`);
      const detail = formatItemDetail(item, detailKey);
      if (detail) lines.push(detail);
    }
    lines.push("");
  };

  lines.push("## Products\n");
  addSection("TBD Specs", issues.products.tbdSpecs, "products", "specs");
  addSection(
    "TBD Filter Attributes",
    issues.products.tbdFilterAttributes,
    "products",
    "attributes",
  );
  addSection("Missing Features", issues.products.missingFeatures, "products");
  addSection("Missing FAQs", issues.products.missingFaqs, "products");
  if (issues.products.emptyTabs)
    lines.push(
      "### Empty Tabs\n",
      `${issues.products.emptyTabs} products have empty tabs\n`,
    );

  lines.push("## Categories\n");
  addSection("Missing FAQs", issues.categories.missingFaqs, "categories");
  addSection("Empty/Minimal Body", issues.categories.emptyBody, "categories");

  lines.push("## Events\n");
  addSection("Missing FAQs", issues.events.missingFaqs, "events");
  addSection("Empty/Minimal Body", issues.events.emptyBody, "events");
  addSection("Missing Thumbnail", issues.events.missingThumbnail, "events");

  lines.push("## Locations\n");
  addSection("Empty/Minimal Body", issues.locations.emptyBody, "locations");
  addSection(
    "Missing Thumbnail",
    issues.locations.missingThumbnail,
    "locations",
  );
  addSection("Missing FAQs", issues.locations.missingFaqs, "locations");

  return lines.join("\n");
};

const main = async () => {
  console.log("Generating missing information report...\n");

  const issues = await generateReport();
  const report = formatReport(issues);

  console.log(report);

  if (process.argv.includes("--save")) {
    const content = `---\ntitle: "Missing Information Report"\nno_index: true\neleventyExcludeFromCollections: true\n---\n\n${report}\n`;
    await write(path("pages", "missing.md"), content);
    console.log("\nReport saved to: pages/missing.md");
  } else {
    console.log("\nTip: Run with --save to output to pages/missing.md");
  }
};

main();
