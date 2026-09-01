const express = require('express');
const router = express.Router();
const { Warehouse, Product } = require('../models'); 
const { z } = require('zod'); 

// 🚨 IMPORT AUTH & RBAC MIDDLEWARES FOR CRITICAL SECURITY
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMA FOR WAREHOUSE
// ==========================================
const warehouseValidationSchema = z.object({
  name: z.string().min(2, "Warehouse name is required").max(100, "Name is too long"),
  managerName: z.string().min(2, "Manager name is required").max(100, "Manager name is too long"),
  phone: z.string().min(10, "Contact number must be at least 10 digits"), 
  street: z.string().min(2, "Street address is required").max(300, "Address is too long"),
  landmark: z.string().optional().nullable(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().min(6, "Invalid pincode")
});

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMA FOR STOCK ADJUSTMENTS & LEDGER
// ==========================================
const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  type: z.enum(['IN', 'OUT', 'RESERVED', 'RELEASED', 'TRANSFER', 'RETURN', 'DAMAGE', 'ADJUSTMENT']),
  source: z.enum(['Order', 'Return', 'Manual Adjustment', 'Warehouse Transfer', 'Purchase']),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  targetState: z.enum(['available', 'damaged', 'returned', 'qcPending', 'sellable']).default('available'),
  reason: z.string().max(250).optional().default(''),
  referenceId: z.string().optional().default('')
});

// ==========================================
// 🏢 WAREHOUSE APIs (SECURED & RBAC ENFORCED)
// ==========================================

// 1. GET ALL WAREHOUSES - WAREHOUSE / ADMIN RBAC
router.get('/api/warehouse', protect, checkPermission('warehouse:all'), async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 }).lean();
    res.status(200).json(warehouses.map(w => ({ ...w, id: w._id.toString() })));
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch warehouse" });
  }
});

// 2. CREATE WAREHOUSE - WAREHOUSE / ADMIN RBAC 🔥
router.post('/api/warehouse', protect, checkPermission('warehouse:all'), async (req, res) => {
  try {
    const validationResult = warehouseValidationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format() 
      });
    }

    const newWarehouse = new Warehouse(validationResult.data);
    const savedWarehouse = await newWarehouse.save();
    
    res.status(201).json({ success: true, warehouse: { ...savedWarehouse._doc, id: savedWarehouse._id.toString() } });
  } catch (error) {
    console.error("Create Warehouse Error:", error);
    res.status(500).json({ success: false, error: "Failed to create warehouse" });
  }
});

// ==========================================
// 📦 3. MULTI-STATE INVENTORY & STOCK LEDGER ADJUSTMENT API 🔥
// ==========================================
router.post('/api/warehouse/stock-adjustment', protect, checkPermission('warehouse:all'), async (req, res) => {
  try {
    const validationResult = stockAdjustmentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Stock adjustment validation failed",
        errors: validationResult.error.format()
      });
    }

    const { productId, type, source, quantity, targetState, reason, referenceId } = validationResult.data;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Initialize inventoryState if missing
    if (!product.inventoryState) {
      product.inventoryState = { available: product.inventory || 0, sellable: product.inventory || 0 };
    }

    const previousAvailable = product.inventoryState[targetState] || 0;
    let newAvailable = previousAvailable;

    // Calculate state updates based on movement type
    if (['IN', 'RETURN', 'RELEASED'].includes(type)) {
      newAvailable = previousAvailable + quantity;
    } else if (['OUT', 'RESERVED', 'DAMAGE', 'ADJUSTMENT'].includes(type)) {
      if (previousAvailable < quantity && type !== 'ADJUSTMENT') {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock in state '${targetState}'. Current: ${previousAvailable}, Requested: ${quantity}` 
        });
      }
      newAvailable = type === 'ADJUSTMENT' ? quantity : previousAvailable - quantity;
    }

    // Update target inventory state
    product.inventoryState[targetState] = Math.max(0, newAvailable);

    // Keep legacy global inventory in sync if modifying 'available' or 'sellable'
    if (targetState === 'available' || targetState === 'sellable') {
      product.inventory = product.inventoryState.available;
    }

    // Push immutable entry to Stock Movement Ledger
    product.stockLedger.push({
      type,
      quantity,
      previousAvailable,
      newAvailable: product.inventoryState[targetState],
      source,
      referenceId,
      reason,
      performedBy: req.user._id,
      timestamp: new Date()
    });

    await product.save();

    res.status(200).json({
      success: true,
      message: "Stock adjusted and ledger recorded successfully.",
      product: {
        id: product._id.toString(),
        title: product.title,
        inventory: product.inventory,
        inventoryState: product.inventoryState,
        latestLedgerEntry: product.stockLedger[product.stockLedger.length - 1]
      }
    });

  } catch (error) {
    console.error("Stock Adjustment Error:", error);
    res.status(500).json({ success: false, message: "Failed to process stock adjustment." });
  }
});

module.exports = router;