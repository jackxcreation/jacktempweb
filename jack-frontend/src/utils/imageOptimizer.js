// utils/imageOptimizer.js

export const getOptimizedImageUrl = (url, width = 400) => {
  if (!url) return '/logo.png';
  
  // 1. Agar Cloudinary ki image hai (e.g., res.cloudinary.com)
  if (url.includes('cloudinary.com')) {
    // Agar URL mein pehle se transformations (/upload/ ke baad) hain, toh unhe manage karo
    if (url.includes('/upload/')) {
      const parts = url.split('/upload/');
      // f_auto (best modern format like WebP/AVIF), q_auto (optimized quality), w_<width> (exact required size)
      const transformation = `f_auto,q_auto,w_${width},c_limit`;
      return `${parts[0]}/upload/${transformation}/${parts[1]}`;
    }
  }

  // 2. Agar Unsplash ki image hai toh dynamic parameters pass karo
  if (url.includes('images.unsplash.com')) {
    const baseUrl = url.split('?')[0];
    return `${baseUrl}?w=${width}&auto=format&fit=crop&q=80`;
  }

  // 3. Agar koi doosri standard image hai toh wahi return karo
  return url;
};