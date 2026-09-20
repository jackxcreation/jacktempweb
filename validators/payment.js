// validators/payment.js
const { z } = require('zod');

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Payment Intent Creation
 */
const paymentIntentValidator = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  amountPaise: z.number().int().positive("Amount in paise must be a positive integer")
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Payment Verification (Razorpay / Gateway Signatures)
 */
const verifyPaymentValidator = z.object({
  gatewayOrderId: z.string().min(1, "Gateway Order ID is required"),
  gatewayPaymentId: z.string().min(1, "Gateway Payment ID is required"),
  gatewaySignature: z.string().min(1, "Gateway Signature is required")
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Refund Requests
 */
const refundValidator = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  amountPaise: z.number().int().positive("Refund amount in paise must be a positive integer").optional(),
  reason: z.string().max(300, "Refund reason cannot exceed 300 characters").optional()
});

module.exports = {
  paymentIntentValidator,
  verifyPaymentValidator,
  refundValidator
};