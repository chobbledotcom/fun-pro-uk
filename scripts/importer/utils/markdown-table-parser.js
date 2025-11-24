/**
 * Parse and format specification tables in markdown content
 * Handles tables with multiline cells containing lists
 */

/**
 * Check if a line contains a list item (starts with number + x or bullet point)
 * @param {string} line - Line to check
 * @returns {boolean}
 */
const isListItem = (line) => {
  const trimmed = line.trim();
  return /^\d+\s*x\s+/i.test(trimmed) || /^[-*]\s+/.test(trimmed);
};

/**
 * Extract list items from multiline table cell content
 * @param {string} cellContent - Raw cell content that may span multiple lines
 * @returns {string[]} Array of list items
 */
const extractListItems = (cellContent) => {
  const lines = cellContent.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];

  // If there's more than one line, treat each line as a list item
  // (multi-line cells in spec tables are typically lists)
  if (lines.length > 1) {
    return lines;
  }

  // Single line: check if it's explicitly a list item
  for (const line of lines) {
    if (isListItem(line)) {
      items.push(line);
    }
  }

  return items;
};

/**
 * Format list items as markdown list
 * @param {string[]} items - Array of list items
 * @returns {string} Formatted markdown list
 */
const formatAsMarkdownList = (items) => {
  return items.map(item => {
    // Remove existing bullet/number prefix and normalize
    const cleaned = item.replace(/^[-*]\s*/, '').replace(/^\d+\s*x\s*/i, match => match);
    return `- ${cleaned}`;
  }).join('\n');
};

/**
 * Parse a specification table and convert multiline cells with lists into proper markdown
 * @param {string} content - Markdown content containing tables
 * @returns {string} Content with formatted tables
 */
const parseSpecificationTables = (content) => {
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect start of specification section
    if (line.match(/^Product Specifications!?$/i)) {
      result.push(line);
      i++;

      // Skip empty lines
      while (i < lines.length && !lines[i].trim()) {
        result.push(lines[i]);
        i++;
      }

      // Now we should be at the table
      // Parse the entire table structure
      const tableStart = i;
      let tableEnd = i;

      // Find the end of the table (marked by separator line with dashes)
      while (tableEnd < lines.length) {
        if (lines[tableEnd].match(/^[\s-]+$/)) {
          tableEnd++;
          break;
        }
        tableEnd++;
      }

      // Extract table content
      const tableLines = lines.slice(tableStart, tableEnd);
      const formattedTable = formatSpecificationTable(tableLines);
      result.push(...formattedTable);

      i = tableEnd;
      continue;
    }

    // Also handle "Our Prices!" section
    if (line.match(/^Our Prices!?$/i)) {
      result.push(line);
      i++;

      // Skip empty lines
      while (i < lines.length && !lines[i].trim()) {
        result.push(lines[i]);
        i++;
      }

      // Parse price table
      const tableStart = i;
      let tableEnd = i;

      while (tableEnd < lines.length) {
        if (lines[tableEnd].match(/^[\s-]+$/) || lines[tableEnd].match(/^-{10,}$/)) {
          tableEnd++;
          break;
        }
        tableEnd++;
      }

      const tableLines = lines.slice(tableStart, tableEnd);
      const formattedTable = formatPriceTable(tableLines);
      result.push(...formattedTable);

      i = tableEnd;
      continue;
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
};

/**
 * Format a specification table with proper markdown
 * @param {string[]} tableLines - Lines containing the table
 * @returns {string[]} Formatted table lines
 */
const formatSpecificationTable = (tableLines) => {
  const result = [];
  const rows = parseTableRows(tableLines);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.cells.length < 2) continue;

    const label = row.cells[0].trim();
    const value = row.cells[1].trim();

    // Skip header row (first row with generic labels like "Specification" and "Details")
    if (i === 0 && label.match(/^Specification/i) && value.match(/^Details?$/i)) {
      continue;
    }

    // Check if value contains list items
    const listItems = extractListItems(value);

    if (listItems.length > 0) {
      // Format as heading + list
      result.push('');
      result.push(`**${label}**`);
      result.push('');
      result.push(formatAsMarkdownList(listItems));
    } else {
      // Format as simple key-value
      result.push('');
      result.push(`**${label}** ${value}`);
    }
  }

  result.push('');
  return result;
};

/**
 * Format a price table
 * @param {string[]} tableLines - Lines containing the price table
 * @returns {string[]} Formatted lines
 */
const formatPriceTable = (tableLines) => {
  const result = [];
  const rows = parseTableRows(tableLines);

  for (const row of rows) {
    if (row.cells.length < 2) continue;

    const label = row.cells[0].trim();
    const value = row.cells[1].trim();

    result.push('');
    result.push(`**${label}** ${value}`);
  }

  result.push('');
  return result;
};

/**
 * Parse table rows from raw lines
 * Handles multi-line cells by detecting alignment patterns
 * Supports pandoc-style tables with aligned columns
 * @param {string[]} lines - Table lines
 * @returns {Array<{cells: string[]}>} Parsed rows
 */
const parseTableRows = (lines) => {
  if (lines.length === 0) return [];

  const rows = [];
  let currentRow = null;

  // Detect the first column position from the first line with content
  let firstColumnPos = null;

  for (const line of lines) {
    // Skip separator lines
    if (line.match(/^[\s-]+$/)) continue;
    if (!line.trim()) continue;

    // If we haven't detected the first column yet, use this line
    if (firstColumnPos === null) {
      firstColumnPos = line.search(/\S/);
    }

    // Determine if this is a new row or continuation
    // New rows start at the first column position
    // Continuation lines are indented beyond the first column
    const lineStart = line.search(/\S/);
    const isNewRow = !currentRow || lineStart === firstColumnPos;

    if (isNewRow) {
      // Start new row
      if (currentRow) {
        rows.push(currentRow);
      }

      // Parse cells - split on 2+ spaces
      const cells = line.split(/\s{2,}/).map(c => c.trim()).filter(c => c);
      currentRow = { cells };
    } else if (currentRow) {
      // Continuation of previous row - add to last cell
      const continuation = line.trim();
      if (continuation && currentRow.cells.length > 0) {
        currentRow.cells[currentRow.cells.length - 1] += '\n' + continuation;
      }
    }
  }

  if (currentRow) {
    rows.push(currentRow);
  }

  return rows;
};

module.exports = {
  parseSpecificationTables,
  extractListItems,
  formatAsMarkdownList,
  isListItem
};
