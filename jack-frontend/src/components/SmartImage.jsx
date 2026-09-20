// src/components/SmartImage.jsx
import React, { useState } from 'react';

/**
 * 🔥 TASK #58: Universal SmartImage Component with Broken-Image Fallback & Lazy Loading
 */
const DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80'; // Reliable high-quality fallback placeholder

const SmartImage = ({
  src,
  alt = 'Jack Essentials Product Image',
  fallbackSrc = DEFAULT_FALLBACK,
  className = '',
  loading = 'lazy',
  width,
  height,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  // Handle broken image links gracefully
  const handleError = () => {
    if (!hasError && imgSrc !== fallbackSrc) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={`transition-opacity duration-300 object-cover ${className}`}
      loading={loading}
      width={width}
      height={height}
      onError={handleError}
      {...props}
    />
  );
};

export default SmartImage;