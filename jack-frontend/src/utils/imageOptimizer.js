// utils/imageOptimizer.js

/**
 * Optimizes image URLs for various CDNs (Cloudinary, Unsplash, ImageKit) with responsive widths and formats.
 */
export const getOptimizedImageUrl = (url, width = 400) => {
  if (!url || typeof url !== 'string') return '/logo.png';
  
  const trimmedUrl = url.trim();

  // 1. Cloudinary Optimization
  if (trimmedUrl.includes('cloudinary.com')) {
    if (trimmedUrl.includes('/upload/')) {
      const parts = trimmedUrl.split('/upload/');
      // f_auto (best modern format like WebP/AVIF), q_auto (optimized quality), w_<width> (exact required size)
      const transformation = `f_auto,q_auto,w_${width},c_limit`;
      return `${parts[0]}/upload/${transformation}/${parts[1]}`;
    }
  }

  // 2. Unsplash Optimization
  if (trimmedUrl.includes('images.unsplash.com')) {
    const baseUrl = trimmedUrl.split('?')[0];
    return `${baseUrl}?w=${width}&auto=format&fit=crop&q=80`;
  }

  // 3. 🔥 NEW: ImageKit CDN Optimization Support
  if (trimmedUrl.includes('ik.imagekit.io')) {
    const separator = trimmedUrl.includes('?') ? '&' : '?';
    return `${trimmedUrl}${separator}tr=w-${width},f-auto,q-80`;
  }

  // 4. Standard or local image fallback
  return trimmedUrl;
};

/**
 * 🔥 NEW HELPER: Generates a tiny, highly compressed blurred placeholder for lazy loading/LQIP effects.
 */
export const getLowQualityImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '/logo.png';
  
  const trimmedUrl = url.trim();

  if (trimmedUrl.includes('cloudinary.com') && trimmedUrl.includes('/upload/')) {
    const parts = trimmedUrl.split('/upload/');
    return `${parts[0]}/upload/f_auto,q_30,w_40,e_blur:1000/${parts[1]}`;
  }
  
  if (trimmedUrl.includes('images.unsplash.com')) {
    const baseUrl = trimmedUrl.split('?')[0];
    return `${baseUrl}?w=40&auto=format&fit=crop&q=20&blur=10`;
  }

  if (trimmedUrl.includes('ik.imagekit.io')) {
    const separator = trimmedUrl.includes('?') ? '&' : '?';
    return `${trimmedUrl}${separator}tr=w-40,f-auto,q-20,bl-30`;
  }

  return trimmedUrl;
};