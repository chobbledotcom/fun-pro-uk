const path = require('path');
const fs = require('fs');
const config = require('../config');
const { readHtmlFile, ensureDir, writeMarkdownFile } = require('../utils/filesystem');

/**
 * Escape special characters for YAML strings
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeYamlString = (str) => {
  if (!str) return '';
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
};

/**
 * Generate frontmatter for team member content
 * Following the schema from .pages.yml:
 * - title (Name)
 * - thumbnail (Thumbnail image)
 * - snippet (Role)
 * - image (Profile Image)
 * - header_image (Header Image)
 * - body (Biography)
 *
 * @param {Object} member - Team member data
 * @returns {string} Frontmatter YAML
 */
const generateTeamFrontmatter = (member) => {
  let frontmatter = `---
title: "${escapeYamlString(member.name)}"
snippet: "${escapeYamlString(member.role)}"`;

  if (member.localImage) {
    frontmatter += `\nimage: "${member.localImage}"`;
    frontmatter += `\nthumbnail: "${member.localImage}"`;
  }

  frontmatter += '\n---';
  return frontmatter;
};

/**
 * Copy team member image to local images directory
 * @param {string} sourcePath - Relative path from old_site (e.g., '../userfiles/file/FunPro/Me/me.jpg')
 * @param {string} slug - Team member slug for naming the file
 * @param {string} imagesDir - Target images directory
 * @returns {string} Local image path for frontmatter (e.g., '/images/team/colin.jpg')
 */
const copyTeamImage = (sourcePath, slug, imagesDir) => {
  if (!sourcePath) return '';

  // Resolve the source path relative to old_site/pages
  let resolvedSource = sourcePath;
  if (sourcePath.startsWith('../')) {
    resolvedSource = path.join(config.OLD_SITE_PATH, 'pages', sourcePath);
  } else if (sourcePath.startsWith('/')) {
    resolvedSource = path.join(config.OLD_SITE_PATH, sourcePath);
  } else {
    resolvedSource = path.join(config.OLD_SITE_PATH, sourcePath);
  }

  // Normalize the path
  resolvedSource = path.normalize(resolvedSource);

  if (!fs.existsSync(resolvedSource)) {
    console.log(` (image not found: ${resolvedSource})`);
    return '';
  }

  // Get the file extension from the source
  const ext = path.extname(resolvedSource) || '.jpg';

  // Create team images directory
  const teamImagesDir = path.join(imagesDir, 'team');
  ensureDir(teamImagesDir);

  // Copy the image with the team member's name
  const destFilename = `${slug}${ext}`;
  const destPath = path.join(teamImagesDir, destFilename);

  fs.copyFileSync(resolvedSource, destPath);

  return `/images/team/${destFilename}`;
};

/**
 * Extract team members from the meet-the-team.html page
 * @param {string} htmlContent - HTML content of the page
 * @returns {Array} Array of team member objects
 */
const extractTeamMembers = (htmlContent) => {
  const teamMembers = [];

  // Extract the body content section
  const bodyContentMatch = htmlContent.match(/<div id="BodyContent"[^>]*>([\s\S]*?)<\/div>\s*<script>/i);
  if (!bodyContentMatch) {
    return teamMembers;
  }

  const bodyContent = bodyContentMatch[1];

  // Look for the team section content
  const teamSectionMatch = bodyContent.match(/<section[^>]*id="meet-the-team"[^>]*>([\s\S]*?)<\/section>/i);
  const contentToSearch = teamSectionMatch ? teamSectionMatch[1] : bodyContent;

  // Extract all images from the content
  const imageMatches = [...contentToSearch.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)];

  // Parse for team member patterns
  // For Fun Pro UK: "Colin — Colin is our MD and is the one where all the Fun begins"
  const colinPattern = /Colin[^\.]*?MD[^\.]*\./i;
  const hasColin = colinPattern.test(contentToSearch) || contentToSearch.toLowerCase().includes('colin');

  if (hasColin) {
    // Find the first image that's likely a person photo
    let sourceImagePath = '';
    for (const imgMatch of imageMatches) {
      const src = imgMatch[1];
      // Skip logos, icons, etc
      if (src.includes('logo') || src.includes('icon') || src.includes('banner')) {
        continue;
      }
      sourceImagePath = src;
      break;
    }

    teamMembers.push({
      name: 'Colin',
      role: 'Managing Director',
      sourceImage: sourceImagePath,
      bio: 'Colin is the MD and is the one where all the Fun begins.'
    });
  }

  // Look for additional team members in structured format (if any)
  // This regex looks for patterns like: Name - Role or Name (Role)
  const structuredMemberPattern = /<(?:h[2-4]|strong|b)[^>]*>([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)<\/(?:h[2-4]|strong|b)>[\s\S]*?(?:(?:[-–—]|role:|position:)\s*([A-Za-z\s]+))?/gi;

  let memberMatch;
  while ((memberMatch = structuredMemberPattern.exec(contentToSearch)) !== null) {
    const name = memberMatch[1].trim();
    const role = memberMatch[2] ? memberMatch[2].trim() : '';

    // Skip if it's "Colin" (already added) or common headings
    if (name.toLowerCase() === 'colin' ||
        name.toLowerCase() === 'meet' ||
        name.toLowerCase() === 'team' ||
        name.toLowerCase() === 'the') {
      continue;
    }

    // Check if this member already exists
    const exists = teamMembers.some(m => m.name.toLowerCase() === name.toLowerCase());
    if (!exists && name.length > 2 && name.length < 50) {
      teamMembers.push({
        name,
        role: role || 'Team Member',
        sourceImage: '',
        bio: ''
      });
    }
  }

  return teamMembers;
};

/**
 * Convert team members from the old site to markdown files
 * @returns {Promise<Object>} Conversion results
 */
const convertTeam = async () => {
  console.log('Converting team members...');

  const outputDir = path.join(config.OUTPUT_BASE, 'team');
  const imagesDir = path.join(config.OUTPUT_BASE, 'images');
  const meetTheTeamPath = path.join(config.OLD_SITE_PATH, 'pages', 'meet-the-team.html');

  // Check if source file exists
  if (!fs.existsSync(meetTheTeamPath)) {
    console.log('  No meet-the-team.html found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  const htmlContent = readHtmlFile(meetTheTeamPath);
  const teamMembers = extractTeamMembers(htmlContent);

  if (teamMembers.length === 0) {
    console.log('  No team members found, skipping...');
    return { successful: 0, failed: 0, total: 0 };
  }

  console.log(`  Found ${teamMembers.length} team member(s)`);

  // Ensure output directory exists
  ensureDir(outputDir);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < teamMembers.length; i++) {
    const member = teamMembers[i];
    try {
      const slug = member.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      process.stdout.write(`  [${i + 1}/${teamMembers.length}] Converting: ${slug}...`);

      // Copy the image locally
      const localImage = copyTeamImage(member.sourceImage, slug, imagesDir);
      member.localImage = localImage;

      const frontmatter = generateTeamFrontmatter(member);
      const content = `${frontmatter}\n\n# ${member.name}\n\n${member.bio}`;

      const filename = `${slug}.md`;
      writeMarkdownFile(path.join(outputDir, filename), content);

      console.log(' ✓');
      successful++;
    } catch (error) {
      console.log(' ✗ FAILED');
      console.error(`    Error: ${error.message}`);
      failed++;
    }
  }

  return { successful, failed, total: teamMembers.length };
};

module.exports = {
  convertTeam,
  extractTeamMembers,
  generateTeamFrontmatter
};
