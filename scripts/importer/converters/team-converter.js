const path = require('path');
const fs = require('fs');
const config = require('../config');
const { ensureDir, writeMarkdownFile, readHtmlFile } = require('../utils/filesystem');
const { extractMetadata, extractContentHeading } = require('../utils/metadata-extractor');

/**
 * Extract intro text from meet-the-team page (text before team member details)
 * @param {string} htmlContent - The HTML content
 * @returns {string} Intro text
 */
const extractIntroText = (htmlContent) => {
  // Look for the first paragraph in the meet-the-team section
  const sectionMatch = htmlContent.match(/<section[^>]*id="meet-the-team"[^>]*>[\s\S]*?<h1>[^<]*<\/h1>\s*<p>([^<]+)<\/p>/i);
  if (sectionMatch) {
    return sectionMatch[1]
      .replace(/&mdash;/g, '—')
      .replace(/&nbsp;/g, ' ')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();
  }
  return '';
};

/**
 * Extract Colin's profile data from meet-the-team.html
 * @param {string} htmlContent - The HTML content
 * @returns {Object} Profile data
 */
const extractColinProfile = (htmlContent) => {
  // Extract the bio text - the intro paragraph serves as Colin's bio
  const introText = extractIntroText(htmlContent);
  
  // Extract a snippet - Colin is the MD
  const snippet = 'Managing Director';

  // Extract image path
  const imageMatch = htmlContent.match(/src="[^"]*userfiles\/file\/FunPro\/Me\/me\.jpg"/i);
  const hasImage = !!imageMatch;

  return {
    title: 'Colin',
    snippet: snippet || 'Managing Director',
    bio: introText,
    sourceImage: hasImage ? path.join(config.OLD_SITE_PATH, 'userfiles', 'file', 'FunPro', 'Me', 'me.jpg') : null
  };
};

/**
 * Generate frontmatter and content for Colin's profile
 * @param {Object} profile - Profile data
 * @returns {string} Full markdown content
 */
const generateProfileMarkdown = (profile) => {
  const frontmatter = `---
title: "${profile.title}"
snippet: "${profile.snippet}"
image: /images/team/colin.jpg
---`;

  return `${frontmatter}\n\n${profile.bio}`;
};

/**
 * Generate the meet-the-team index page with team.html layout
 * @param {Object} metadata - Extracted metadata from source HTML
 * @param {string} heading - The H1 heading from source
 * @param {string} introText - Intro paragraph text
 * @returns {string} Full markdown content
 */
const generateTeamIndexPage = (metadata, heading, introText) => {
  const metaTitle = metadata.title || 'Meet The Team';
  const metaDescription = metadata.meta_description || '';
  
  // Remove team member specific content from intro (keep just the general intro)
  // Split at "At the centre" or similar to get just the welcome text
  let cleanIntro = introText;
  const splitMatch = introText.match(/^(.*?)(?:At the centre|Colin)/i);
  if (splitMatch) {
    cleanIntro = splitMatch[1].trim();
  }
  
  return `---
meta_title: "${metaTitle}"
meta_description: "${metaDescription}"
layout: team.html
redirect_from:
  - "/pages/meet-the-team/"
eleventyNavigation:
  key: "${heading || 'Meet The Team'}"
  parent: "About Us"
  order: 3
---

# ${heading || 'Meet The Team'}

${cleanIntro}
`;
};

/**
 * Convert team data from old site
 * @returns {Promise<Object>} Conversion results
 */
const convertTeam = async () => {
  console.log('Converting team...');

  const teamDir = path.join(config.OUTPUT_BASE, 'team');
  const teamImagesDir = path.join(config.OUTPUT_BASE, 'images', 'team');
  const pagesDir = path.join(config.OUTPUT_BASE, config.paths.pages);

  // Ensure directories exist
  ensureDir(teamDir);
  ensureDir(teamImagesDir);

  let successful = 0;
  let failed = 0;

  try {
    // Read source HTML
    const sourcePath = path.join(config.OLD_SITE_PATH, 'pages', 'meet-the-team.html');
    const htmlContent = readHtmlFile(sourcePath);

    // Extract metadata and content from source
    const metadata = extractMetadata(htmlContent);
    const heading = extractContentHeading(htmlContent);
    const introText = extractIntroText(htmlContent);

    // Extract Colin's profile
    const profile = extractColinProfile(htmlContent);

    // Copy Colin's image
    if (profile.sourceImage && fs.existsSync(profile.sourceImage)) {
      const destImage = path.join(teamImagesDir, 'colin.jpg');
      fs.copyFileSync(profile.sourceImage, destImage);
      console.log('  ✓ Copied Colin\'s image to images/team/colin.jpg');
    } else {
      console.log('  ⚠ Colin\'s source image not found');
    }

    // Create Colin's profile markdown
    const profileContent = generateProfileMarkdown(profile);
    const profilePath = path.join(teamDir, 'colin.md');
    writeMarkdownFile(profilePath, profileContent);
    console.log('  ✓ Created team/colin.md');
    successful++;

    // Create team.json for collection defaults
    const teamJson = {
      tags: 'team',
      layout: 'team-member.html',
      navigationParent: heading || 'Meet The Team'
    };
    const teamJsonPath = path.join(teamDir, 'team.json');
    fs.writeFileSync(teamJsonPath, JSON.stringify(teamJson, null, '\t') + '\n');
    console.log('  ✓ Created team/team.json');

    // Create meet-the-team index page with team.html layout
    const indexContent = generateTeamIndexPage(metadata, heading, introText);
    const indexPath = path.join(pagesDir, 'meet-the-team.md');
    writeMarkdownFile(indexPath, indexContent);
    console.log('  ✓ Updated pages/meet-the-team.md with team.html layout');
    successful++;

  } catch (error) {
    console.error(`  ✗ Failed to convert team: ${error.message}`);
    failed++;
  }

  return {
    successful,
    failed,
    total: successful + failed
  };
};

module.exports = {
  convertTeam
};
