# CSV to Markdown Migration Plan

## Overview

This document outlines the plan for migrating product data from `content.csv` (698 products) into the existing markdown files in the `products/` directory, following the schema defined in `.pages.yml`.

## Source Data (content.csv)

The CSV contains 16 columns:

| Column | Description |
|--------|-------------|
| Product Name | Product title (used for matching) |
| Players | Number of players (e.g., "1-4 players") |
| Space Required | Space dimensions needed |
| Power | Power requirements |
| Setup Time | Time to set up |
| Equipment Size | Physical dimensions |
| Suitability | Usage conditions (indoor/outdoor) |
| Access | Door width/access requirements |
| Guest Capacity | Event capacity range |
| Game Length | Duration of play |
| Power Required | Power wattage/type |
| FAQs | Multi-line Q&A format |
| Why choose this product? | Marketing copy (long text) |
| How it works | Operational description |
| Why it's a crowd favourite? | Social proof/engagement copy |
| Delivery | Delivery and setup information |

## Target Schema (from .pages.yml)

The `products` collection has these relevant fields for migration:

### Specifications (`specs`)
```yaml
specs:
  - name: "Players"
    value: "..."
  - name: "Space Required"
    value: "..."
  - name: "Power"
    value: "..."
  - name: "Setup time"
    value: "..."
  - name: "Equipment Size"
    value: "..."
  - name: "Suitability"
    value: "..."
  - name: "Access"
    value: "..."
```

### Filter Attributes (`filter_attributes`)
```yaml
filter_attributes:
  - name: "Guest Capacity"
    value: "..."
  - name: "Game Length"
    value: "..."
  - name: "Power Required"
    value: "..."
  - name: "Player Count"
    value: "..."
```

### FAQs (`faqs`)
```yaml
faqs:
  - question: "..."
    answer: "..."
```

### Tabs (`tabs`)
```yaml
tabs:
  - title: "Why [Product Name]?"
    image: "..."
    body: |
      [Content from "Why choose this product?"]
  - title: "How It Works"
    body: |
      [Content from "How it works"]
  - title: "Why It's A Crowd Favourite"
    body: |
      [Content from "Why it's a crowd favourite?"]
  - title: "Delivery"
    body: |
      [Content from "Delivery"]
```

## Field Mapping

| CSV Column | Target Field | Target Location |
|------------|--------------|-----------------|
| Product Name | (matching key) | Used to find markdown file |
| Players | `specs[].value` | specs → "Players" |
| Players | `filter_attributes[].value` | filter_attributes → "Player Count" |
| Space Required | `specs[].value` | specs → "Space Required" |
| Power | `specs[].value` | specs → "Power" |
| Setup Time | `specs[].value` | specs → "Setup time" |
| Equipment Size | `specs[].value` | specs → "Equipment Size" |
| Suitability | `specs[].value` | specs → "Suitability" |
| Access | `specs[].value` | specs → "Access" |
| Guest Capacity | `filter_attributes[].value` | filter_attributes → "Guest Capacity" |
| Game Length | `filter_attributes[].value` | filter_attributes → "Game Length" |
| Power Required | `filter_attributes[].value` | filter_attributes → "Power Required" |
| FAQs | `faqs[]` | faqs (parsed from Q:/A: format) |
| Why choose this product? | `tabs[0].body` | tabs → "Why [Product]?" |
| How it works | `tabs[1].body` | tabs → "How It Works" |
| Why it's a crowd favourite? | `tabs[2].body` | tabs → "Why It's A Crowd Favourite" |
| Delivery | `tabs[3].body` | tabs → "Delivery" |

## Migration Tasks

### Phase 1: Product Name Matching
1. Create a mapping between CSV "Product Name" and markdown filenames
2. Handle case sensitivity (CSV uses mixed case, filenames are kebab-case)
3. Identify unmatched products (in CSV but no markdown file)
4. Identify orphaned markdown files (exist but not in CSV)

**Matching Algorithm:**
```
CSV: "Candy Cane Snatch it" → products/candy-cane-snatch-it.md
CSV: "ELECTRONIC BASKET BALL HIRE" → products/electronic-basket-ball-hire.md
```

### Phase 2: Specifications Migration
Update `specs` array with values from CSV columns:
- Players
- Space Required
- Power
- Setup Time
- Equipment Size
- Suitability
- Access

**Current State:** Many products have "TBD" values in specs
**Target State:** Populated with actual CSV data

### Phase 3: Filter Attributes Migration
Update `filter_attributes` array with:
- Guest Capacity
- Game Length
- Power Required
- Player Count (from Players column)

**Current State:** Many products have "TBD" values
**Target State:** Populated with actual CSV data

### Phase 4: FAQ Migration
Parse the FAQ column and convert to structured format:

**CSV Format:**
```
Q: How many people can play?
A: The game is designed for 1-4 players...

Q: Is it suitable for all ages?
A: Yes, suitable for ages 5 and above...
```

**Target Format:**
```yaml
faqs:
  - question: "How many people can play?"
    answer: "The game is designed for 1-4 players..."
  - question: "Is it suitable for all ages?"
    answer: "Yes, suitable for ages 5 and above..."
```

**Note:** Some products already have manually-written FAQs. Migration should:
- Option A: Replace all FAQs with CSV data
- Option B: Merge/append CSV FAQs to existing
- Option C: Only populate if faqs is empty

### Phase 5: Tabs Content Migration
Update the `tabs` array with long-form content:

| Tab Index | Title Pattern | CSV Source |
|-----------|---------------|------------|
| 0 | "Why [Product Name]?" | "Why choose this product?" |
| 1 | "How It Works" | "How it works" |
| 2 | "Why It's A Crowd Favourite" | "Why it's a crowd favourite?" |
| 3 | "Delivery" | "Delivery" |

**Current State:** Some tabs exist but body is empty (`body: |`)
**Target State:** Populated with marketing copy from CSV

## Implementation Approach

### Option A: Python Script (Recommended)
Create a Python script that:
1. Reads the CSV file
2. For each product:
   - Finds matching markdown file
   - Parses existing YAML frontmatter
   - Updates fields with CSV data
   - Writes back to file
3. Generates a report of:
   - Successfully migrated products
   - Unmatched products
   - Parse errors

**Dependencies:**
- `pyyaml` or `ruamel.yaml` for YAML parsing
- `python-frontmatter` for markdown frontmatter handling

### Option B: Node.js Script
Similar approach using:
- `gray-matter` for frontmatter parsing
- `csv-parse` for CSV handling

## Data Quality Considerations

### 1. Filename Matching
- CSV names vary in capitalization
- Some names include "HIRE" suffix inconsistently
- Special characters may differ

**Example mismatches to handle:**
```
CSV: "ELECTRONIC BASKET BALL HIRE"
File: "electronic-basket-ball-hire.md"

CSV: "Mega Wire - Branded Game Hire (stand alone)"
File: "mega-wire-branded-game-hire-stand-alone.md"
```

### 2. Content Sanitization
- Escape special YAML characters in content
- Handle multi-line strings properly
- Preserve existing markdown formatting

### 3. Duplicate Handling
- Some products may appear multiple times in CSV
- Need strategy: first wins, last wins, or merge

### 4. Missing Data
- Some CSV cells may be empty
- Don't overwrite existing good data with empty values

## Validation Steps

After migration:
1. Run site build to check for YAML syntax errors
2. Spot-check 10-15 products manually
3. Verify FAQs render correctly on product pages
4. Confirm tabs display proper content
5. Check filter attributes work in search/filtering

## Rollback Plan

1. Before migration, commit current state
2. Create migration on a separate branch
3. Review changes in PR before merging
4. If issues found post-merge, git revert

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Script development | Medium |
| Product matching logic | Low-Medium |
| Testing & validation | Medium |
| FAQ parsing complexity | Medium |
| Edge case handling | Medium |

## Files Affected

- 91 existing markdown files in `products/`
- Up to 698 products in CSV (some may not have markdown files yet)
- Migration script (to be created)

## Questions to Resolve

1. **FAQ handling:** Replace existing FAQs or merge with CSV data?
2. **New products:** Should the script create new markdown files for products in CSV but not in `products/`?
3. **Content precedence:** If existing content differs from CSV, which takes priority?
4. **Tabs with existing content:** The first tab often has manually-written content - preserve or replace?

## Next Steps

1. Review and approve this migration plan
2. Resolve open questions above
3. Implement migration script
4. Run migration on test branch
5. Validate results
6. Merge to main branch
