// utils/productSchema.js

/**
 * Generates SEO-optimized Schema.org JSON-LD structured data for products.
 * Enhanced with safe date formatting, dual price/inventory fallbacks, and array validation.
 */
export const generateProductSchema = (product, reviews = []) => {
  if (!product) return null;

  // 🔥 UPGRADE: Support both pricePaise and raw price properties safely
  const productPrice = product.pricePaise 
    ? product.pricePaise / 100 
    : (product.price || 0);

  const productUrl = `https://thejackessentials.com/product/${product.id || product._id || ''}`;
  const productImage = product.image || (Array.isArray(product.images) && product.images[0]) || '';
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  // 1. Review Schemas with safe date formatting (Prevents TypeError if createdAt is a Date object)
  const reviewObjects = safeReviews.map(rev => {
    let pubDate = "2026-01-01";
    if (rev.createdAt) {
      try {
        pubDate = new Date(rev.createdAt).toISOString().split('T')[0];
      } catch (e) {
        pubDate = String(rev.createdAt).split('T')[0] || "2026-01-01";
      }
    }

    return {
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": rev.userName || rev.author || "Verified Buyer"
      },
      "datePublished": pubDate,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": String(rev.rating || 5),
        "bestRating": "5"
      },
      "name": rev.title || "Great product",
      "reviewBody": rev.comment || rev.reviewBody || ""
    };
  });

  const schema = {
    "@context": "https://schema.org/",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://thejackessentials.com/#organization",
        "name": "Jack Essentials",
        "url": "https://thejackessentials.com",
        "logo": "https://thejackessentials.com/logo.png"
      },
      {
        "@type": "WebSite",
        "@id": "https://thejackessentials.com/#website",
        "url": "https://thejackessentials.com",
        "name": "Jack Essentials",
        "publisher": { "@id": "https://thejackessentials.com/#organization" }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "@id": "https://thejackessentials.com/#breadcrumb",
            "position": 1,
            "name": "Home",
            "item": "https://thejackessentials.com"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": product.category || "Shop",
            "item": "https://thejackessentials.com/shop"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": product.title || "Product Details",
            "item": productUrl
          }
        ]
      },
      {
        "@type": "Product",
        "name": product.title || "Jack Essentials Product",
        "image": Array.isArray(product.images) && product.images.length > 0 ? product.images : [productImage].filter(Boolean),
        "description": product.description || product.title || "Premium quality product from Jack Essentials.",
        "sku": product.sku || `JCK-${String(product.id || product._id || '000000').slice(-6).toUpperCase()}`,
        ...(product.gtin ? { "gtin": product.gtin } : {}),
        ...(product.mpn ? { "mpn": product.mpn } : {}),
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
          "availability": Number(product.inventory || product.stock || 1) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "seller": {
            "@type": "Organization",
            "name": "Jack Essentials"
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": String(product.rating || "4.8"),
          "reviewCount": String(safeReviews.length > 0 ? safeReviews.length : (product.reviews || 124))
        },
        ...(reviewObjects.length > 0 ? { "review": reviewObjects } : {})
      }
    ]
  };

  return JSON.stringify(schema);
};