const express = require('express');
const router = express.Router();
const { Product } = require('../models');

// 🔥 Google Merchant Center XML Feed Generator
router.get('/api/merchant-feed.xml', async (req, res) => {
  try {
    const products = await Product.find({}).lean();
    const domain = 'https://thejackessentials.com';

    let xml = `<?xml version="1.0" encoding="UTF-8" ?>`;
    xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`;
    xml += `<channel>`;
    xml += `<title>Jack Essentials Product Catalog</title>`;
    xml += `<link>${domain}</link>`;
    xml += `<description>Official Google Merchant Center Product Feed for Jack Essentials</description>`;

    products.forEach((product) => {
      const productId = product.id || product._id;
      const productUrl = `${domain}/product/${productId}`;
      const imageUrl = product.image || (product.images && product.images[0]) || '';
      const priceInRupees = (product.pricePaise || 0) / 100;
      const availability = (product.inventory || 0) > 0 ? 'in stock' : 'out of stock';
      const brand = product.brand || 'Jack Essentials';
      const condition = 'new';

      xml += `<item>`;
      xml += `<g:id>${productId}</g:id>`;
      xml += `<g:title><![CDATA[${product.title}]]></g:title>`;
      xml += `<g:description><![CDATA[${product.description || product.title}]]></g:description>`;
      xml += `<g:link>${productUrl}</g:link>`;
      xml += `<g:image_link>${imageUrl}</g:image_link>`;
      xml += `<g:price>${priceInRupees.toFixed(2)} INR</g:price>`;
      xml += `<g:availability>${availability}</g:availability>`;
      xml += `<g:condition>${condition}</g:condition>`;
      xml += `<g:brand><![CDATA[${brand}]]></g:brand>`;
      xml += `<g:product_type><![CDATA[${product.category || 'General'}]]></g:product_type>`;
      xml += `</item>`;
    });

    xml += `</channel>`;
    xml += `</rss>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error("Merchant feed generation error:", err);
    res.status(500).send("Error generating Google Merchant Feed");
  }
});

module.exports = router;