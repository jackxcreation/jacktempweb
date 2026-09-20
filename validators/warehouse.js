// validators/warehouse.js
const { z } = require('zod');

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

module.exports = {
  warehouseValidationSchema,
  stockAdjustmentSchema
};