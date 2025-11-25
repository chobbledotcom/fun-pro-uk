const fs = require('fs');
const path = require('path');
const { downloadImage } = require('../utils/image-downloader');

/**
 * Extract site.json and meta.json from old site's JSON-LD schema data
 * @returns {Object} Conversion results
 */
const convertSiteConfig = async () => {
  console.log('Converting site configuration...');

  const oldSitePath = path.join(__dirname, '../../../old_site/index.html');
  const siteJsonPath = path.join(__dirname, '../../../_data/site.json');
  const metaJsonPath = path.join(__dirname, '../../../_data/meta.json');

  try {
    const html = fs.readFileSync(oldSitePath, 'utf-8');

    // Extract Organization schema
    const orgSchemaMatch = html.match(/<script type="application\/ld\+json">\s*\{[^}]*"@type":\s*"Organization"[^<]*<\/script>/s);
    let orgData = {};
    if (orgSchemaMatch) {
      try {
        const jsonStr = orgSchemaMatch[0].replace(/<script type="application\/ld\+json">\s*/, '').replace(/<\/script>/, '');
        orgData = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse Organization schema:', e.message);
      }
    }

    // Extract LocalBusiness schema
    const localBusinessMatch = html.match(/<script type="application\/ld\+json">\s*\{[^}]*"@type":\s*"LocalBusiness"[^<]*<\/script>/s);
    let localBusinessData = {};
    if (localBusinessMatch) {
      try {
        const jsonStr = localBusinessMatch[0].replace(/<script type="application\/ld\+json">\s*/, '').replace(/<\/script>/, '');
        localBusinessData = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse LocalBusiness schema:', e.message);
      }
    }

    // Extract title from page
    const titleMatch = html.match(/<title>\s*([^<]+)\s*<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const metaDescription = descMatch ? descMatch[1] : '';

    // Build site.json
    const siteName = orgData.name || localBusinessData.name || 'Fun Pro UK';
    const siteUrl = orgData.url || localBusinessData.url || 'https://www.funprouk.co.uk';

    // Extract social links from sameAs arrays
    const allSameAs = [...(orgData.sameAs || []), ...(localBusinessData.sameAs || [])];
    const socials = {
      Facebook: allSameAs.find(u => u.includes('facebook.com')) || null,
      Instagram: allSameAs.find(u => u.includes('instagram.com')) || null,
      Twitter: allSameAs.find(u => u.includes('twitter.com')) || null,
      LinkedIn: allSameAs.find(u => u.includes('linkedin.com')) || null,
      TikTok: allSameAs.find(u => u.includes('tiktok.com')) || null,
      Google: null,
      WhatsApp: null,
      RSS: '/feed.xml'
    };

    const siteConfig = {
      name: siteName,
      url: siteUrl,
      socials,
      sticky_mobile_nav: true,
      horizontal_nav: true,
      template_repo_url: 'https://git.chobble.com/chobble/chobble-client'
    };

    // Build meta.json
    const address = localBusinessData.address || {};
    const contactPoint = orgData.contactPoint || localBusinessData.contactPoint || {};
    const phone = (typeof contactPoint === 'object' && contactPoint.telephone)
      ? contactPoint.telephone
      : localBusinessData.telephone || '+442477220701';

    const metaConfig = {
      language: 'en-GB',
      organization: {
        description: metaDescription || orgData.alternateName || 'Interactive game hire for corporate events, exhibitions, and parties across the UK.',
        legalName: siteName.includes('Ltd') ? siteName : `${siteName} Ltd`,
        foundingDate: '2010',
        founders: [
          {
            name: 'Fun Pro UK Team'
          }
        ],
        address: {
          streetAddress: address.streetAddress || 'Unit 7, Heath Business Park, Wolston',
          addressLocality: address.addressLocality || 'Coventry',
          addressRegion: address.addressRegion || 'West Midlands',
          postalCode: address.postalCode || 'CV8 3GB',
          addressCountry: address.addressCountry || 'GB'
        },
        contactPoint: [
          {
            telephone: phone,
            contactType: 'customer service',
            areaServed: 'GB',
            availableLanguage: ['English']
          }
        ]
      }
    };

    // Write the JSON files
    fs.writeFileSync(siteJsonPath, JSON.stringify(siteConfig, null, '\t'));
    fs.writeFileSync(metaJsonPath, JSON.stringify(metaConfig, null, '\t'));

    console.log('✅ Site configuration extracted successfully');
    console.log(`   - Site name: ${siteConfig.name}`);
    console.log(`   - Site URL: ${siteConfig.url}`);
    console.log(`   - Address: ${metaConfig.organization.address.streetAddress}, ${metaConfig.organization.address.addressLocality}`);
    console.log(`   - Phone: ${phone}`);

    return {
      successful: 2,
      failed: 0,
      total: 2
    };
  } catch (error) {
    console.error('❌ Error converting site configuration:', error.message);
    return {
      successful: 0,
      failed: 2,
      total: 2
    };
  }
};

module.exports = { convertSiteConfig };
