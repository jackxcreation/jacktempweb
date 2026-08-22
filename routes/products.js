const express = require('express');
const router = express.Router();
const { Product } = require('../models');

// 🚨 IMPORT SECURE MIDDLEWARES
const { protect, admin } = require('../middleware/authMiddleware');

// ==========================================
// 📦 1. PRODUCT APIs
// ==========================================

// 1. Get All Products (🔥 SECURITY: Added limit to prevent Server Crash/DOS)
router.get('/api/products', async (req, res) => {
  try {
    const query = req.query.warehouseId ? { warehouseId: req.query.warehouseId } : {};
    
    // Optional: Frontend se limit pass kar sakte ho, default 100 rakha hai load bachane ke liye
    const limit = parseInt(req.query.limit) || 100;
    
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
      
    res.json(products.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) { 
    console.error("Fetch Products Error:", error);
    res.status(500).json({ message: "Server Error" }); 
  }
});

// 🔥 2. Get Trending Products (Top 8)
router.get('/api/products/trending/top', async (req, res) => {
  try {
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

// 🔥 3. Get Similar Products
router.get('/api/products/similar/:id', async (req, res) => {
  try {
    const currentProduct = await Product.findById(req.params.id);
    if (!currentProduct) return res.status(404).json({ message: "Product not found" });

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

// 🔥 4. Get Single Product (And Auto-Increment Views)
router.get('/api/products/:id', async (req, res) => {
  try {
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

// ==========================================
// 🛡️ ADMIN ONLY ROUTES (STRICTLY PROTECTED)
// ==========================================

// 5. Create New Product - 🔥 ADMIN ONLY
router.post('/api/products', protect, admin, async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json({ ...savedProduct._doc, id: savedProduct._id.toString() });
  } catch (error) { 
    console.error("Save Product Error:", error);
    res.status(500).json({ message: "Error saving product" }); 
  }
});

// 6. Update Existing Product - 🔥 ADMIN ONLY (Added for completeness)
router.put('/api/products/:id', protect, admin, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, returnDocument: 'after' }
    ).lean();
    
    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ ...updatedProduct, id: updatedProduct._id.toString() });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ message: "Error updating product" });
  }
});

// 7. Delete Product - 🔥 ADMIN ONLY
router.delete('/api/products/:id', protect, admin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) { 
    console.error("Delete Product Error:", error);
    res.status(500).json({ message: "Error deleting product" }); 
  }
});

module.exports = router;