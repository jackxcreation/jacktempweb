// scripts/generateSitemap.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

// Import Product model (adjust path based on whether it's root or backend)
const Product = require('../models/Product') || require('../backend/models/Product');
const { MONGO_URI } = require('../config/env') || process.env;

const generateSitemap = async () => {
  try {
    console.log("🔄 Connecting to MongoDB for Dynamic Sitemap Generation...");
    await mongoose.connect(MONGO_URI || process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB successfully.");

    // Fetch all active products from database
    const products = await Product.find({}).select('_id updatedAt').lean();
    console.log(`📦 Found ${products.length} products for sitemap indexing.`);

    const domain = 'https://thejackessentials.com';
    const currentDate = new Date().toISOString().split('T')[0];

    // Static URLs
    let sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  
  <!-- 🔥 Homepage -->
  <url>
    <loc>${domain}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- 🔥 Shop & Categories -->
  <url>
    <loc>${domain}/shop</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${domain}/shop?category=Electronics</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${domain}/shop?category=HomeDecor</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- 🔥 Dynamic Product Pages (Task #56) -->`;

    // Append dynamic product URLs
    products.forEach((product) => {
      const productId = product._id.toString();
      const lastMod = product.updatedAt ? new Date(product.updatedAt).toISOString().split('T')[0] : currentDate;
      sitemapXML += `
  <url>
    <loc>${domain}/product/${productId}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    sitemapXML += `

  <!-- 🔥 Support & Info Pages -->
  <url>
    <loc>${domain}/about</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${domain}/contact</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

</urlset>`;

    // Write to public/sitemap.xml
    const outputPath = path.join(__dirname, '../public/sitemap.xml');
    fs.writeFileSync(outputPath, sitemapXML.trim());
    console.log(`🎉 Sitemap successfully generated and saved at: ${outputPath}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Sitemap Generation Error:", error);
    process.exit(1);
  }
};

generateSitemap();