const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Redis = require('ioredis'); 
const { Product, User, Order, Warehouse } = require('../models');
const { z } = require('zod'); 
const { logger } = require('../utils/logger'); // 🔥 Production Winston Logger

// 🚨 IMPORT SECURE MIDDLEWARES & ZERO-TRUST RBAC
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🔥 SECURE UPSTASH / REDIS CLIENT INITIALIZATION FOR VIEW TRACKING
// ==========================================
const redisClient = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      tls: {
        rejectUnauthorized: false
      },
      maxRetriesPerRequest: null
    })
  : new Redis('redis://localhost:6379', { maxRetriesPerRequest: null });

redisClient.on('error', (err) => console.error('Redis View Tracker Error:', err));

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMA FOR PRODUCTS
// ==========================================
const productValidationSchema = z.object({
  title: z.string().min(2, "Title is required").max(200, "Title is too long"),
  description: z.string().max(2000, "Description is too long").optional(),
  
  // Safe fallback for old systems
  price: z.coerce.number().nonnegative().optional(),
  mrp: z.coerce.number().nonnegative().optional(),

  pricePaise: z.coerce.number().int().nonnegative("Price must be a positive number").optional(),
  mrpPaise: z.coerce.number().int().nonnegative("MRP must be a positive number").optional(),
  category: z.string().min(1, "Category is required"),
  brand: z.string().optional(),
  inventory: z.coerce.number().int().nonnegative().default(0), 
  
  image: z.string().optional(),
  // 🔥 ROBUST IMAGES TRANSFORMER: Accepts either array or comma-separated string from the canonical editor
  images: z.union([
    z.array(z.string()), 
    z.string()
  ]).optional().transform((val) => {
    if (typeof val === 'string') {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return val;
  }),

  sku: z.string().optional(),
  weight: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  manufacturerName: z.string().optional(),
  warehouseId: z.string().optional().nullable(),
  discount: z.string().optional(),

  // 🔥 ADVANCED CATALOG & COMPLIANCE FIELDS 🔥
  subCategory: z.string().optional(),
  listingStatus: z.enum(['Active', 'Inactive', 'Draft']).optional(),
  minimumOrderQty: z.coerce.number().int().nonnegative().optional(),
  
  shippingProvider: z.string().optional(),
  handlingLocal: z.coerce.number().optional(),
  handlingZonal: z.coerce.number().optional(),
  handlingNational: z.coerce.number().optional(),
  
  length: z.coerce.number().optional(),
  breadth: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  
  hsnCode: z.string().optional(),
  tax: z.coerce.number().optional(),
  countryOfOrigin: z.string().optional(),
  
  manufactureDetails: z.string().optional(),
  packerDetails: z.string().optional(),
  importDetails: z.string().optional(),
  eanUpc: z.string().optional(),
  
  searchKeywords: z.string().optional(),
  packOf: z.coerce.number().int().optional(),
  variant: z.string().optional(),
  
  modelNo: z.string().optional(),
  itemsIncluded: z.string().optional(),
  noOfTools: z.string().optional(),
  toolFeatures: z.string().optional(),
  powerConsumption: z.string().optional(),
  otherPowerFeatures: z.string().optional(),
  
  domesticWarranty: z.string().optional(),
  internationalWarranty: z.string().optional(),
  warrantySummary: z.string().optional(),
  warrantyServiceType: z.string().optional(),
  coveredInWarranty: z.string().optional(),
  notCoveredInWarranty: z.string().optional(),
  
  auditReason: z.string().max(300).optional() // 🔥 Audit Reason for enterprise compliance
});

// ==========================================
// 🛡️ REGEX ESCAPE HELPER (Prevents ReDoS / Regex Injection)
// ==========================================
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// ==========================================
// 🛡️ CENTRALIZED AUDIT HELPER (WHO, WHAT, WHEN, WHERE, BEFORE, AFTER, WHY)
// ==========================================
const logAdminAction = async (req, action, details, beforeState = null, afterState = null) => {
  try {
    if (!req.user) return;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
    const auditEntry = {
      action,
      details,
      ip,
      timestamp: new Date()
    };

    await User.findByIdAndUpdate(req.user._id, {
      $push: { auditLogs: auditEntry }
    });

    logger.info({
      message: `AUDIT TRAIL: [${action}]`,
      requestId: req.requestId,
      admin: req.user.email,
      role: req.user.role,
      ip,
      before: beforeState,
      after: afterState,
      details
    });
  } catch (err) {
    console.error("Failed to record product audit log:", err);
  }
};

// ==========================================
// 📦 1. PRODUCT APIs
// ==========================================

// 1. Get All Products (🔥 Flipkart-scale Server-side Atlas Search, Powerful Multi-Facet Filtering, Pagination & Sorting)
router.get('/api/products', async (req, res) => {
  try {
    let { category, brand, minPrice, maxPrice, sort, search, warehouseId, warehouse, rating, availability, stock, status, color, size } = req.query;
    
    const targetWarehouse = warehouseId || warehouse;
    const targetStatus = status;

    let cleanSearchQuery = search ? search.trim() : "";
    let extractedMaxPrice = maxPrice ? Number(maxPrice) : null;
    let dynamicSort = sort;

    if (cleanSearchQuery) {
      const lowerQuery = cleanSearchQuery.toLowerCase();
      const underPriceMatch = lowerQuery.match(/(?:under|below|less than)\s*(?:rs\.?|₹)?\s*(\d+)\s*(k)?/i);
      if (underPriceMatch) {
        let amount = parseInt(underPriceMatch[1], 10);
        if (underPriceMatch[2]) amount *= 1000;
        extractedMaxPrice = amount * 100;
        cleanSearchQuery = cleanSearchQuery.replace(underPriceMatch[0], "").trim();
      }

      if (lowerQuery.includes('best') || lowerQuery.includes('top')) {
        if (!sort || sort === 'popular') dynamicSort = 'rating';
      } else if (lowerQuery.includes('cheapest') || lowerQuery.includes('low price')) {
        dynamicSort = 'price-low';
      }
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 50, 1),
      100
    );
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    let sortCriteria = { createdAt: -1 };
    if (dynamicSort === 'price-low') sortCriteria = { pricePaise: 1 };
    else if (dynamicSort === 'price-high') sortCriteria = { pricePaise: -1 };
    else if (dynamicSort === 'rating') sortCriteria = { rating: -1 };
    else if (dynamicSort === 'popular') sortCriteria = { views: -1 };

    let products = [];
    let totalCount = 0;
    const finalMaxPrice = extractedMaxPrice || maxPrice;

    if (cleanSearchQuery && cleanSearchQuery.length > 0) {
      try {
        const atlasFilters = [
          ...(targetWarehouse ? [{ text: { query: targetWarehouse, path: "warehouseId" } }] : []),
          ...(category && category !== 'All' ? [{ text: { query: category, path: "category" } }] : []),
          ...(brand ? [{ text: { query: brand, path: "brand" } }] : []),
          ...(targetStatus ? [{ text: { query: targetStatus, path: "listingStatus" } }] : []),
          ...(color ? [{ text: { query: color, path: "color" } }] : []),
          ...(size ? [{ text: { query: size, path: "size" } }] : []),
          ...(rating ? [{ range: { path: "rating", gte: Number(rating) } }] : []),
          ...(availability === 'in-stock' || stock === 'in-stock' ? [{ range: { path: "inventory", gt: 0 } }] : []),
          ...(stock === 'out-of-stock' ? [{ range: { path: "inventory", lte: 0 } }] : []),
          ...(stock === 'low-stock' ? [{ range: { path: "inventory", gt: 0, lte: 10 } }] : []),
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
              index: "default", 
              compound: {
                must: [
                  {
                    text: {
                      query: cleanSearchQuery,
                      path: ["title", "description", "brand", "category", "searchKeywords"],
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
        console.warn("Atlas Search fallback triggered:", atlasErr.message);
      }
    }

    if (!products || products.length === 0) {
      const query = {};
      if (targetWarehouse) query.warehouseId = targetWarehouse;
      if (category && category !== 'All') query.category = category;
      if (targetStatus) query.listingStatus = targetStatus;
      if (brand) query.brand = new RegExp(brand, 'i');
      if (color) query.color = new RegExp(color, 'i');
      if (size) query.size = new RegExp(size, 'i');
      if (rating) query.rating = { $gte: Number(rating) };
      
      if (availability === 'in-stock' || stock === 'in-stock') {
        query.inventory = { $gt: 0 };
      } else if (stock === 'out-of-stock') {
        query.inventory = { $lte: 0 };
      } else if (stock === 'low-stock') {
        query.inventory = { $gt: 0, $lte: 10 };
      }

      if (minPrice || finalMaxPrice) {
        query.pricePaise = {};
        if (minPrice) query.pricePaise.$gte = Number(minPrice);
        if (finalMaxPrice) query.pricePaise.$lte = Number(finalMaxPrice);
      }

      if (cleanSearchQuery) {
        const safeRegex = new RegExp(escapeRegex(cleanSearchQuery), 'i');
        query.$or = [
          { title: safeRegex },
          { description: safeRegex },
          { searchKeywords: safeRegex }
        ];
      }

      [products, totalCount] = await Promise.all([
        Product.find(query).sort(sortCriteria).skip(skip).limit(limit).lean(),
        Product.countDocuments(query)
      ]);
    }

    if (req.query.paginated === 'true' || category || search || sort || req.query.page || targetWarehouse || stock || targetStatus) {
      return res.json({
        success: true,
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit) || 1,
        products: products.map(p => ({ ...p, id: p._id.toString() }))
      });
    }

    res.json(products.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) { 
    console.error("Fetch Products Error:", error);
    res.status(500).json({ message: "Server Error" }); 
  }
});

// 🔥 2. Get Trending Products
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

// 🔥 4. Get Single Product
router.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_ip';
    const redisKey = `view:${productId}:${clientIp}`;

    let productQuery = Product.findById(productId);

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
// 🔥 RECOMMENDATION ENGINE APIS
// ==========================================
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

router.get('/api/recommendations/because-you-bought/:userId', protect, async (req, res) => {
  try {
    const userId = req.params.userId;
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

    if (!recommended || recommended.length === 0) {
      const topRated = await Product.find().sort({ rating: -1 }).limit(4).lean();
      return res.json(topRated.map(p => ({ ...p, id: p._id.toString() })));
    }

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
// 🛡️ CATALOG & ADMIN PROTECTED ROUTES (ZERO-TRUST GRANULAR RBAC ENFORCED & AUDIT LOGGED)
// ==========================================

// 5. Create New Product - 🔥 GRANULAR RBAC ('products:create') & AUDIT LOGGED + WAREHOUSE LINKING FIX
router.post('/api/products', protect, checkPermission('products:create'), async (req, res) => {
  try {
    if (req.body.price !== undefined && req.body.pricePaise === undefined) {
      req.body.pricePaise = Math.round(Number(req.body.price) * 100);
    }
    if (req.body.mrp !== undefined && req.body.mrpPaise === undefined) {
      req.body.mrpPaise = Math.round(Number(req.body.mrp) * 100);
    }

    // If warehouseId is missing or empty, fetch the default active warehouse automatically
    if (!req.body.warehouseId || req.body.warehouseId === "null" || req.body.warehouseId === "") {
      const defaultWarehouse = await Warehouse.findOne({ isActive: true }).sort({ priority: 1 });
      if (defaultWarehouse) {
        req.body.warehouseId = defaultWarehouse._id.toString();
      }
    }

    const validationResult = productValidationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format() 
      });
    }

    const productData = validationResult.data;

    // 🔥 AUTOMATIC WAREHOUSE INVENTORY MAPPING (Fixes 0 items in warehouse view)
    if (productData.warehouseId && mongoose.Types.ObjectId.isValid(productData.warehouseId)) {
      const warehouseObjId = new mongoose.Types.ObjectId(productData.warehouseId);
      productData.warehouseInventories = [{
        warehouse: warehouseObjId,
        inventory: productData.inventory || 0,
        inventoryState: {
          available: productData.inventory || 0,
          sellable: productData.inventory || 0
        }
      }];
    }

    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save();

    // 🔥 AUDIT LOG RECORDED FOR PRODUCT CREATION
    await logAdminAction(
      req,
      'PRODUCT_CREATED',
      `Created product: "${savedProduct.title}" (SKU: ${savedProduct.sku || 'N/A'})`,
      null,
      { id: savedProduct._id, title: savedProduct.title, price: savedProduct.price, inventory: savedProduct.inventory }
    );

    res.status(201).json({ ...savedProduct._doc, id: savedProduct._id.toString() });
  } catch (error) { 
    console.error("Save Product Error:", error);
    res.status(500).json({ message: "Error saving product" }); 
  }
});

// 6. Update Existing Product - 🔥 GRANULAR RBAC ('products:edit') & AUDIT LOGGED (PRICE/STOCK/TITLE/IMAGE CHANGES)
router.put('/api/products/:id', protect, checkPermission('products:edit'), async (req, res) => {
  try {
    if (req.body.price !== undefined && req.body.pricePaise === undefined) {
      req.body.pricePaise = Math.round(Number(req.body.price) * 100);
    }
    if (req.body.mrp !== undefined && req.body.mrpPaise === undefined) {
      req.body.mrpPaise = Math.round(Number(req.body.mrp) * 100);
    }

    const validationResult = productValidationSchema.partial().safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format() 
      });
    }

    const existingProduct = await Product.findById(req.params.id).lean();
    if (!existingProduct) return res.status(404).json({ message: "Product not found" });

    const updateData = validationResult.data;
    const whitelistedUpdateData = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        whitelistedUpdateData[key] = updateData[key];
      }
    });

    // Keep warehouse mapping synced if inventory or warehouseId updates
    if (whitelistedUpdateData.inventory !== undefined || whitelistedUpdateData.warehouseId !== undefined) {
      const targetWarehouseId = whitelistedUpdateData.warehouseId || existingProduct.warehouseId;
      const targetInventory = whitelistedUpdateData.inventory !== undefined ? whitelistedUpdateData.inventory : existingProduct.inventory;
      
      if (targetWarehouseId && mongoose.Types.ObjectId.isValid(targetWarehouseId)) {
        whitelistedUpdateData.warehouseInventories = [{
          warehouse: new mongoose.Types.ObjectId(targetWarehouseId),
          inventory: targetInventory,
          inventoryState: { available: targetInventory, sellable: targetInventory }
        }];
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      whitelistedUpdateData, 
      { new: true, runValidators: true, returnDocument: 'after' }
    ).lean();
    
    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

    // 🔥 DETAILED AUDIT LOG RECORDING (PRICE, STOCK, TITLE, IMAGES COMPARISON)
    let changeSummary = [];
    if (whitelistedUpdateData.pricePaise !== undefined && whitelistedUpdateData.pricePaise !== existingProduct.pricePaise) {
      changeSummary.push(`Price: ₹${(existingProduct.pricePaise/100).toFixed(2)} → ₹${(whitelistedUpdateData.pricePaise/100).toFixed(2)}`);
    }
    if (whitelistedUpdateData.inventory !== undefined && whitelistedUpdateData.inventory !== existingProduct.inventory) {
      changeSummary.push(`Stock: ${existingProduct.inventory} → ${whitelistedUpdateData.inventory}`);
    }
    if (whitelistedUpdateData.title && whitelistedUpdateData.title !== existingProduct.title) {
      changeSummary.push(`Title changed`);
    }
    if (whitelistedUpdateData.images && JSON.stringify(whitelistedUpdateData.images) !== JSON.stringify(existingProduct.images)) {
      changeSummary.push(`Images updated`);
    }

    const auditDetail = changeSummary.length > 0 ? changeSummary.join(', ') : `Updated product properties`;

    await logAdminAction(
      req,
      'PRODUCT_UPDATED',
      `Updated product "${updatedProduct.title}". Details: ${auditDetail}. Reason: ${updateData.auditReason || 'No reason provided'}`,
      { price: existingProduct.pricePaise, inventory: existingProduct.inventory, title: existingProduct.title },
      { price: updatedProduct.pricePaise, inventory: updatedProduct.inventory, title: updatedProduct.title }
    );

    res.json({ ...updatedProduct, id: updatedProduct._id.toString() });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ message: "Error updating product" });
  }
});

// 7. Safe Delete / Soft Delete - 🔥 GRANULAR RBAC & AUDIT LOGGED
router.delete('/api/products/:id', protect, checkPermission('products:edit'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { auditReason, force } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const activeOrders = await Order.find({
      'items.productId': productId,
      status: { $nin: ['Delivered', 'Cancelled', 'Returned', 'Refunded', 'RTO'] }
    }).lean();

    if (activeOrders.length > 0 && !force) {
      return res.status(400).json({
        success: false,
        requiresConfirmation: true,
        message: `Safety Block: This product is part of ${activeOrders.length} active/unfulfilled order(s). Deleting it will break fulfillment.`,
        activeOrdersCount: activeOrders.length
      });
    }

    const previousStatus = product.listingStatus;
    product.listingStatus = 'Inactive';
    product.inventory = 0;
    await product.save();

    // 🔥 AUDIT LOG RECORDED FOR SOFT DELETE / ARCHIVE
    await logAdminAction(
      req,
      'PRODUCT_ARCHIVED',
      `Safely archived/soft deleted product "${product.title}" (SKU: ${product.sku || 'N/A'}). Reason: ${auditReason || 'No reason provided'}`,
      { listingStatus: previousStatus, inventory: product.inventory },
      { listingStatus: 'Inactive', inventory: 0 }
    );

    res.json({ 
      success: true, 
      message: "Product safely moved to recycle bin (Soft Deleted) with audit logging.",
      auditReason: auditReason || "No reason provided"
    });
  } catch (error) { 
    console.error("Safe Delete Product Error:", error);
    res.status(500).json({ message: "Error processing safe deletion" }); 
  }
});

module.exports = router;