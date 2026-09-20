// validators/order.js
const { z } = require('zod');

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Order Creation
 */
const orderCreationValidator = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1, "Product ID is required"),
      quantity: z.number().int().positive("Quantity must be an integer greater than 0")
    })
  ).min(1, "Order must contain at least one item"),
  
  address: z.object({
    name: z.string().min(1, "Recipient name is required"),
    flat: z.string().optional().default("N/A"),
    street: z.string().optional().default("N/A"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().regex(/^\d{6}$/, "Invalid pincode format. Must be a 6-digit postal code"),
    primaryPhone: z.string()
      .regex(/^\d{10}$/, "Invalid phone number format. Must be 10 digits")
      .or(z.string().min(10).max(15))
      .default("N/A")
  }),
  
  paymentMethod: z.string().min(1, "Payment method is required"),
  couponCode: z.string().optional(),
  idempotencyKey: z.string().optional(), // 🔥 TASK #25: Prevents double-charging / duplicate order retries
  
  userDetails: z.object({
    name: z.string().optional(),
    email: z.string().email("Invalid email format").optional()
  }).optional(),
  
  trafficSource: z.any().optional()
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Order Status Updates (Admin / State Machine)
 */
const orderUpdateValidator = z.object({
  status: z.enum([
    'Pending Review', 'Pending', 'Paid', 'Processing', 'Packed', 
    'Shipped', 'OutForDelivery', 'Delivered', 'Cancelled', 
    'Refunded', 'ReturnRequested', 'ReturnApproved', 'Returned', 'RTO'
  ]).optional(),
  
  adminNotes: z.string().max(500, "Admin notes cannot exceed 500 characters").optional(),
  refundStatus: z.string().optional(),
  auditReason: z.string().max(300, "Audit reason cannot exceed 300 characters").optional()
});

module.exports = {
  orderCreationValidator,
  orderUpdateValidator
};