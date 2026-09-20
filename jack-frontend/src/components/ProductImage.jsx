// src/components/ProductImage.jsx
import React, { useState } from 'react';

/**
 * 🔥 TASKS #54 - #58: Optimized Responsive Product Image Component
 * Supports WebP/AVIF format switching, responsive sizes, lazy loading, width/height attributes, and CDN optimization.
 */
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80';

const ProductImage = ({
  src,
  alt = 'Jack Essentials Product',
  className = '',
  width = 500,
  height = 500,
  priority = false, // Set true for above-the-fold hero images (disables lazy loading)
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = useState(src || FALLBACK_IMAGE);
  const [hasError, setHasError] = useState(false);

  // Handle broken image fallback (Task #58 integration)
  const handleError = () => {
    if (!hasError && currentSrc !== FALLBACK_IMAGE) {
      setHasError(true);
      setCurrentSrc(FALLBACK_IMAGE);
    }
  };

  // Helper to construct CDN optimized URLs with format and size parameters (Task #57)
  const getCdnUrl = (originalUrl, format = 'jpg', w = width) => {
    if (!originalUrl) return FALLBACK_IMAGE;
    if (originalUrl.includes('images.unsplash.com')) {
      return `${originalUrl.split('?')[0]}?auto=format&fit=crop&w=${w}&q=80&fm=${format}`;
    }
    return originalUrl;
  };

  return (
    <picture className={`block overflow-hidden ${className}`}>
      {/* 🔥 Modern AVIF Source for maximum compression */}
      <source 
        srcSet={getCdnUrl(currentSrc, 'avif', width)} 
        type="image/avif" 
      />
      
      {/* 🔥 Modern WebP Source for wide browser support */}
      <source 
        srcSet={getCdnUrl(currentSrc, 'webp', width)} 
        type="image/webp" 
      />

      {/* 🔥 Fallback standard image with strict performance attributes */}
      <img
        src={getCdnUrl(currentSrc, 'jpg', width)}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onError={handleError}
        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        {...props}
      />
    </picture>
  );
};

export default ProductImage;