import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { path, read, write } from "./utils.js";
import { parse } from "yaml";

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
  body.replace(/^#\s+.*$/gm, "").replace(/\s+/g, " ").trim().length < 50;

const generateReport = async () => {
  const issues = {
    products: { tbdSpecs: [], tbdFilterAttributes: [], missingFeatures: [], missingFaqs: [], emptyTabs: 0 },
    categories: { missingFaqs: [], emptyBody: [] },
    events: { missingFaqs: [], emptyBody: [], missingThumbnail: [] },
    locations: { emptyBody: [], missingThumbnail: [], missingFaqs: [] },
  };

  for (const file of getMarkdownFiles(path("products"))) {
    const { data } = parseFrontmatter(await read(file));
    const name = data.title;
    const relPath = relative(path(), file);

    const tbdSpecs = data.specs?.filter((s) => String(s.value).toUpperCase() === "TBD") || [];
    if (tbdSpecs.length) issues.products.tbdSpecs.push({ file: relPath, name, specs: tbdSpecs.map((s) => s.name) });

    const tbdAttrs = data.filter_attributes?.filter((a) => String(a.value).toUpperCase() === "TBD") || [];
    if (tbdAttrs.length) issues.products.tbdFilterAttributes.push({ file: relPath, name, attributes: tbdAttrs.map((a) => a.name) });

    if (!data.features?.length) issues.products.missingFeatures.push({ file: relPath, name });
    if (!data.faqs?.length) issues.products.missingFaqs.push({ file: relPath, name });

    const emptyTabs = data.tabs?.filter((t) => !t.body?.trim()) || [];
    if (emptyTabs.length) issues.products.emptyTabs++;
  }

  for (const file of getMarkdownFiles(path("categories"))) {
    const { data, body } = parseFrontmatter(await read(file));
    const name = data.title;
    const relPath = relative(path(), file);

    if (!data.faqs?.length) issues.categories.missingFaqs.push({ file: relPath, name });
    if (isBodyEmpty(body)) issues.categories.emptyBody.push({ file: relPath, name });
  }

  for (const file of getMarkdownFiles(path("events"))) {
    const { data, body } = parseFrontmatter(await read(file));
    const name = data.title;
    const relPath = relative(path(), file);

    if (!data.faqs?.length) issues.events.missingFaqs.push({ file: relPath, name });
    if (isBodyEmpty(body)) issues.events.emptyBody.push({ file: relPath, name });
    if (!data.thumbnail) issues.events.missingThumbnail.push({ file: relPath, name });
  }

  for (const file of getMarkdownFiles(path("locations"))) {
    const { data, body } = parseFrontmatter(await read(file));
    const name = data.title;
    const relPath = relative(path(), file);

    if (isBodyEmpty(body)) issues.locations.emptyBody.push({ file: relPath, name });
    if (!data.thumbnail) issues.locations.missingThumbnail.push({ file: relPath, name });
    if (!data.faqs?.length) issues.locations.missingFaqs.push({ file: relPath, name });
  }

  return issues;
};

const generateCsv = (issues) => {
  const rows = [["Type", "Issue", "Name", "File", "Details"]];

  for (const item of issues.products.tbdSpecs) rows.push(["Product", "TBD Specs", item.name, item.file, item.specs.join("; ")]);
  for (const item of issues.products.tbdFilterAttributes) rows.push(["Product", "TBD Filter Attributes", item.name, item.file, item.attributes.join("; ")]);
  for (const item of issues.products.missingFeatures) rows.push(["Product", "Missing Features", item.name, item.file, ""]);
  for (const item of issues.products.missingFaqs) rows.push(["Product", "Missing FAQs", item.name, item.file, ""]);
  for (const item of issues.categories.missingFaqs) rows.push(["Category", "Missing FAQs", item.name, item.file, ""]);
  for (const item of issues.categories.emptyBody) rows.push(["Category", "Empty Body", item.name, item.file, ""]);
  for (const item of issues.events.missingFaqs) rows.push(["Event", "Missing FAQs", item.name, item.file, ""]);
  for (const item of issues.events.emptyBody) rows.push(["Event", "Empty Body", item.name, item.file, ""]);
  for (const item of issues.events.missingThumbnail) rows.push(["Event", "Missing Thumbnail", item.name, item.file, ""]);
  for (const item of issues.locations.emptyBody) rows.push(["Location", "Empty Body", item.name, item.file, ""]);
  for (const item of issues.locations.missingThumbnail) rows.push(["Location", "Missing Thumbnail", item.name, item.file, ""]);
  for (const item of issues.locations.missingFaqs) rows.push(["Location", "Missing FAQs", item.name, item.file, ""]);

  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
};

const formatReport = (issues) => {
  const lines = [];
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  lines.push(`# Missing Information Report`, `Generated: ${date}\n`);
  lines.push(`[Download CSV](/assets/files/missing.csv)\n`);
  lines.push(`## Summary\n`);

  const counts = {
    Products: issues.products.tbdSpecs.length + issues.products.tbdFilterAttributes.length + issues.products.missingFeatures.length + issues.products.missingFaqs.length + issues.products.emptyTabs,
    Categories: issues.categories.missingFaqs.length + issues.categories.emptyBody.length,
    Events: issues.events.missingFaqs.length + issues.events.emptyBody.length + issues.events.missingThumbnail.length,
    Locations: issues.locations.emptyBody.length + issues.locations.missingThumbnail.length + issues.locations.missingFaqs.length,
  };

  lines.push(`| Section | Issues |`, `|---------|--------|`);
  for (const [section, count] of Object.entries(counts)) lines.push(`| ${section} | ${count} |`);
  lines.push(`| **Total** | **${Object.values(counts).reduce((a, b) => a + b)}** |`, ``);

  const addSection = (title, items, label, detailKey) => {
    if (!items.length) return;
    lines.push(`### ${title} (${items.length} ${label})\n`);
    for (const item of items) {
      lines.push(`- **${item.name}** (${item.file})`);
      if (detailKey && item[detailKey]) lines.push(`  - Missing: ${item[detailKey].join(", ")}`);
    }
    lines.push(``);
  };

  lines.push(`## Products\n`);
  addSection("TBD Specs", issues.products.tbdSpecs, "products", "specs");
  addSection("TBD Filter Attributes", issues.products.tbdFilterAttributes, "products", "attributes");
  addSection("Missing Features", issues.products.missingFeatures, "products");
  addSection("Missing FAQs", issues.products.missingFaqs, "products");
  if (issues.products.emptyTabs) lines.push(`### Empty Tabs\n`, `${issues.products.emptyTabs} products have empty tabs\n`);

  lines.push(`## Categories\n`);
  addSection("Missing FAQs", issues.categories.missingFaqs, "categories");
  addSection("Empty/Minimal Body", issues.categories.emptyBody, "categories");

  lines.push(`## Events\n`);
  addSection("Missing FAQs", issues.events.missingFaqs, "events");
  addSection("Empty/Minimal Body", issues.events.emptyBody, "events");
  addSection("Missing Thumbnail", issues.events.missingThumbnail, "events");

  lines.push(`## Locations\n`);
  addSection("Empty/Minimal Body", issues.locations.emptyBody, "locations");
  addSection("Missing Thumbnail", issues.locations.missingThumbnail, "locations");
  addSection("Missing FAQs", issues.locations.missingFaqs, "locations");

  return lines.join("\n");
};

const main = async () => {
  console.log("Generating missing information report...\n");

  const issues = await generateReport();
  const report = formatReport(issues);
  const csv = generateCsv(issues);

  console.log(report);

  if (process.argv.includes("--save")) {
    const content = `---\ntitle: "Missing Information Report"\nno_index: true\neleventyExcludeFromCollections: true\n---\n\n${report}\n`;
    await write(path("pages", "missing.md"), content);
    await write(path("assets", "files", "missing.csv"), csv);
    console.log(`\nReport saved to: pages/missing.md`);
    console.log(`CSV saved to: assets/files/missing.csv`);
  } else {
    console.log("\nTip: Run with --save to output to pages/missing.md");
  }
};

main();
