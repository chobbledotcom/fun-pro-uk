/**
 * Extract text content from HTML, stripping tags
 * @param {string} html - HTML string
 * @returns {string} Text content
 */
const stripHtmlTags = (html) => {
  return html
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&pound;/g, '£')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

/**
 * Extract specification tables from HTML
 * @param {string} htmlContent - Raw HTML content
 * @returns {string} Formatted markdown specifications
 */
const extractSpecificationTable = (htmlContent) => {
  const result = [];

  // Find the specifications section: look for "Product Specifications!" heading
  const specsMatch = htmlContent.match(/<div class="menu-heading[^"]*">Product Specifications!<\/div>\s*<table class="table table-striped">([\s\S]*?)<\/table>/i);

  if (!specsMatch) return '';

  const tableContent = specsMatch[1];
  const rows = [];
  let currentLabel = null;
  let currentValues = [];

  // Extract all table rows
  const rowMatches = tableContent.matchAll(/<tr>([\s\S]*?)<\/tr>/g);

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];

    // Check if this is a header row
    if (rowHtml.includes('<th>')) continue;

    // Extract cells
    const cellMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];

    if (cellMatches.length === 2) {
      const labelCell = stripHtmlTags(cellMatches[0][1]);
      const valueCell = stripHtmlTags(cellMatches[1][1]);

      // Check if this row has a label (not just an icon)
      const hasLabel = labelCell && !labelCell.match(/^\s*$/);

      if (hasLabel) {
        // New label - save previous group if exists
        if (currentLabel && currentValues.length > 0) {
          rows.push({ label: currentLabel, values: currentValues });
        }
        // Start new group
        currentLabel = labelCell;
        currentValues = valueCell ? [valueCell] : [];
      } else if (valueCell && currentLabel) {
        // Continuation of current label (empty label cell)
        currentValues.push(valueCell);
      }
    }
  }

  // Save last group
  if (currentLabel && currentValues.length > 0) {
    rows.push({ label: currentLabel, values: currentValues });
  }

  // Format as markdown
  rows.forEach(row => {
    result.push('');
    if (row.values.length > 1) {
      // Multiple values - format as list
      result.push(`**${row.label}**`);
      result.push('');
      row.values.forEach(value => {
        result.push(`- ${value}`);
      });
    } else {
      // Single value
      result.push(`**${row.label}** ${row.values[0]}`);
    }
  });

  result.push('');
  return result.join('\n');
};

/**
 * Extract price table from HTML
 * @param {string} htmlContent - Raw HTML content
 * @returns {string} Formatted markdown price info
 */
const extractPriceTable = (htmlContent) => {
  const result = [];

  // Find the price section: look for "Our Prices!" heading
  const priceMatch = htmlContent.match(/<div class="menu-heading[^"]*">Our Prices!<\/div>\s*<table class="table table-striped">([\s\S]*?)<\/table>/i);

  if (!priceMatch) return '';

  const tableContent = priceMatch[1];

  // Extract all table rows
  const rowMatches = tableContent.matchAll(/<tr>([\s\S]*?)<\/tr>/g);

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];

    // Extract cells
    const cellMatches = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)];

    if (cellMatches.length === 2) {
      const label = stripHtmlTags(cellMatches[0][1]).replace(/:$/, '');
      const value = stripHtmlTags(cellMatches[1][1]);

      result.push('');
      result.push(`**${label}:** ${value}`);
    }
  }

  result.push('');
  return result.join('\n');
};

module.exports = {
  extractSpecificationTable,
  extractPriceTable
};
