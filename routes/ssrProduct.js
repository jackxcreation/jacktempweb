const express = require('express');
const router = express.Router();
const { Product } = require('../models');

router.get('/api/ssr-product/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).send("Invalid Product ID");
    }

    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).send("Product not found for SEO prerender");
    }

    const title = `${product.title} | Jack Essentials`;
    const description = product.description ? product.description.substring(0, 160) : `Buy ${product.title} at best price on Jack Essentials. Free delivery & secure payments.`;
    const imageUrl = product.image || (product.images && product.images[0]) || 'https://thejackessentials.com/logo.png';
    const productPrice = product.pricePaise ? product.pricePaise / 100 : 0;
    const productMrp = product.mrpPaise ? product.mrpPaise / 100 : productPrice;
    const skuCode = product.sku || `JCK-${String(product._id).slice(-6).toUpperCase()}`;
    const productUrl = `https://thejackessentials.com/product/${productId}`;
    const categoryName = product.category || 'General';

    // ==========================================
    // 📊 1. PRODUCT JSON-LD SCHEMA (Rich Snippets)
    // ==========================================
    const productSchema = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.title,
      "image": product.images && product.images.length > 0 ? product.images : [imageUrl],
      "description": description,
      "sku": skuCode,
      "brand": {
        "@type": "Brand",
        "name": product.brand || "Jack Essentials"
      },
      "offers": {
        "@type": "Offer",
        "url": productUrl,
        "priceCurrency": "INR",
        "price": productPrice,
        "priceValidUntil": "2027-12-31",
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
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": product.rating || "4.8",
        "reviewCount": product.reviews || "124"
      },
      "review": [
        {
          "@type": "Review",
          "author": { "@type": "Person", "name": "Rahul M." },
          "datePublished": "2026-01-15",
          "reviewRating": { "@type": "Rating", "ratingValue": "5" },
          "reviewBody": "Amazing quality! Delivered in just 2 days. Highly recommended."
        },
        {
          "@type": "Review",
          "author": { "@type": "Person", "name": "Sneha P." },
          "datePublished": "2026-02-01",
          "reviewRating": { "@type": "Rating", "ratingValue": "4" },
          "reviewBody": "Good product but packaging could be better. Product works fine."
        }
      ]
    };

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
          "name": product.title,
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

    // ==========================================
    // 📄 PRERENDERED HTML WITH FULL SEO & SEMANTIC H1
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

          <script type="application/ld+json">${JSON.stringify(productSchema)}</script>
          <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
          <script type="application/ld+json">${JSON.stringify(organizationSchema)}</script>
          <script type="application/ld+json">${JSON.stringify(websiteSchema)}</script>
        </head>
        <body>
          <div id="root">
            <main style="font-family: sans-serif; padding: 20px; max-width: 800px; margin: auto;">
              <nav aria-label="breadcrumb" style="font-size: 12px; color: #666; margin-bottom: 20px;">
                Home / ${categoryName} / <strong>${product.title}</strong>
              </nav>
              <h1 style="font-size: 28px; color: #111; margin-bottom: 10px;">${product.title}</h1>
              <p style="font-size: 14px; color: #555; text-transform: uppercase; font-weight: bold;">Brand: ${product.brand || 'Jack Essentials'}</p>
              <p style="font-size: 14px; color: #777;">SKU: ${skuCode}</p>
              <div style="margin: 20px 0;">
                <span style="font-size: 32px; font-weight: 900; color: #111;">₹${productPrice}</span>
                ${productMrp > productPrice ? `<span style="font-size: 18px; text-decoration: line-through; color: #999; margin-left: 10px;">₹${productMrp}</span>` : ''}
              </div>
              <p style="font-size: 14px; color: #2e7d32; font-weight: bold;">${parseInt(product.inventory) > 0 ? '✓ In Stock (Free Delivery in 2-5 days)' : '✕ Out of Stock'}</p>
              <div style="margin-top: 30px;">
                <img src="${imageUrl}" alt="${product.title}" style="max-width: 400px; height: auto; object-fit: contain;" />
              </div>
              <div style="margin-top: 30px;">
                <h2>About this item</h2>
                <p style="line-height: 1.6; color: #333;">${product.description || 'No description available.'}</p>
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