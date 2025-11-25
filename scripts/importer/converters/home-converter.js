const fs = require('fs');
const path = require('path');
const { downloadImage } = require('../utils/image-downloader');

/**
 * Extract homepage content from the old site index.html
 * Updated for Fun Pro UK HTML structure
 * @returns {Object} Conversion results
 */
const convertHomeContent = async () => {
  console.log('Converting homepage content...');

  const oldSitePath = path.join(__dirname, '../../../old_site/index.html');
  const outputPath = path.join(__dirname, '../../../_data/home_content.json');

  try {
    const html = fs.readFileSync(oldSitePath, 'utf-8');

    const homeContent = {
      banner: {
        special_offer: {
          message: "",
          link: ""
        },
        images: []
      },
      hero: {
        service_cards: []
      },
      main_content: {
        paragraphs: [],
        highlight: ""
      },
      why_choose_us: {
        heading: "Why Choose Us?",
        features: []
      },
      reviews: {
        heading: "Our Reviews"
      }
    };

    // Extract ticker/news banner message
    const tickerMatch = html.match(/<div class="ticker__text-inner">\s*([\s\S]*?)\s*<\/div>/);
    if (tickerMatch) {
      const tickerText = tickerMatch[1].replace(/<[^>]+>/g, '').trim();
      homeContent.banner.special_offer.message = tickerText;
      homeContent.banner.special_offer.link = "/contact/";
    }

    // Extract banner carousel images (Fun Pro UK uses data-lazy-load attributes)
    const bannerPattern = /<div class="item[^"]*">\s*<a[^>]*href="([^"]+)"[^>]*><img[^>]*data-lazy-load="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g;
    let bannerMatch;
    let bannerIndex = 0;
    while ((bannerMatch = bannerPattern.exec(html)) !== null) {
      const imageFilename = bannerMatch[2];
      // Try to download from old site's userfiles/banners directory
      const imageUrl = `https://www.funprouk.co.uk/userfiles/banners/${imageFilename}`;
      const localImagePath = await downloadImage(imageUrl, 'home', `banner-${bannerIndex}`);
      if (localImagePath) {
        homeContent.banner.images.push(localImagePath);
      }
      bannerIndex++;
    }

    // Extract featured categories (service cards)
    const categoryPattern = /<div class="featured-categories__category-panel[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<div class="featured-categories__title">([^<]+)<\/div>/g;
    let cardMatch;
    let cardIndex = 0;
    while ((cardMatch = categoryPattern.exec(html)) !== null) {
      const link = cardMatch[1].trim();
      const imageUrl = cardMatch[2].trim();
      const title = cardMatch[3].trim();

      // Convert link to new format
      let newLink = link
        .replace('.html', '')
        .replace('#BodyContent', '')
        .replace(/^(category|Controls\/category)\//, '/category/')
        .replace(/^theme\/category\//, '/category/')
        .replace(/^([^/])/, '/$1');

      // Download the image
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const localImagePath = await downloadImage(imageUrl, 'home', `service-${slug}`);

      homeContent.hero.service_cards.push({
        title,
        description: `${title} for corporate events, exhibitions, and parties across the UK.`,
        link: newLink + '/',
        image: localImagePath || imageUrl
      });
      cardIndex++;
    }

    // Extract main content heading
    const headingMatch = html.match(/<div class="text-center margin-bottom-40">\s*<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (headingMatch) {
      const headingText = headingMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      homeContent.main_content.highlight = headingText;
    }

    // Extract meta description for main content
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (descMatch) {
      homeContent.main_content.paragraphs.push(descMatch[1]);
    }

    // Add Why Choose Us features based on common Fun Pro UK services
    homeContent.why_choose_us.features = [
      { title: "Nationwide Delivery", icon: "/assets/icons/delivery.svg" },
      { title: "Professional Setup", icon: "/assets/icons/tools.svg" },
      { title: "Branded Games Available", icon: "/assets/icons/branding.svg" },
      { title: "Expert Event Support", icon: "/assets/icons/support.svg" }
    ];

    // Write the JSON file
    fs.writeFileSync(outputPath, JSON.stringify(homeContent, null, 2));

    console.log('✅ Homepage content extracted successfully');
    console.log(`   - ${homeContent.banner.images.length} banner images`);
    console.log(`   - Ticker message: ${homeContent.banner.special_offer.message ? 'Yes' : 'No'}`);
    console.log(`   - ${homeContent.hero.service_cards.length} service cards`);
    console.log(`   - ${homeContent.main_content.paragraphs.length} content paragraphs`);
    console.log(`   - ${homeContent.why_choose_us.features.length} features`);

    return {
      successful: 1,
      failed: 0,
      total: 1
    };
  } catch (error) {
    console.error('❌ Error converting homepage content:', error.message);
    return {
      successful: 0,
      failed: 1,
      total: 1
    };
  }
};

module.exports = { convertHomeContent };
