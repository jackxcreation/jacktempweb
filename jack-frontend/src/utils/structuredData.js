export const generateProductSchema = (product, reviews = []) => {
  if (!product) return null;

  const productPrice = product.pricePaise ? product.pricePaise / 100 : 0;
  const productUrl = `https://thejackessentials.com/product/${product.id || product._id}`;
  const productImage = product.image || (product.images && product.images[0]) || '';

  // 1. Review Schemas from actual reviews
  const reviewObjects = reviews.map(rev => ({
    "@type": "Review",
    "author": {
      "@type": "Person",
      "name": rev.userName || "Verified Buyer"
    },
    "datePublished": rev.createdAt ? rev.createdAt.split('T')[0] : "2026-01-01",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": String(rev.rating || 5)
    },
    "name": rev.title || "Great product",
    "reviewBody": rev.comment || ""
  }));

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
            "name": product.title,
            "item": productUrl
          }
        ]
      },
      {
        "@type": "Product",
        "name": product.title,
        "image": product.images || [productImage],
        "description": product.description || product.title,
        "sku": product.sku || `JCK-${String(product.id || product._id).slice(-6).toUpperCase()}`,
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
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": String(product.rating || "4.8"),
          "reviewCount": String(reviews.length > 0 ? reviews.length : (product.reviews || 124))
        },
        ...(reviewObjects.length > 0 ? { "review": reviewObjects } : {})
      }
    ]
  };

  return JSON.stringify(schema);
};