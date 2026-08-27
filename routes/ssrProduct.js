const express = require('express');
const router = express.Router();
// 🔥 FIX: Imported Review model to fetch actual real reviews from the database
const { Product, Review } = require('../models');

// ==========================================
// 🛡️ SECURITY FIX: HTML Escaper to prevent XSS Attacks
// ==========================================
const escapeHTML = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ==========================================
// 🚀 SEO ARCHITECTURE FIX: Route intercepts both API calls AND Direct Bot Visits
// ==========================================
router.get(['/api/ssr-product/:id', '/product/:id'], async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).send("Invalid Product ID");
    }

    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).send("Product not found for SEO prerender");
    }

    // 🔥 FETCH REAL REVIEWS FROM DB FOR SEO SCHEMA
    const actualReviews = await Review.find({ 
      $or: [{ productId: productId }, { product: productId }] 
    }).sort({ createdAt: -1 }).limit(10).lean();

    const productUrl = `https://thejackessentials.com/product/${productId}`;

    // ==========================================
    // 🤖 BOT DETECTION (Redirect normal users to React SPA)
    // ==========================================
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /bot|googlebot|crawler|spider|robot|crawling|bingbot|yandexbot|slurp|duckduckbot|baiduspider|twitterbot|facebookexternalhit|linkedinbot|whatsapp/i.test(userAgent);

    // Agar normal user direct backend ke /product/:id par aaye, toh use Frontend par bhej do
    if (!isBot && req.path.startsWith('/product/')) {
       return res.redirect(301, productUrl);
    }

    // Prepare raw variables
    const rawTitle = `${product.title} | Jack Essentials`;
    const rawDescription = product.description ? product.description.substring(0, 160) : `Buy ${product.title} at best price on Jack Essentials. Free delivery & secure payments.`;
    const rawImageUrl = product.image || (product.images && product.images[0]) || 'https://thejackessentials.com/logo.png';
    const productPrice = product.pricePaise ? product.pricePaise / 100 : 0;
    const productMrp = product.mrpPaise ? product.mrpPaise / 100 : productPrice;
    
    // 🛡️ Apply Escape HTML to all dynamic user-generated content
    const title = escapeHTML(rawTitle);
    const description = escapeHTML(rawDescription);
    const imageUrl = escapeHTML(rawImageUrl);
    const skuCode = escapeHTML(product.sku || `JCK-${String(product._id).slice(-6).toUpperCase()}`);
    const categoryName = escapeHTML(product.category || 'General');
    const safeBrand = escapeHTML(product.brand || 'Jack Essentials');
    const safeTitle = escapeHTML(product.title);
    const safeDescription = escapeHTML(product.description || 'No description available.');

    // 🔥 FIX: Generate a dynamic rolling date for priceValidUntil (Current Date + 1 Year)
    const nextYearDate = new Date();
    nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
    const dynamicValidUntil = nextYearDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // ==========================================
    // 📊 1. PRODUCT JSON-LD SCHEMA (Rich Snippets)
    // ==========================================
    const productSchema = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": safeTitle,
      "image": product.images && product.images.length > 0 ? product.images.map(escapeHTML) : [imageUrl],
      "description": description,
      "sku": product.sku || skuCode,
      "brand": {
        "@type": "Brand",
        "name": safeBrand
      },
      "offers": {
        "@type": "Offer",
        "url": productUrl,
        "priceCurrency": "INR",
        "price": productPrice,
        "priceValidUntil": dynamicValidUntil, // 🔥 Dynamically updated to stay valid forever
        "itemCondition": "https://schema.org/NewCondition",
        "availability": parseInt(product.inventory) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "seller": {
          "@type": "Organization",
          "name": "Jack Essentials"
        },
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": "0",
            "currency": "INR"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 0,
              "maxValue": 1,
              "unitCode": "DAY"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 2,
              "maxValue": 5,
              "unitCode": "DAY"
            }
          }
        },
        "hasMerchantReturnPolicy": {
          "@type": "MerchantReturnPolicy",
          "applicableCountry": "IN",
          "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
          "merchantReturnDays": 7,
          "returnMethod": "https://schema.org/ReturnByMail",
          "returnFees": "https://schema.org/FreeReturn"
        }
      }
    };

    // 🔥 DYNAMIC REVIEWS & AGGREGATE RATING INJECTION (No more hardcoded fake data)
    if (actualReviews && actualReviews.length > 0) {
      const totalRating = actualReviews.reduce((sum, rev) => sum + (rev.rating || 0), 0);
      const avgRating = (totalRating / actualReviews.length).toFixed(1);

      productSchema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": String(avgRating),
        "reviewCount": String(actualReviews.length)
      };

      productSchema.review = actualReviews.map(r => ({
        "@type": "Review",
        "author": { "@type": "Person", "name": escapeHTML(r.userName || "Customer") },
        "datePublished": new Date(r.createdAt || Date.now()).toISOString().split('T')[0],
        "reviewRating": { "@type": "Rating", "ratingValue": String(r.rating || 5) },
        "reviewBody": escapeHTML(r.comment || "")
      }));
    }

    // ==========================================
    // 🍞 2. BREADCRUMBLIST SCHEMA
    // ==========================================
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://thejackessentials.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": categoryName,
          "item": "https://thejackessentials.com/shop"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": safeTitle,
          "item": productUrl
        }
      ]
    };

    // ==========================================
    // 🏢 3. ORGANIZATION & SEARCHACTION SCHEMA
    // ==========================================
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Jack Essentials",
      "url": "https://thejackessentials.com",
      "logo": "https://thejackessentials.com/logo.png",
      "sameAs": [
        "https://www.facebook.com/thejackessentials",
        "https://www.instagram.com/thejackessentials"
      ]
    };

    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "https://thejackessentials.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://thejackessentials.com/shop?search={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };

    // 🛡️ Helper to prevent </script> injection inside JSON blobs
    const safeJsonStringify = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

    // ==========================================
    // 📄 PRERENDERED HTML WITH FULL SEO, SEMANTIC H1, AND XSS ESCAPING
    // ==========================================
    const prerenderedHtml = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title}</title>
          <meta name="description" content="${description}" />
          <link rel="canonical" href="${productUrl}" />
          
          <meta property="og:title" content="${title}" />
          <meta property="og:description" content="${description}" />
          <meta property="og:image" content="${imageUrl}" />
          <meta property="og:type" content="product" />
          <meta property="og:url" content="${productUrl}" />

          <script type="application/ld+json">${safeJsonStringify(productSchema)}</script>
          <script type="application/ld+json">${safeJsonStringify(breadcrumbSchema)}</script>
          <script type="application/ld+json">${safeJsonStringify(organizationSchema)}</script>
          <script type="application/ld+json">${safeJsonStringify(websiteSchema)}</script>
        </head>
        <body>
          <div id="root">
            <main style="font-family: sans-serif; padding: 20px; max-width: 800px; margin: auto;">
              <nav aria-label="breadcrumb" style="font-size: 12px; color: #666; margin-bottom: 20px;">
                Home / ${categoryName} / <strong>${safeTitle}</strong>
              </nav>
              <h1 style="font-size: 28px; color: #111; margin-bottom: 10px;">${safeTitle}</h1>
              <p style="font-size: 14px; color: #555; text-transform: uppercase; font-weight: bold;">Brand: ${safeBrand}</p>
              <p style="font-size: 14px; color: #777;">SKU: ${skuCode}</p>
              <div style="margin: 20px 0;">
                <span style="font-size: 32px; font-weight: 900; color: #111;">₹${productPrice}</span>
                ${productMrp > productPrice ? `<span style="font-size: 18px; text-decoration: line-through; color: #999; margin-left: 10px;">₹${productMrp}</span>` : ''}
              </div>
              <p style="font-size: 14px; color: #2e7d32; font-weight: bold;">${parseInt(product.inventory) > 0 ? '✓ In Stock (Free Delivery in 2-5 days)' : '✕ Out of Stock'}</p>
              <div style="margin-top: 30px;">
                <img src="${imageUrl}" alt="${safeTitle}" style="max-width: 400px; height: auto; object-fit: contain;" />
              </div>
              <div style="margin-top: 30px;">
                <h2>About this item</h2>
                <p style="line-height: 1.6; color: #333;">${safeDescription}</p>
              </div>
            </main>
          </div>
        </body>
      </html>
    `;

    res.send(prerenderedHtml);
  } catch (error) {
    console.error("SSR Error:", error);
    res.status(500).send("Server Error");
  }
});

module.exports = router;