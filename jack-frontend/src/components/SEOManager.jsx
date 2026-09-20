// src/components/SEOManager.jsx
import React, { useEffect } from 'react';

/**
 * 🔥 TASK #54: Dynamic SEO Manager for Per-Product & Page Metadata
 * Dynamically manages title, description, canonical URLs, Open Graph (OG), Twitter cards, and JSON-LD schemas.
 */
const SEOManager = ({
  title = "Jack Essentials — Premium E-Commerce & Lifestyle Store",
  description = "Shop premium products, electronics, home decor, and fashion at Jack Essentials with secure payments, cashfree gateway, and fast pan-India delivery.",
  canonicalUrl = typeof window !== 'undefined' ? window.location.href : "https://thejackessentials.com",
  ogImage = "https://thejackessentials.com/og-banner.jpg",
  ogType = "website",
  twitterCard = "summary_large_image",
  schema = null
}) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Update Document Title
    document.title = title;

    // 2. Helper function to create or update meta tags (OG & standard)
    const setMetaTag = (keyName, value, isProperty = true) => {
      const attr = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${keyName}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, keyName);
        document.head.appendChild(element);
      }
      element.setAttribute('content', value);
    };

    // Standard Meta Description
    setMetaTag('description', description, false);

    // 3. Update Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 4. Open Graph (OG) Meta Tags for Social Sharing & Rich Previews
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:image', ogImage, true);
    setMetaTag('og:url', canonicalUrl, true);
    setMetaTag('og:type', ogType, true);

    // 5. Twitter Card Meta Tags
    setMetaTag('twitter:card', twitterCard, false);
    setMetaTag('twitter:title', title, false);
    setMetaTag('twitter:description', description, false);
    setMetaTag('twitter:image', ogImage, false);

    // 6. JSON-LD Structured Data Schema Injection (Product, Breadcrumbs, etc.)
    let schemaScript = document.querySelector('script#dynamic-seo-schema');
    if (schema) {
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'dynamic-seo-schema';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(schema);
    } else if (schemaScript) {
      schemaScript.remove();
    }
  }, [title, description, canonicalUrl, ogImage, ogType, twitterCard, schema]);

  return null; // Headless component managing document head metadata
};

export default SEOManager;