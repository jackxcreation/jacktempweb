// routes/productRouter.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Redis = require('ioredis'); 
const { Product, User, Order, Warehouse } = require('../models');
const { logger } = require('../utils/logger'); // 🔥 Production Winston Logger

// 🔥 TASK #49: IMPORT STANDARDIZED API RESPONSE HELPERS
const { sendSuccess, sendError } = require('../utils/apiResponse');

// 🔥 TASK #47: IMPORT GRANULAR RATE LIMITER FOR SEARCH
const { searchLimiter } = require('../middleware/rateLimit');

// 🛡️ IMPORT STRICT ZOD VALIDATORS (TASK #48)
const { productValidationSchema, productUpdateSchema } = require('../validators/product');

// 🚨 IMPORT SECURE MIDDLEWARES & ZERO-TRUST RBAC
const { protect } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🔥 CRITICAL FIX: SECURE UPSTASH / REDIS CLIENT
// ==========================================
const redisClient = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : new Redis('redis://localhost:6379', { maxRetriesPerRequest: null });

redisClient.on('error', (err) => console.error('Redis View Tracker Error:', err));

// ==========================================
// 🛡️ REGEX ESCAPE HELPER
// ==========================================
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

// ==========================================
// 🛡️ CENTRALIZED AUDIT HELPER
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
// 📦 1. PUBLIC PRODUCT APIs (GET)
// ==========================================

// 1. Get All Products
router.get('/api/products', searchLimiter, async (req, res) => {
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
              data: [{ $skip: skip }, {$limit: limit }]
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
        query.inventory = { $gt: 0,$lte: 10 };
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

    const mappedProducts = products.map(p => ({ ...p, id: p._id.toString() }));

    if (req.query.paginated === 'true' || category || search || sort || req.query.page || targetWarehouse || stock || targetStatus) {
      return sendSuccess(res, {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit) || 1,
        products: mappedProducts
      }, "Products fetched successfully", 200, req);
    }

    return sendSuccess(res, mappedProducts, "Products fetched successfully", 200, req);
  } catch (error) { 
    logger.error("Fetch Products Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Server Error", 500, req); 
  }
});

// 🔥 2. Get Trending Products
router.get('/api/products/trending/top', async (req, res) => {
  try {
    const trendingProducts = await Product.find()
      .sort({ trendingScore: -1 }) 
      .limit(8)
      .lean();
      
    const mapped = trendingProducts.map(p => ({ ...p, id: p._id.toString() }));
    return sendSuccess(res, mapped, "Trending products fetched successfully", 200, req);
  } catch (error) {
    logger.error("Trending Products Error:", error, { requestId: req.requestId });
    return sendError(res, 'TRENDING_ERROR', "Error fetching trending products", 500, req);
  }
});

// 🔥 3. Get Similar Products
router.get('/api/products/similar/:id', async (req, res) => {
  try {
    const currentProduct = await Product.findById(req.params.id);
    if (!currentProduct) return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);

    const similarProducts = await Product.find({
      category: currentProduct.category,
      _id: { $ne: currentProduct._id }
    }).limit(5).lean();

    const mapped = similarProducts.map(p => ({ ...p, id: p._id.toString() }));
    return sendSuccess(res, mapped, "Similar products fetched successfully", 200, req);
  } catch (error) {
    logger.error("Similar Products Error:", error, { requestId: req.requestId });
    return sendError(res, 'SIMILAR_ERROR', "Error fetching similar products", 500, req);
  }
});

// 🔥 3.5 ADDED DEDICATED SLUG ROUTE (Protects frontend if it specifically calls /slug/)
router.get('/api/products/slug/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).lean();
    if (!product) return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);
    
    // Background view increment
    Product.updateOne({ _id: product._id }, { $inc: { views: 1 } }).catch(e => {});
    return sendSuccess(res, { ...product, id: product._id.toString() }, "Product fetched by slug successfully", 200, req);
  } catch (error) {
    logger.error("Fetch Slug Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Server Error", 500, req);
  }
});

// 🔥 4. Get Single Product (BULLETPROOF SMART IDENTIFIER: ID, Slug, or SKU)
router.get('/api/products/:id', async (req, res) => {
  try {
    const identifier = req.params.id;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_ip';
    const redisKey = `view:${identifier}:${clientIp}`;

    // Smart Database Query: Checks if ID is ObjectId, else searches by Slug or SKU
    let query;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query = { _id: identifier };
    } else {
      query = { $or: [{ slug: identifier }, { sku: identifier }] };
    }

    const viewLock = await redisClient.set(redisKey, '1', 'EX', 1800, 'NX');
    
    let product;
    if (viewLock === 'OK') {
      product = await Product.findOneAndUpdate(
        query,
        { $inc: { views: 1 } }, 
        { new: true }
      ).lean();
    } else {
      product = await Product.findOne(query).lean();
    }

    if (!product) return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);
    
    return sendSuccess(res, { ...product, id: product._id.toString() }, "Product details fetched successfully", 200, req);
  } catch (error) { 
    logger.error("Fetch Single Product Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Server Error", 500, req); 
  }
});

// ==========================================
// 🔥 RECOMMENDATION ENGINE APIS (PUBLIC)
// ==========================================
router.get('/api/recommendations/frequently-bought/:id', async (req, res) => {
  try {
    // Smart fetch here too, just in case
    const identifier = req.params.id;
    const product = mongoose.Types.ObjectId.isValid(identifier) 
        ? await Product.findById(identifier)
        : await Product.findOne({ $or: [{slug: identifier}, {sku: identifier}]});
        
    if (!product) return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);

    const bundle = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      tags: { $in: product.tags || [] }
    }).limit(3).lean();

    const mapped = bundle.map(p => ({ ...p, id: p._id.toString() }));
    return sendSuccess(res, mapped, "Frequently bought recommendations fetched", 200, req);
  } catch (err) {
    logger.error("Bundle Recommendations Error:", err, { requestId: req.requestId });
    return sendError(res, 'RECOMMENDATION_ERROR', "Error fetching bundle recommendations", 500, req);
  }
});

router.get('/api/recommendations/also-viewed/:id', async (req, res) => {
  try {
    const identifier = req.params.id;
    const product = mongoose.Types.ObjectId.isValid(identifier) 
        ? await Product.findById(identifier)
        : await Product.findOne({ $or: [{slug: identifier}, {sku: identifier}]});

    if (!product) return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);

    const similar = await Product.find({
      _id: { $ne: product._id },
      brand: product.brand,
      rating: { $gte: 4.0 }
    }).sort({ views: -1 }).limit(4).lean();

    const mapped = similar.map(p => ({ ...p, id: p._id.toString() }));
    return sendSuccess(res, mapped, "Also viewed recommendations fetched", 200, req);
  } catch (err) {
    logger.error("Also Viewed Recommendations Error:", err, { requestId: req.requestId });
    return sendError(res, 'RECOMMENDATION_ERROR', "Error fetching viewed recommendations", 500, req);
  }
});

router.get('/api/recommendations/trending', async (req, res) => {
  try {
    const trending = await Product.find({ isTrending: true })
      .sort({ views: -1, sales: -1 })
      .limit(8)
      .lean();

    const mapped = trending.map(p => ({ ...p, id: p._id.toString() }));
    return sendSuccess(res, mapped, "Trending recommendations fetched", 200, req);
  } catch (err) {
    logger.error("Trending Recommendations Error:", err, { requestId: req.requestId });
    return sendError(res, 'RECOMMENDATION_ERROR', "Error fetching trending products", 500, req);
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
      const mapped = topRated.map(p => ({ ...p, id: p._id.toString() }));
      return sendSuccess(res, mapped, "Personalized recommendations fetched", 200, req);
    }

    if (recommended.length < 4) {
      const existingIds = recommended.map(p => p._id).concat(purchasedProductIds);
      const additional = await Product.find({ _id: { $nin: existingIds } }).sort({ rating: -1 }).limit(4 - recommended.length).lean();
      recommended = recommended.concat(additional);
    }

    const mapped = recommended.map(p => ({ ...p, id: p._id.toString() }));
    return sendSuccess(res, mapped, "Personalized recommendations fetched", 200, req);
  } catch (err) {
    logger.error("Because You Bought Recommendations Error:", err, { requestId: req.requestId });
    return sendError(res, 'RECOMMENDATION_ERROR', "Error fetching personalized recommendations", 500, req);
  }
});

// ==========================================
// 🛡️ ADMIN-ONLY PROTECTED MUTATION ROUTES (ZERO-TRUST RBAC & AUDIT LOGGED)
// ==========================================

// 5. Create New Product - 🔥 ADMIN ONLY ('products:create') & AUDIT LOGGED
router.post('/api/products', protect, checkPermission('products:create'), async (req, res) => {
  try {
    if (req.body.price !== undefined && req.body.pricePaise === undefined) {
      req.body.pricePaise = Math.round(Number(req.body.price) * 100);
    }
    if (req.body.mrp !== undefined && req.body.mrpPaise === undefined) {
      req.body.mrpPaise = Math.round(Number(req.body.mrp) * 100);
    }

    if (!req.body.warehouseId || req.body.warehouseId === "null" || req.body.warehouseId === "") {
      const defaultWarehouse = await Warehouse.findOne({ isActive: true }).sort({ priority: 1 });
      if (defaultWarehouse) {
        req.body.warehouseId = defaultWarehouse._id.toString();
      }
    }

    const validationResult = productValidationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const productData = validationResult.data;

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

    await logAdminAction(
      req,
      'PRODUCT_CREATED',
      `Created product: "${savedProduct.title}" (SKU: ${savedProduct.sku || 'N/A'})`,
      null,
      { id: savedProduct._id, title: savedProduct.title, price: savedProduct.price, inventory: savedProduct.inventory }
    );

    return sendSuccess(res, { ...savedProduct._doc, id: savedProduct._id.toString() }, "Product created successfully", 201, req);
  } catch (error) { 
    logger.error("Save Product Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Error saving product", 500, req); 
  }
});

// 6. Update Existing Product - 🔥 ADMIN ONLY ('products:edit') & AUDIT LOGGED
router.put('/api/products/:id', protect, checkPermission('products:edit'), async (req, res) => {
  try {
    if (req.body.price !== undefined && req.body.pricePaise === undefined) {
      req.body.pricePaise = Math.round(Number(req.body.price) * 100);
    }
    if (req.body.mrp !== undefined && req.body.mrpPaise === undefined) {
      req.body.mrpPaise = Math.round(Number(req.body.mrp) * 100);
    }

    const validationResult = productUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const existingProduct = await Product.findById(req.params.id).lean();
    if (!existingProduct) return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);

    const updateData = validationResult.data;
    const whitelistedUpdateData = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        whitelistedUpdateData[key] = updateData[key];
      }
    });

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
    
    if (!updatedProduct) return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);

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

    return sendSuccess(res, { ...updatedProduct, id: updatedProduct._id.toString() }, "Product updated successfully", 200, req);
  } catch (error) {
    logger.error("Update Product Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Error updating product", 500, req);
  }
});

// 7. Safe Delete / Soft Delete - 🔥 ADMIN ONLY ('products:edit') & AUDIT LOGGED
router.delete('/api/products/:id', protect, checkPermission('products:edit'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { auditReason, force } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return sendError(res, 'PRODUCT_NOT_FOUND', "Product not found", 404, req);
    }

    const activeOrders = await Order.find({
      'items.productId': productId,
      status: { $nin: ['Delivered', 'Cancelled', 'Returned', 'Refunded', 'RTO'] }
    }).lean();

    if (activeOrders.length > 0 && !force) {
      return sendSuccess(res, {
        requiresConfirmation: true,
        activeOrdersCount: activeOrders.length
      }, `Safety Block: This product is part of ${activeOrders.length} active/unfulfilled order(s). Deleting it will break fulfillment.`, 400, req);
    }

    const previousStatus = product.listingStatus;
    product.listingStatus = 'Inactive';
    product.inventory = 0;
    await product.save();

    await logAdminAction(
      req,
      'PRODUCT_ARCHIVED',
      `Safely archived/soft deleted product "${product.title}" (SKU: ${product.sku || 'N/A'}). Reason: ${auditReason || 'No reason provided'}`,
      { listingStatus: previousStatus, inventory: product.inventory },
      { listingStatus: 'Inactive', inventory: 0 }
    );

    return sendSuccess(res, { 
      auditReason: auditReason || "No reason provided"
    }, "Product safely moved to recycle bin (Soft Deleted) with audit logging.", 200, req);
  } catch (error) { 
    logger.error("Safe Delete Product Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Error processing safe deletion", 500, req); 
  }
});

module.exports = router;