// src/components/ProductSchema.jsx
import React from 'react';

/**
 * 🔥 TASK #55: Google-Friendly Product Structured Data Component
 * Generates and injects JSON-LD schema for Product, Offer, AggregateRating, and BreadcrumbList.
 */
const ProductSchema = ({ product, breadcrumbs = [] }) => {
  if (!product) return null;

  const productPriceNum = product.pricePaise ? product.pricePaise / 100 : (product.price || 0);
  const skuCode = product.sku || `JCK-${String(product.id || product._id || '').slice(-6).toUpperCase()}`;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : `https://thejackessentials.com/product/${product.id || product._id}`;
  const productImages = product.images && product.images.length > 0 ? product.images : [product.image || 'https://thejackessentials.com/logo.png'];
  const description = product.description ? product.description.substring(0, 160) : `Buy ${product.title} at best price on Jack Essentials.`;

  // Default SEO breadcrumbs if none provided
  const defaultBreadcrumbs = [
    { name: 'Home', item: 'https://thejackessentials.com/' },
    { name: product.category || 'Shop', item: `https://thejackessentials.com/shop` },
    { name: product.title, item: currentUrl }
  ];

  const activeBreadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : defaultBreadcrumbs;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@graph": [
      {
        "@type": "Product",
        "name": product.title,
        "image": productImages,
        "description": description,
        "sku": skuCode,
        "brand": {
          "@type": "Brand",
          "name": product.brand || "Jack Essentials"
        },
        "offers": {
          "@type": "Offer",
          "url": currentUrl,
          "priceCurrency": "INR",
          "price": productPriceNum,
          "priceValidUntil": "2027-12-31",
          "itemCondition": "https://schema.org/NewCondition",
          "availability": parseInt(product.inventory || 1) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "seller": {
            "@type": "Organization",
            "name": "Jack Essentials"
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": product.rating || "4.8",
          "reviewCount": product.reviews || "124"
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": activeBreadcrumbs.map((bc, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": bc.name,
          "item": bc.item
        }))
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
};

export default ProductSchema;