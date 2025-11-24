const fs = require('fs');
const path = require('path');
const { downloadImage } = require('../utils/image-downloader');

/**
 * Extract homepage content from the old site index.html using regex
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

    // Extract special offer banner message
    const specialOfferMatch = html.match(/<div class="col-12 col-md-9[^>]*>\s*<p class="m-0[^>]*>([^<]+)<\/p>\s*<\/div>\s*<div class="col-12 col-md-3[^>]*>\s*<a href="([^"]+)"/);
    if (specialOfferMatch) {
      homeContent.banner.special_offer.message = specialOfferMatch[1].trim();
      homeContent.banner.special_offer.link = `/${specialOfferMatch[2].replace('.php.html', '')}/#content`;
    }

    // Extract banner carousel images
    const carouselPattern = /<div class="carousel-item[^>]*>\s*<img src="([^"]+)"/g;
    let carouselMatch;
    let bannerIndex = 0;
    while ((carouselMatch = carouselPattern.exec(html)) !== null) {
      const imageUrl = carouselMatch[1].trim();
      const localImagePath = await downloadImage(imageUrl, 'home', `banner-${bannerIndex}`);
      if (localImagePath) {
        homeContent.banner.images.push(localImagePath);
        bannerIndex++;
      }
    }

    // Extract service cards section with images
    const serviceCardPattern = /<div class="col-xl-4[^>]*>[\s\S]*?<img src="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*style="color:[^"]*">([^<]+)<\/h3>[\s\S]*?<p class="card-text py-2">([^<]+)<\/p>[\s\S]*?<a href="([^"]+)"[^>]*>More Info<\/a>/g;
    let cardMatch;
    while ((cardMatch = serviceCardPattern.exec(html)) !== null) {
      const title = cardMatch[2].trim();
      const imageUrl = cardMatch[1].trim();
      const slug = title.toLowerCase().replace(/\s+/g, '-');
      const localImagePath = await downloadImage(imageUrl, 'home', slug);

      homeContent.hero.service_cards.push({
        title,
        description: cardMatch[3].trim(),
        link: `/${cardMatch[4].replace('.php.html', '')}/#content`,
        image: localImagePath || imageUrl
      });
    }

    // Extract main content paragraphs
    const homePageSection = html.match(/<section class="home-page">([\s\S]*?)<\/section>/);
    if (homePageSection) {
      const sectionContent = homePageSection[1];
      const firstColumn = sectionContent.match(/<div id="column_NQZ91"[^>]*>([\s\S]*?)<\/div>\s*<div id="column_EOJ8N"/);

      if (firstColumn) {
        const paragraphPattern = /<p class="ql-align-justify">([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*?)<\/p>/g;
        let pMatch;
        while ((pMatch = paragraphPattern.exec(firstColumn[1])) !== null) {
          const text = pMatch[1].replace(/<[^>]+>/g, '').replace(/&apos;/g, "'").trim();
          if (!text.includes('DBS checked')) {
            homeContent.main_content.paragraphs.push(text);
          }
        }

        // Extract DBS highlight
        const highlightMatch = firstColumn[1].match(/<strong[^>]*style="color:[^"]*">([^<]+)<\/strong>/);
        if (highlightMatch) {
          homeContent.main_content.highlight = highlightMatch[1].trim();
        }
      }
    }

    // Extract "Why Choose Us" features with icon mapping
    const featurePattern = /<div class="text-center[^>]*><strong>([^<]+)<\/strong><\/div>/g;
    let featureMatch;
    let featureIndex = 0;
    const iconMap = [
      "/assets/icons/fully-certified-engineers.svg",
      "/assets/icons/24-7-service.svg",
      "/assets/icons/shield.svg",
      "/assets/icons/tools.svg"
    ];
    while ((featureMatch = featurePattern.exec(html)) !== null) {
      const title = featureMatch[1].trim();
      if (title && !title.includes('Our Service Areas')) {
        const feature = { title };
        if (featureIndex < iconMap.length) {
          feature.icon = iconMap[featureIndex];
        }
        homeContent.why_choose_us.features.push(feature);
        featureIndex++;
      }
    }


    // Write the JSON file
    fs.writeFileSync(outputPath, JSON.stringify(homeContent, null, 2));

    console.log('✅ Homepage content extracted successfully');
    console.log(`   - ${homeContent.banner.images.length} banner images`);
    console.log(`   - Special offer: ${homeContent.banner.special_offer.message ? 'Yes' : 'No'}`);
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
