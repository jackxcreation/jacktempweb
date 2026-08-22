const express = require('express');
const router = express.Router();
const { Product } = require('../models');

// ==========================================
// 📦 1. PRODUCT APIs
// ==========================================

// 1. Get All Products (With optional Warehouse Filter)
router.get('/api/products', async (req, res) => {
  try {
    const query = req.query.warehouseId ? { warehouseId: req.query.warehouseId } : {};
    
    const products = await Product.find(query).sort({ createdAt: -1 }).lean();
    res.json(products.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) { 
    console.error("Fetch Products Error:", error);
    res.status(500).json({ message: "Server Error" }); 
  }
});

// 🔥 2. NAYA: Get Trending Products (Top 8)
// Note: Isko /:id wale route se upar hi rakhna hai!
router.get('/api/products/trending/top', async (req, res) => {
  try {
    // Sabse zyada views aur sales wale 8 products layega
    const trendingProducts = await Product.find()
      .sort({ views: -1, sales: -1 }) 
      .limit(8)
      .lean();
      
    res.json(trendingProducts.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    console.error("Trending Products Error:", error);
    res.status(500).json({ message: "Error fetching trending products" });
  }
});

// 🔥 3. NAYA: Get Similar Products
router.get('/api/products/similar/:id', async (req, res) => {
  try {
    const currentProduct = await Product.findById(req.params.id);
    if (!currentProduct) return res.status(404).json({ message: "Product not found" });

    // Same category ke products dhundho, par current wale ko hata do ($ne = Not Equal)
    const similarProducts = await Product.find({
      category: currentProduct.category,
      _id: { $ne: currentProduct._id }
    }).limit(5).lean();

    res.json(similarProducts.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    console.error("Similar Products Error:", error);
    res.status(500).json({ message: "Error fetching similar products" });
  }
});

// 🔥 4. UPDATED: Get Single Product (And Auto-Increment Views)
router.get('/api/products/:id', async (req, res) => {
  try {
    // Product find karo aur 'views' ko 1 se badha do automatically ($inc)
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } }, 
      { new: true }
    ).lean();

    if (!product) return res.status(404).json({ message: "Product not found" });
    
    res.json({ ...product, id: product._id.toString() });
  } catch (error) { 
    console.error("Fetch Single Product Error:", error);
    res.status(500).json({ message: "Server Error" }); 
  }
});

// 5. Create New Product
router.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json({ ...savedProduct._doc, id: savedProduct._id.toString() });
  } catch (error) { 
    console.error("Save Product Error:", error);
    res.status(500).json({ message: "Error saving product" }); 
  }
});

// 6. Delete Product
router.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) { 
    console.error("Delete Product Error:", error);
    res.status(500).json({ message: "Error deleting product" }); 
  }
});

module.exports = router;