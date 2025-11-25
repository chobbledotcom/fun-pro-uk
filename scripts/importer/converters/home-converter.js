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
        highlight: "",
        body_content: "",
        lower_content: ""
      },
      popular_products: [],
      why_choose_us: {
        heading: "Why Choose Us?",
        features: []
      },
      reviews: {
        heading: "What our customers are saying..."
      },
      client_logos: [],
      delivery_areas: []
    };

    // Extract ticker/news banner message
    const tickerMatch = html.match(/<div class="ticker__text-inner">\s*([\s\S]*?)\s*<\/div>/);
    if (tickerMatch) {
      const tickerText = tickerMatch[1].replace(/<[^>]+>/g, '').trim();
      homeContent.banner.special_offer.message = tickerText;
      homeContent.banner.special_offer.link = "/contact/";
    }

    // Extract banner carousel images (Fun Pro UK uses data-lazy-load attributes)
    const bannerPattern = /<div class="item[^"]*">\s*<a[^>]*href="([^"]+)"[^>]*><img[^>]*data-lazy-load="([^"]+)"[^>]*alt="([^"]*)"[^>]*data-public-image="([^"]+)"/g;
    let bannerMatch;
    let bannerIndex = 0;
    while ((bannerMatch = bannerPattern.exec(html)) !== null) {
      const link = bannerMatch[1];
      const filename = bannerMatch[2];
      const alt = bannerMatch[3];
      const publicImage = bannerMatch[4];
      
      // Download from Cloudinary using public image ID
      const imageUrl = `https://bouncycastlenetwork-res.cloudinary.com/image/upload/${publicImage}`;
      const localImagePath = await downloadImage(imageUrl, 'home', `banner-${bannerIndex}`);
      
      if (localImagePath && localImagePath.webPath) {
        homeContent.banner.images.push({
          image: localImagePath.webPath,
          link: link.replace('.html', '/').replace('#BodyContent', ''),
          alt: alt
        });
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
        image: localImagePath || { webPath: imageUrl }
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

    // Extract main body content (BodyContent div)
    const bodyContentMatch = html.match(/<div id="BodyContent"[^>]*>([\s\S]*?)<\/div>\s*<script>/);
    if (bodyContentMatch) {
      let bodyHtml = bodyContentMatch[1];
      // Clean up the HTML - extract just the text content
      const bodyText = bodyHtml
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g, '\n\n## $1\n\n')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '\n$1\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      homeContent.main_content.body_content = bodyText;
    }

    // Extract lower content section (HomeLowerContentPanel)
    const lowerContentMatch = html.match(/<div id="ctl00_HomeLowerContentPanel"[^>]*>([\s\S]*?)<\/div>\s*<div id="ctl00_PhotoGallery"/);
    if (lowerContentMatch) {
      let lowerHtml = lowerContentMatch[1];
      // Clean up the HTML
      const lowerText = lowerHtml
        .replace(/<details>[\s\S]*?<\/details>/g, '') // Remove details sections for now
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/g, '') // Remove video embeds
        .replace(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g, '\n\n## $1\n\n')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '\n$1\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, '[$2]($1)')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
      homeContent.main_content.lower_content = lowerText;
    }

    // Extract popular products (HomeAssets section)
    const productsPattern = /<div class="castlePanel">[\s\S]*?<img[^>]*alt="([^"]*)"[^>]*data-public-image="([^"]+)"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*class="castleLink">([^<]+)<\/a>/g;
    let productMatch;
    let productIndex = 0;
    while ((productMatch = productsPattern.exec(html)) !== null && productIndex < 8) {
      const alt = productMatch[1];
      const publicImage = productMatch[2];
      const link = productMatch[3];
      const title = productMatch[4].trim();
      
      // Download product image
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const imageUrl = `https://bouncycastlenetwork-res.cloudinary.com/image/upload/f_auto,q_auto,c_limit,w_300/${publicImage}`;
      const localImagePath = await downloadImage(imageUrl, 'home', `popular-${slug}`);
      
      // Convert link
      let newLink = link
        .replace('.html', '/')
        .replace('#BodyContent', '')
        .replace(/^category\/[^/]+\/\d+\//, '/products/');
      
      homeContent.popular_products.push({
        title,
        image: localImagePath ? localImagePath.webPath : '',
        link: newLink
      });
      productIndex++;
    }

    // Extract client logos from photo gallery
    const photoGalleryPattern = /<div class="photo-gallery__slide">[\s\S]*?<img[^>]*data-public-image="([^"]+)"[^>]*>/g;
    let logoMatch;
    let logoIndex = 0;
    while ((logoMatch = photoGalleryPattern.exec(html)) !== null && logoIndex < 20) {
      const publicImage = logoMatch[1];
      const imageUrl = `https://bouncycastlenetwork-res.cloudinary.com/image/upload/f_auto,q_auto,c_limit,w_200/${publicImage}`;
      const localImagePath = await downloadImage(imageUrl, 'home', `client-logo-${logoIndex}`);
      
      if (localImagePath && localImagePath.webPath) {
        homeContent.client_logos.push({
          image: localImagePath.webPath,
          alt: 'Client logo'
        });
      }
      logoIndex++;
    }

    // Extract delivery areas from the content
    const areasMatch = html.match(/Areas we cover near you![\s\S]*?<\/p>([\s\S]*?)<p[^>]*>.*?You will find/i);
    if (areasMatch) {
      const areasText = areasMatch[1]
        .replace(/<[^>]+>/g, '\n')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s !== '&nbsp;');
      homeContent.delivery_areas = areasText;
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

    console.log('');
    console.log('Homepage content extracted successfully');
    console.log(`   - ${homeContent.banner.images.length} banner images`);
    console.log(`   - Ticker message: ${homeContent.banner.special_offer.message ? 'Yes' : 'No'}`);
    console.log(`   - ${homeContent.hero.service_cards.length} service cards`);
    console.log(`   - ${homeContent.main_content.paragraphs.length} content paragraphs`);
    console.log(`   - ${homeContent.popular_products.length} popular products`);
    console.log(`   - ${homeContent.client_logos.length} client logos`);
    console.log(`   - ${homeContent.delivery_areas.length} delivery areas`);
    console.log(`   - ${homeContent.why_choose_us.features.length} features`);

  return {
    successful: 1,
    failed: 0,
    total: 1
  };
};

module.exports = { convertHomeContent };
