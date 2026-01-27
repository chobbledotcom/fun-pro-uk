/**
 * CSV to Markdown Migration Script
 *
 * Migrates product content data from content.csv into existing markdown files.
 * Updates: specs, filter_attributes, faqs, and tabs
 *
 * Usage: bun scripts/migrate-csv-content.js [--dry-run]
 */

import { read, write, path, file } from "./utils.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

// Configuration
const CSV_PATH = path("content.csv");
const PRODUCTS_DIR = path("products");

// CSV column to field mapping
const SPEC_FIELDS = [
  { csv: "Players", name: "Players" },
  { csv: "Space Required", name: "Space Required" },
  { csv: "Power", name: "Power" },
  { csv: "Setup Time", name: "Setup time" },
  { csv: "Equipment Size", name: "Equipment Size" },
  { csv: "Suitability", name: "Suitability" },
  { csv: "Access", name: "Access" },
];

const FILTER_FIELDS = [
  { csv: "Guest Capacity", name: "Guest Capacity" },
  { csv: "Game Length", name: "Game Length" },
  { csv: "Power Required", name: "Power Required" },
];

/**
 * Parse CSV content into array of objects
 * Properly handles quoted fields with embedded newlines and commas
 */
function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        // Escaped quote inside quoted field
        currentField += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\n" && !inQuotes) {
      // End of row
      currentRow.push(currentField);
      if (currentRow.some((f) => f.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else if (char === "\r") {
      // Skip carriage returns
    } else {
      currentField += char;
    }
  }

  // Don't forget last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim())) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  // First row is header
  const header = rows[0];

  // Convert remaining rows to objects
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = rows[i][j] || "";
    }
    result.push(row);
  }

  return result;
}

/**
 * Convert product name to slug (kebab-case filename)
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, "") // Remove apostrophes
    .replace(/[()]/g, "") // Remove parentheses
    .replace(/&/g, "and") // Replace & with and
    .replace(/[^\w\s-]/g, "") // Remove special chars except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Parse FAQs from CSV format (Q:/A: pairs)
 */
function parseFAQs(faqText) {
  if (!faqText || !faqText.trim()) return [];

  const faqs = [];

  // Match Q:/A: pairs - handles multi-paragraph answers
  const regex = /Q:\s*(.+?)\s*\n\s*A:\s*([\s\S]*?)(?=\n\s*Q:|$)/g;
  let match;

  while ((match = regex.exec(faqText)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();

    if (question && answer) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}

/**
 * Parse markdown file with YAML frontmatter
 */
function parseMarkdown(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid markdown frontmatter");
  }

  const frontmatter = parseYaml(match[1]);
  const body = match[2];

  return { frontmatter, body };
}

/**
 * Serialize frontmatter back to markdown
 */
function serializeMarkdown(frontmatter, body) {
  // Custom YAML options for better formatting
  const yamlStr = stringifyYaml(frontmatter, {
    lineWidth: 0, // Don't wrap lines
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
    doubleQuotedAsJSON: false,
  });

  return `---\n${yamlStr}---\n${body}`;
}

/**
 * Update specs array with CSV data
 */
function updateSpecs(specs, csvRow) {
  if (!specs) specs = [];

  for (const field of SPEC_FIELDS) {
    const csvValue = csvRow[field.csv];
    if (csvValue && csvValue.trim()) {
      // Find existing spec or add new one
      const existing = specs.find((s) => s.name === field.name);
      if (existing) {
        existing.value = csvValue.trim();
      } else {
        specs.push({ name: field.name, value: csvValue.trim() });
      }
    }
  }

  return specs;
}

/**
 * Update filter_attributes array with CSV data
 */
function updateFilterAttributes(attrs, csvRow) {
  if (!attrs) attrs = [];

  for (const field of FILTER_FIELDS) {
    const csvValue = csvRow[field.csv];
    if (csvValue && csvValue.trim()) {
      // Find existing attr or add new one
      const existing = attrs.find((a) => a.name === field.name);
      if (existing) {
        existing.value = csvValue.trim();
      } else {
        attrs.push({ name: field.name, value: csvValue.trim() });
      }
    }
  }

  // Also add Player Count from Players field
  const players = csvRow["Players"];
  if (players && players.trim()) {
    const existing = attrs.find((a) => a.name === "Player Count");
    if (existing) {
      existing.value = players.trim();
    } else {
      attrs.push({ name: "Player Count", value: players.trim() });
    }
  }

  return attrs;
}

/**
 * Update tabs array with CSV content
 */
function updateTabs(tabs, csvRow, productName) {
  if (!tabs) tabs = [];

  // Get existing tab images to preserve them
  const existingImages = {};
  for (const tab of tabs) {
    if (tab.image) {
      existingImages[tab.title] = tab.image;
    }
  }

  // Build new tabs array
  const newTabs = [
    {
      title: `Why ${productName}?`,
      body: csvRow["Why choose this product?"]?.trim() || "",
    },
    {
      title: "How It Works",
      body: csvRow["How it works"]?.trim() || "",
    },
    {
      title: "Why It's A Crowd Favourite",
      body: csvRow["Why it's a crowd favourite?"]?.trim() || "",
    },
    {
      title: "Delivery",
      body: csvRow["Delivery"]?.trim() || "",
    },
  ];

  // Preserve images from old tabs
  for (const tab of newTabs) {
    // Try to find matching image from old tabs
    for (const oldTab of tabs) {
      if (
        oldTab.image &&
        (oldTab.title === tab.title ||
          oldTab.title.toLowerCase().includes(tab.title.toLowerCase().split(" ")[0]))
      ) {
        tab.image = oldTab.image;
        break;
      }
    }
    // Also check by index position for first tab
    if (!tab.image && tab.title.startsWith("Why ") && tabs[0]?.image) {
      tab.image = tabs[0].image;
    }
  }

  return newTabs;
}

/**
 * Main migration function
 */
async function migrate(dryRun = false) {
  console.log(`\n📋 CSV Content Migration Script`);
  console.log(`================================`);
  if (dryRun) {
    console.log(`🔍 DRY RUN MODE - No files will be modified\n`);
  }

  // Read and parse CSV
  console.log(`Reading CSV file...`);
  const csvContent = await read(CSV_PATH);
  const rows = parseCSV(csvContent);
  console.log(`Found ${rows.length} products in CSV\n`);

  // Get list of existing product files
  const productFiles = new Map();
  const glob = new Bun.Glob("*.md");
  for await (const filename of glob.scan(PRODUCTS_DIR)) {
    const slug = filename.replace(/\.md$/, "");
    productFiles.set(slug, filename);
  }
  console.log(`Found ${productFiles.size} existing product files\n`);

  // Track results
  const results = {
    matched: [],
    unmatched: [],
    errors: [],
  };

  // Process each CSV row
  for (const row of rows) {
    const productName = row["Product Name"];
    if (!productName) continue;

    const slug = nameToSlug(productName);
    const filename = productFiles.get(slug);

    if (!filename) {
      results.unmatched.push({ name: productName, slug });
      continue;
    }

    try {
      const filePath = `${PRODUCTS_DIR}/${filename}`;
      const content = await read(filePath);
      const { frontmatter, body } = parseMarkdown(content);

      // Get the title from frontmatter for the tab title
      const title = frontmatter.title || productName;

      // Update fields
      frontmatter.specs = updateSpecs(frontmatter.specs, row);
      frontmatter.filter_attributes = updateFilterAttributes(
        frontmatter.filter_attributes,
        row
      );
      frontmatter.faqs = parseFAQs(row["FAQs"]);
      frontmatter.tabs = updateTabs(frontmatter.tabs, row, title);

      // Write updated file
      if (!dryRun) {
        const newContent = serializeMarkdown(frontmatter, body);
        await write(filePath, newContent);
      }

      results.matched.push({ name: productName, slug, file: filename });
    } catch (error) {
      results.errors.push({ name: productName, slug, error: error.message });
    }
  }

  // Print results
  console.log(`\n📊 Migration Results`);
  console.log(`====================`);
  console.log(`✅ Matched & updated: ${results.matched.length}`);
  console.log(`❌ Unmatched (no file): ${results.unmatched.length}`);
  console.log(`⚠️  Errors: ${results.errors.length}`);

  if (results.unmatched.length > 0) {
    console.log(`\n❌ Unmatched products:`);
    for (const item of results.unmatched) {
      console.log(`   - "${item.name}" (tried: ${item.slug}.md)`);
    }
  }

  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    for (const item of results.errors) {
      console.log(`   - "${item.name}": ${item.error}`);
    }
  }

  // Fail if there are unmatched products (as requested)
  if (results.unmatched.length > 0) {
    console.log(
      `\n❌ MIGRATION FAILED: ${results.unmatched.length} products in CSV have no matching markdown file`
    );
    process.exit(1);
  }

  if (!dryRun) {
    console.log(`\n✅ Migration complete!`);
  } else {
    console.log(`\n🔍 Dry run complete - no files were modified`);
  }
}

// Run migration
const dryRun = process.argv.includes("--dry-run");
migrate(dryRun).catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
