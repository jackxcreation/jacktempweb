// validators/product.js
const { z } = require('zod');

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMA FOR PRODUCTS (TASK #48)
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
    if (!val) return [];
    if (typeof val === 'string') {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return Array.isArray(val) ? val.filter(Boolean) : [];
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

const productUpdateSchema = productValidationSchema.partial();

// 🔥 Add robust export aliases for maximum cross-module compatibility (Tasks #46–50 alignment)
const productCreationValidator = productValidationSchema;

module.exports = {
  productValidationSchema,
  productUpdateSchema,
  productCreationValidator,
  productUpdateValidator: productUpdateSchema
};