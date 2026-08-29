const express = require('express');
const router = express.Router();
const Redis = require('ioredis'); 
const { Product, User, Order } = require('../models');
const { z } = require('zod'); 

// 🚨 IMPORT SECURE MIDDLEWARES & RBAC
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🔥 INITIALIZE REDIS CLIENT FOR VIEW TRACKING
// ==========================================
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
redisClient.on('error', (err) => console.error('Redis View Tracker Error:', err));

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMA FOR PRODUCTS
// ==========================================
// 🔥 PHASE 4 FIX: Coerced types to allow strings (from frontend forms) to be safely converted to numbers
const productValidationSchema = z.object({
  title: z.string().min(2, "Title is required").max(200, "Title is too long"),
  description: z.string().max(2000, "Description is too long").optional(),
  
  // Safe fallback for old systems that might still send these
  price: z.coerce.number().nonnegative().optional(),
  mrp: z.coerce.number().nonnegative().optional(),

  pricePaise: z.coerce.number().int().nonnegative("Price must be a positive number"),
  mrpPaise: z.coerce.number().int().nonnegative("MRP must be a positive number").optional(),
  category: z.string().min(1, "Category is required"),
  brand: z.string().optional(),
  inventory: z.coerce.number().int().nonnegative().default(0), // Automatically handles string "50" -> number 50
  
  image: z.string().url("Must be a valid image URL").optional(),
  images: z.array(z.string().url()).optional(),
  sku: z.string().optional(),
  weight: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  manufacturerName: z.string().optional(),
  warehouseId: z.string().optional(),
  discount: z.string().optional()
});

// ==========================================
// 🛡️ REGEX ESCAPE HELPER (Prevents ReDoS / Regex Injection)
// ==========================================
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// ==========================================
// 📦 1. PRODUCT APIs
// ==========================================

// 1. Get All Products (🔥 Flipkart-scale Server-side Atlas Search, Powerful Multi-Facet Filtering, Pagination & Sorting)
router.get('/api/products', async (req, res) => {
  try {
    let { category, brand, minPrice, maxPrice, sort, search, warehouseId, rating, availability, color, size } = req.query;
    
    // ==========================================
    // 🧠 NATURAL LANGUAGE SMART SEARCH PARSER (e.g. "best phone under 20k")
    // ==========================================
    let cleanSearchQuery = search ? search.trim() : "";
    let extractedMaxPrice = maxPrice ? Number(maxPrice) : null;
    let dynamicSort = sort;

    if (cleanSearchQuery) {
      const lowerQuery = cleanSearchQuery.toLowerCase();

      // 1. Detect "under X" or "below X" (e.g. "under 20k", "under 50000")
      const underPriceMatch = lowerQuery.match(/(?:under|below|less than)\s*(?:rs\.?|₹)?\s*(\d+)\s*(k)?/i);
      if (underPriceMatch) {
        let amount = parseInt(underPriceMatch[1], 10);
        if (underPriceMatch[2]) amount *= 1000; // Convert '20k' to '20000'
        extractedMaxPrice = amount * 100; // Convert to paise
        
        // Strip price text so Atlas Search focuses strictly on product keywords
        cleanSearchQuery = cleanSearchQuery.replace(underPriceMatch[0], "").trim();
      }

      // 2. Detect Intent Keywords for Ranking/Sorting ("best", "top", "cheapest")
      if (lowerQuery.includes('best') || lowerQuery.includes('top')) {
        if (!sort || sort === 'popular') dynamicSort = 'rating';
      } else if (lowerQuery.includes('cheapest') || lowerQuery.includes('low price')) {
        dynamicSort = 'price-low';
      }
    }

    // 🔥 OWASP Hard Cap & Pagination Setup
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 24, 1),
      100 // Maximum 100 items per request
    );
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // 3. Dynamic Sorting Matrix
    let sortCriteria = { createdAt: -1 }; // Default newest
    if (dynamicSort === 'price-low') sortCriteria = { pricePaise: 1 };
    else if (dynamicSort === 'price-high') sortCriteria = { pricePaise: -1 };
    else if (dynamicSort === 'rating') sortCriteria = { rating: -1 };
    else if (dynamicSort === 'popular') sortCriteria = { views: -1 };

    let products = [];
    let totalCount = 0;
    let usedAtlasSearch = false; 

    const finalMaxPrice = extractedMaxPrice || maxPrice;

    // Attempt MongoDB Atlas Search if clean search query is provided
    if (cleanSearchQuery && cleanSearchQuery.length > 0) {
      usedAtlasSearch = true;
      try {
        const atlasFilters = [
          ...(warehouseId ? [{ text: { query: warehouseId, path: "warehouseId" } }] : []),
          ...(category && category !== 'All' ? [{ text: { query: category, path: "category" } }] : []),
          ...(brand ? [{ text: { query: brand, path: "brand" } }] : []),
          ...(color ? [{ text: { query: color, path: "color" } }] : []),
          ...(size ? [{ text: { query: size, path: "size" } }] : []),
          ...(rating ? [{ range: { path: "rating", gte: Number(rating) } }] : []),
          ...(availability === 'in-stock' ? [{ range: { path: "inventory", gt: 0 } }] : []),
          ...(((minPrice || finalMaxPrice) ? [{
            range: {
              path: "pricePaise",
              ...(minPrice ? { gte: Number(minPrice) } : {}),
              ...(finalMaxPrice ? { lte: Number(finalMaxPrice) } : {})
            }
          }] : []))
        ];

        const pipeline = [
          {
            $search: {
              index: "default", // Name of your Atlas Search index
              compound: {
                must: [
                  {
                    text: {
                      query: cleanSearchQuery,
                      path: ["title", "description", "brand", "category"],
                      fuzzy: { maxEdits: 1, prefixLength: 2 } 
                    }
                  }
                ],
                filter: atlasFilters
              }
            }
          },
          { $sort: sortCriteria },
          {
            $facet: {
              metadata: [{ $count: "total" }],
              data: [{ $skip: skip }, { $limit: limit }]
            }
          }
        ];

        const searchResult = await Product.aggregate(pipeline);
        if (searchResult && searchResult.length > 0) {
          totalCount = searchResult[0].metadata[0]?.total || 0;
          products = searchResult[0].data || [];
        }
      } catch (atlasErr) {
        console.warn("Atlas Search fallback triggered due to index state:", atlasErr.message);
      }
    }

    // 🔥 FIX: Reliable fallback standard Mongoose query if Atlas Search wasn't used, returned 0 results, or failed
    if (!products || products.length === 0) {
      const query = {};
      if (warehouseId) query.warehouseId = warehouseId;
      if (category && category !== 'All') query.category = category;
      if (brand) query.brand = new RegExp(brand, 'i');
      if (color) query.color = new RegExp(color, 'i');
      if (size) query.size = new RegExp(size, 'i');
      if (rating) query.rating = { $gte: Number(rating) };
      if (availability === 'in-stock') query.inventory = { $gt: 0 };

      if (minPrice || finalMaxPrice) {
        query.pricePaise = {};
        if (minPrice) query.pricePaise.$gte = Number(minPrice);
        if (finalMaxPrice) query.pricePaise.$lte = Number(finalMaxPrice);
      }

      if (cleanSearchQuery) {
        const safeRegex = new RegExp(escapeRegex(cleanSearchQuery), 'i');
        query.$or = [
          { title: safeRegex },
          { description: safeRegex }
        ];
      }

      [products, totalCount] = await Promise.all([
        Product.find(query).sort(sortCriteria).skip(skip).limit(limit).lean(),
        Product.countDocuments(query)
      ]);
    }

    // Check if client expects paginated meta structure or array based on headers/query
    if (req.query.paginated === 'true' || category || search || sort || req.query.page) {
      return res.json({
        success: true,
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit) || 1,
        products: products.map(p => ({ ...p, id: p._id.toString() }))
      });
    }

    // Fallback array format for standard backward compatibility
    res.json(products.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) { 
    console.error("Fetch Products Error:", error);
    res.status(500).json({ message: "Server Error" }); 
  }
});

// 🔥 2. Get Trending Products (Top 8 using Precomputed Trending Score)
router.get('/api/products/trending/top', async (req, res) => {
  try {
    const trendingProducts = await Product.find()
      .sort({ trendingScore: -1 }) 
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

// 🔥 4. Get Single Product (And Distributed Redis TTL View Counter Cooldown)
router.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Generate a unique visitor hash/key using IP and Product ID
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_ip';
    const redisKey = `view:${productId}:${clientIp}`;

    let productQuery = Product.findById(productId);

    // 🔥 ENTERPRISE FIX: Use Redis SET with NX and EX (30 mins = 1800s) to prevent spam across clustered servers
    const viewLock = await redisClient.set(redisKey, '1', 'EX', 1800, 'NX');
    if (viewLock === 'OK') {
      productQuery = Product.findByIdAndUpdate(
        productId,
        { $inc: { views: 1 } }, 
        { new: true }
      );
    }

    const product = await productQuery.lean();

    if (!product) return res.status(404).json({ message: "Product not found" });
    
    res.json({ ...product, id: product._id.toString() });
  } catch (error) { 
    console.error("Fetch Single Product Error:", error);
    res.status(500).json({ message: "Server Error" }); 
  }
});

// ==========================================
// 🔥 ADVANCED RECOMMENDATION ENGINE APIS
// ==========================================

// Frequently Bought Together
router.get('/api/recommendations/frequently-bought/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const bundle = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      tags: { $in: product.tags || [] }
    }).limit(3).lean();

    res.json(bundle.map(p => ({ ...p, id: p._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: "Error fetching bundle recommendations" });
  }
});

// Customers Also Viewed
router.get('/api/recommendations/also-viewed/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const similar = await Product.find({
      _id: { $ne: product._id },
      brand: product.brand,
      rating: { $gte: 4.0 }
    }).sort({ views: -1 }).limit(4).lean();

    res.json(similar.map(p => ({ ...p, id: p._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: "Error fetching viewed recommendations" });
  }
});

// Trending Near You
router.get('/api/recommendations/trending', async (req, res) => {
  try {
    const trending = await Product.find({ isTrending: true })
      .sort({ views: -1, sales: -1 })
      .limit(8)
      .lean();

    res.json(trending.map(p => ({ ...p, id: p._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: "Error fetching trending products" });
  }
});

// Because You Bought X (Enterprise Purchase History Recommendation Engine)
router.get('/api/recommendations/because-you-bought/:userId', protect, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // 1. Fetch user past orders to inspect actual purchase history
    const pastOrders = await Order.find({ userId }).lean();
    
    let purchasedProductIds = [];
    let categories = new Set();
    let brands = new Set();

    pastOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item.productId) purchasedProductIds.push(item.productId);
          if (item.product) purchasedProductIds.push(item.product.toString());
          if (item.category) categories.add(item.category);
          if (item.brand) brands.add(item.brand);
        });
      }
    });

    // If order items only store IDs, fetch product metadata to extract category/brand
    if (purchasedProductIds.length > 0 && (categories.size === 0 || brands.size === 0)) {
      const purchasedProducts = await Product.find({ _id: { $in: purchasedProductIds } }).lean();
      purchasedProducts.forEach(p => {
        if (p.category) categories.add(p.category);
        if (p.brand) brands.add(p.brand);
      });
    }

    let recommended = [];

    if (categories.size > 0 || brands.size > 0) {
      const query = {
        $or: [
          ...(categories.size > 0 ? [{ category: { $in: Array.from(categories) } }] : []),
          ...(brands.size > 0 ? [{ brand: { $in: Array.from(brands) } }] : [])
        ]
      };
      if (purchasedProductIds.length > 0) {
        query._id = { $nin: purchasedProductIds };
      }

      recommended = await Product.find(query).sort({ rating: -1, views: -1 }).limit(4).lean();
    }

    // Fallback to top-rated products if no purchase history exists or recommendations are empty
    if (!recommended || recommended.length === 0) {
      const topRated = await Product.find().sort({ rating: -1 }).limit(4).lean();
      return res.json(topRated.map(p => ({ ...p, id: p._id.toString() })));
    }

    // Fill up to 4 items with top-rated if less than 4 recommendations are found
    if (recommended.length < 4) {
      const existingIds = recommended.map(p => p._id).concat(purchasedProductIds);
      const additional = await Product.find({ _id: { $nin: existingIds } }).sort({ rating: -1 }).limit(4 - recommended.length).lean();
      recommended = recommended.concat(additional);
    }

    res.json(recommended.map(p => ({ ...p, id: p._id.toString() })));
  } catch (err) {
    console.error("Because You Bought Recommendations Error:", err);
    res.status(500).json({ message: "Error fetching personalized recommendations" });
  }
});

// ==========================================
// 🛡️ CATALOG & ADMIN PROTECTED ROUTES (RBAC ENFORCED & WHITELISTED)
// ==========================================

// 5. Create New Product - 🔥 CATALOG / ADMIN RBAC
router.post('/api/products', protect, checkPermission('products:all'), async (req, res) => {
  try {
    const validationResult = productValidationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format() 
      });
    }

    const newProduct = new Product(validationResult.data);
    const savedProduct = await newProduct.save();
    res.status(201).json({ ...savedProduct._doc, id: savedProduct._id.toString() });
  } catch (error) { 
    console.error("Save Product Error:", error);
    res.status(500).json({ message: "Error saving product" }); 
  }
});

// 6. Update Existing Product - 🔥 EXPLICIT FIELD WHITELISTING (Mass-Assignment Prevention)
router.put('/api/products/:id', protect, checkPermission('products:all'), async (req, res) => {
  try {
    const validationResult = productValidationSchema.partial().safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format() 
      });
    }

    const { 
      title, description, pricePaise, mrpPaise, category, 
      brand, inventory, image, images, sku, weight, size, 
      color, material, manufacturerName, warehouseId, discount 
    } = validationResult.data;

    const whitelistedUpdateData = {};
    if (title !== undefined) whitelistedUpdateData.title = title;
    if (description !== undefined) whitelistedUpdateData.description = description;
    if (pricePaise !== undefined) whitelistedUpdateData.pricePaise = pricePaise;
    if (mrpPaise !== undefined) whitelistedUpdateData.mrpPaise = mrpPaise;
    if (category !== undefined) whitelistedUpdateData.category = category;
    if (brand !== undefined) whitelistedUpdateData.brand = brand;
    if (inventory !== undefined) whitelistedUpdateData.inventory = inventory;
    if (image !== undefined) whitelistedUpdateData.image = image;
    if (images !== undefined) whitelistedUpdateData.images = images;
    if (sku !== undefined) whitelistedUpdateData.sku = sku;
    if (weight !== undefined) whitelistedUpdateData.weight = weight;
    if (size !== undefined) whitelistedUpdateData.size = size;
    if (color !== undefined) whitelistedUpdateData.color = color;
    if (material !== undefined) whitelistedUpdateData.material = material;
    if (manufacturerName !== undefined) whitelistedUpdateData.manufacturerName = manufacturerName;
    if (warehouseId !== undefined) whitelistedUpdateData.warehouseId = warehouseId;
    if (discount !== undefined) whitelistedUpdateData.discount = discount;

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      whitelistedUpdateData, 
      { new: true, runValidators: true, returnDocument: 'after' }
    ).lean();
    
    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ ...updatedProduct, id: updatedProduct._id.toString() });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ message: "Error updating product" });
  }
});

// 7. Delete Product - 🔥 CATALOG / ADMIN RBAC
router.delete('/api/products/:id', protect, checkPermission('products:all'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) { 
    console.error("Delete Product Error:", error);
    res.status(500).json({ message: "Error deleting product" }); 
  }
});

module.exports = router;