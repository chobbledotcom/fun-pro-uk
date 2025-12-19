const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');

// Fields to always keep regardless of whether they appear in front matter
const ALWAYS_KEEP_FIELDS = ['body'];

/**
 * Fetch and update .pages.yml from the template repo
 */
function updatePages() {
  const url = 'https://raw.githubusercontent.com/chobbledotcom/chobble-template/refs/heads/main/.pages.yml';
  const content = execSync(`curl -sL "${url}"`).toString();
  const updated = content.replace(/src\//g, '');
  
  fs.writeFileSync(path.join(BASE_DIR, '.pages.yml'), updated);
  console.log('Updated .pages.yml from chobble-template (with src/ removed)');
  
  return updated;
}

/**
 * Recursively get all markdown files in a directory
 */
function getMarkdownFiles(dir, recursive = false) {
  const fullPath = path.join(BASE_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  
  const files = [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...getMarkdownFiles(entryPath, true));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }
  
  return files;
}

/**
 * Extract top-level front matter keys from a markdown file
 */
function extractFrontMatterKeys(filePath) {
  const content = fs.readFileSync(path.join(BASE_DIR, filePath), 'utf8');
  const keys = new Set();
  
  // Check if file starts with front matter
  if (!content.startsWith('---')) {
    return keys;
  }
  
  // Find the closing ---
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return keys;
  }
  
  const frontMatter = content.substring(4, endIndex);
  const lines = frontMatter.split('\n');
  
  for (const line of lines) {
    // Match top-level keys (lines that start with a word followed by colon, not indented)
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
    if (match) {
      keys.add(match[1]);
    }
  }
  
  return keys;
}

/**
 * Parse collection metadata from a block
 */
function parseCollectionMeta(block) {
  const meta = {
    name: null,
    path: null,
    type: null,
    subfolders: false
  };
  
  const nameMatch = block.match(/^  - name:\s*(\S+)/m);
  if (nameMatch) meta.name = nameMatch[1];
  
  const pathMatch = block.match(/^    path:\s*(\S+)/m);
  if (pathMatch) meta.path = pathMatch[1];
  
  const typeMatch = block.match(/^    type:\s*(\S+)/m);
  if (typeMatch) meta.type = typeMatch[1];
  
  const subfoldersMatch = block.match(/^    subfolders:\s*(true|false)/m);
  if (subfoldersMatch) meta.subfolders = subfoldersMatch[1] === 'true';
  
  return meta;
}

/**
 * Get all top-level field names from a collection block
 */
function getFieldNames(block) {
  const names = [];
  const lines = block.split('\n');
  let inMainFields = false;
  
  for (const line of lines) {
    // Main fields: starts at exactly 4 spaces
    if (line.match(/^    fields:\s*$/)) {
      inMainFields = true;
      continue;
    }
    
    // Exit main fields when we hit something at indent <= 4 (but not empty)
    if (inMainFields && line.trim() !== '') {
      const indent = line.match(/^(\s*)/)[1].length;
      if (indent <= 4) {
        break;
      }
      
      // Top-level field entries are at 6 spaces: "      - "
      // Match both inline style and multi-line style
      const inlineMatch = line.match(/^      - \{\s*name:\s*([a-zA-Z_][a-zA-Z0-9_-]*)/);
      const multiLineMatch = line.match(/^      - name:\s*([a-zA-Z_][a-zA-Z0-9_-]*)/);
      
      if (inlineMatch) {
        names.push(inlineMatch[1]);
      } else if (multiLineMatch) {
        names.push(multiLineMatch[1]);
      }
    }
  }
  
  return names;
}

/**
 * Filter a collection block to only include specified fields
 */
function filterCollectionFields(block, keysToKeep) {
  const lines = block.split('\n');
  const result = [];
  
  let inMainFields = false;
  let inFieldEntry = false;
  let currentFieldName = null;
  let currentFieldLines = [];
  let fieldEntryBaseIndent = 6; // "      - " is 6 spaces before the dash
  let fieldsKept = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    
    // Detect start of main fields section (exactly 4 spaces)
    if (line.match(/^    fields:\s*$/)) {
      // Flush any pending field first
      if (inFieldEntry && currentFieldName && keysToKeep.has(currentFieldName)) {
        result.push(...currentFieldLines);
        fieldsKept++;
      }
      
      inMainFields = true;
      inFieldEntry = false;
      currentFieldLines = [];
      currentFieldName = null;
      result.push(line);
      continue;
    }
    
    // If not in main fields, just pass through
    if (!inMainFields) {
      result.push(line);
      continue;
    }
    
    // Check if we're exiting main fields (non-empty line at indent <= 4)
    if (trimmed !== '' && indent <= 4) {
      // Flush pending field
      if (inFieldEntry && currentFieldName && keysToKeep.has(currentFieldName)) {
        result.push(...currentFieldLines);
        fieldsKept++;
      }
      
      // No longer in main fields, pass through rest
      inMainFields = false;
      inFieldEntry = false;
      result.push(line);
      continue;
    }
    
    // Check if this starts a new top-level field (at indent 6)
    const inlineMatch = line.match(/^      - \{\s*name:\s*([a-zA-Z_][a-zA-Z0-9_-]*)/);
    const multiLineMatch = line.match(/^      - name:\s*([a-zA-Z_][a-zA-Z0-9_-]*)/);
    
    if (inlineMatch || multiLineMatch) {
      // Flush previous field if keeping
      if (inFieldEntry && currentFieldName && keysToKeep.has(currentFieldName)) {
        result.push(...currentFieldLines);
        fieldsKept++;
      }
      
      // Start new field
      currentFieldName = inlineMatch ? inlineMatch[1] : multiLineMatch[1];
      currentFieldLines = [line];
      inFieldEntry = true;
      continue;
    }
    
    // If we're in a field entry, accumulate lines
    if (inFieldEntry) {
      currentFieldLines.push(line);
      continue;
    }
    
    // Empty line before first field or other content
    result.push(line);
  }
  
  // Flush any remaining field
  if (inFieldEntry && currentFieldName && keysToKeep.has(currentFieldName)) {
    result.push(...currentFieldLines);
    fieldsKept++;
  }
  
  if (fieldsKept === 0) {
    return null;
  }
  
  // Ensure block ends with newline for proper separation
  let output = result.join('\n');
  if (!output.endsWith('\n')) {
    output += '\n';
  }
  return output;
}

/**
 * Prune .pages.yml to only include fields that exist in markdown files
 */
function prunePages() {
  const pagesPath = path.join(BASE_DIR, '.pages.yml');
  const content = fs.readFileSync(pagesPath, 'utf8');
  
  // Find where content: section starts (at column 0, not indented)
  const contentMatch = content.match(/^content:\s*$/m);
  if (!contentMatch) {
    console.log('Could not find content: section in .pages.yml');
    return;
  }
  
  // Find the actual position - need to find ^content: not indented
  let contentStart = -1;
  const lines = content.split('\n');
  let charPos = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'content:') {
      contentStart = charPos;
      break;
    }
    charPos += lines[i].length + 1; // +1 for newline
  }
  
  if (contentStart === -1) {
    console.log('Could not find top-level content: section in .pages.yml');
    return;
  }
  
  const beforeContent = content.substring(0, contentStart + 'content:'.length);
  const contentSection = content.substring(contentStart + 'content:'.length);
  
  // Split into collection blocks (each starts with "  - name:")
  const blockStarts = [];
  const blockRegex = /^  - name:/gm;
  let match;
  
  while ((match = blockRegex.exec(contentSection)) !== null) {
    blockStarts.push(match.index);
  }
  
  const collectionBlocks = [];
  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i < blockStarts.length - 1 ? blockStarts[i + 1] : contentSection.length;
    collectionBlocks.push(contentSection.substring(start, end));
  }
  
  // Process each collection
  const prunedBlocks = [];
  const stats = {
    collectionsKept: 0,
    collectionsRemoved: [],
    fieldsRemoved: {}
  };
  
  for (const block of collectionBlocks) {
    const meta = parseCollectionMeta(block);
    
    // Skip file-based collections (JSON files, not markdown)
    if (meta.type === 'file' || !meta.path) {
      prunedBlocks.push(block);
      stats.collectionsKept++;
      console.log(`  [keep] ${meta.name} (file-based collection)`);
      continue;
    }
    
    // Get markdown files for this collection
    const mdFiles = getMarkdownFiles(meta.path, meta.subfolders);
    
    if (mdFiles.length === 0) {
      stats.collectionsRemoved.push(meta.name);
      console.log(`  [remove] ${meta.name} (no markdown files in ${meta.path}/)`);
      continue;
    }
    
    // Collect all front matter keys used across all files
    const usedKeys = new Set(ALWAYS_KEEP_FIELDS);
    for (const file of mdFiles) {
      const fileKeys = extractFrontMatterKeys(file);
      fileKeys.forEach(key => usedKeys.add(key));
    }
    
    // Get field names defined in this collection
    const definedFields = getFieldNames(block);
    const fieldsToRemove = definedFields.filter(f => !usedKeys.has(f) && !ALWAYS_KEEP_FIELDS.includes(f));
    
    if (fieldsToRemove.length > 0) {
      stats.fieldsRemoved[meta.name] = fieldsToRemove;
    }
    
    // Filter the block
    const filteredBlock = filterCollectionFields(block, usedKeys);
    
    if (filteredBlock === null) {
      stats.collectionsRemoved.push(meta.name);
      console.log(`  [remove] ${meta.name} (no matching fields after pruning)`);
      continue;
    }
    
    prunedBlocks.push(filteredBlock);
    stats.collectionsKept++;
    
    const keptCount = definedFields.length - fieldsToRemove.length;
    console.log(`  [keep] ${meta.name} (${mdFiles.length} files, ${keptCount}/${definedFields.length} fields)`);
  }
  
  // Reconstruct the file - ensure each block is separated by blank line
  const normalizedBlocks = prunedBlocks.map(block => {
    // Trim trailing whitespace but keep one trailing newline
    let trimmed = block.replace(/\s+$/, '');
    return trimmed + '\n';
  });
  
  const prunedContent = beforeContent + '\n' + normalizedBlocks.join('\n');
  fs.writeFileSync(pagesPath, prunedContent);
  
  // Print summary
  console.log('\n=== Prune Summary ===');
  console.log(`Collections kept: ${stats.collectionsKept}`);
  console.log(`Collections removed: ${stats.collectionsRemoved.length}`);
  if (stats.collectionsRemoved.length > 0) {
    console.log(`  ${stats.collectionsRemoved.join(', ')}`);
  }
  
  const totalFieldsRemoved = Object.values(stats.fieldsRemoved).flat().length;
  console.log(`Fields pruned: ${totalFieldsRemoved}`);
  for (const [collection, fields] of Object.entries(stats.fieldsRemoved)) {
    console.log(`  ${collection}: ${fields.join(', ')}`);
  }
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const shouldPrune = args.includes('--prune');
  
  updatePages();
  
  if (shouldPrune) {
    console.log('\nPruning .pages.yml to match existing markdown files...\n');
    prunePages();
    console.log('\nDone! .pages.yml has been pruned.');
  }
}

if (require.main === module) main();

module.exports = { updatePages, prunePages };
