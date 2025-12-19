/**
 * Reusable regex patterns for HTML extraction
 * Provides consistent patterns and extraction helpers
 */

const patterns = {
  title: /<title[^>]*>(.*?)<\/title>/is,
  metaTag: (name) => new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'](.*?)["']`, 'is'),
  metaProperty: (prop) => new RegExp(`<meta\\s+property=["']${prop}["']\\s+content=["'](.*?)["']`, 'is'),
  linkRel: (rel) => new RegExp(`<link\\s+rel=["']${rel}["']\\s+href=["'](.*?)["']`, 'is')
};

/**
 * FAQ-related patterns used by both HTML extractor and markdown stripper
 * Centralised here to ensure consistency
 */
const faqPatterns = {
  // Pattern to match FAQ heading text (case insensitive)
  // Matches: "FAQ", "FAQs", "Frequently Asked Questions", "Festive FAQs", etc.
  headingText: /(?:Festive\s+)?(?:FAQ|Frequently\s+Asked)/i,
  
  // HTML: Find FAQ section in HTML - h2 or p containing FAQ text, content until next h2 or end
  // Matches both <h2>FAQ</h2> and <p><strong>FAQ</strong></p> style headings
  htmlSection: /<(?:h2|p)[^>]*>(?:<[^>]*>)*\s*(?:<strong[^>]*>)?\s*(?:Festive\s+)?(?:FAQ|Frequently\s+Asked)[^<]*(?:<\/strong>)?\s*(?:<[^>]*>)*<\/(?:h2|p)>([\s\S]*?)(?=<h2|<div\s+(?:id|class)=["'](?:BCNFunnelPanel|photo-gallery|footer)|$)/gi,
  
  // HTML: Extract Q&A pairs - Format 1: <p><strong>Question?</strong><br />Answer</p>
  htmlQAPairFormat1: /<p[^>]*>(?:<[^>]*>)*\s*<strong[^>]*>([^<]+\?)<\/strong>\s*(?:<br\s*\/?[^>]*>|<\/br>)\s*([\s\S]*?)<\/p>/gi,
  
  // HTML: Extract Q&A pairs - Format 2: <h3>Question?</h3><p>Answer</p> (possibly multiple <p> tags)
  // Also handles nested tags like <h3><span><strong>Question?</strong></span></h3>
  // And trailing <br> tags after the question mark
  // Captures all consecutive <p> tags until the next <h3>, <h2>, <div>, <style>, or end of section
  htmlQAPairFormat2: /<h3[^>]*>(?:<[^>]+>)*\s*([\s\S]*?\?)(?:\s*<br\s*\/?>)?\s*(?:<\/[^>]+>)*<\/h3>\s*((?:<p[^>]*>[\s\S]*?<\/p>\s*)+)(?=<h3|<h2|<div|<style|$)/gi,
  
  // Markdown: Find FAQ section - ## heading or bold text with FAQ, content until next ## (not ###) or end
  // Handles optional bold markers (**, ****, etc.) around the heading text
  // Matches the heading line, then subsequent lines that don't start with "## " (but ### is ok)
  // Also matches standalone bold FAQ headings like "**Frequently Asked Questions**"
  markdownSection: /^(?:##\s+)?\*{0,4}(?:Festive\s+)?(?:FAQ|Frequently\s+Asked)[^\n]*(?:\n(?!##\s[^#]).*)*(?:\n|$)/gm,
  
  // Simple check: does HTML contain an FAQ section heading?
  // Matches both <h2>FAQ</h2> and <p><strong>FAQ</strong></p> style headings
  htmlHasFAQSection: /<(?:h2|p)[^>]*>(?:<[^>]*>)*\s*(?:<strong[^>]*>)?\s*(?:Festive\s+)?(?:FAQ|Frequently\s+Asked)/i
};

/**
 * Extract content using a pattern
 * @param {string} html - HTML content
 * @param {RegExp} pattern - Regex pattern
 * @param {number} group - Capture group index (default 1)
 * @returns {string} Extracted content or empty string
 */
const extract = (html, pattern, group = 1) => {
  const match = html.match(pattern);
  if (!match) return '';
  // Normalize whitespace: replace newlines and multiple spaces with single space
  return match[group].replace(/\s+/g, ' ').trim();
};

module.exports = {
  patterns,
  faqPatterns,
  extract
};
