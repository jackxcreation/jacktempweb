const express = require('express');
const router = express.Router();
const { Warehouse } = require('../models'); 
const { z } = require('zod'); // 🔥 ADDED: Zod for strict input validation

// 🚨 IMPORT AUTH & RBAC MIDDLEWARES FOR CRITICAL SECURITY
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMA FOR WAREHOUSE
// ==========================================
const warehouseValidationSchema = z.object({
  name: z.string().min(2, "Warehouse name is required").max(100, "Name is too long"),
  location: z.string().min(2, "Location is required").max(200, "Location is too long"),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode. Must be 6 digits").optional(),
  capacity: z.number().int().nonnegative().optional(),
  contactNumber: z.string().regex(/^\d{10}$/, "Invalid contact number. Must be 10 digits").optional(),
  managerName: z.string().max(100).optional()
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

// 2. CREATE WAREHOUSE - WAREHOUSE / ADMIN RBAC 🔥 (Zod Validated & Critical Vulnerability Fixed)
router.post('/api/warehouse', protect, checkPermission('warehouse:all'), async (req, res) => {
  try {
    // 🔥 Strict Zod Validation
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

module.exports = router;