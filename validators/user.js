// validators/user.js
const { z } = require('zod');

/**
 * Strict Whitelist Schema for User Profile Updates
 * Prevents mass-assignment by explicitly allowing only safe profile fields 
 * and rejecting any unauthorized fields (like role, isLocked, password, etc.) via .strict()
 */
const userUpdateValidator = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long").optional(),
  mobile: z.string().regex(/^\d{10}$/, "Invalid mobile number format. Must be 10 digits").optional(),
  phone: z.string().regex(/^\d{10}$/, "Invalid phone format. Must be 10 digits").optional(),
  address: z.union([
    z.object({
      flat: z.string().optional(),
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().regex(/^\d{6}$/, "Invalid pincode format. Must be 6 digits").optional(),
      primaryPhone: z.string().optional()
    }),
    z.array(z.any())
  ]).optional(),
  addresses: z.array(z.any()).optional(), // Backward compatibility for legacy address arrays
  preferences: z.record(z.any()).optional()
}).strict(); // 🔥 .strict() ensures request fails if any unwhitelisted field is passed!

/**
 * Strict Validation Schema for User Registration
 */
const userRegistrationValidator = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().regex(/^\d{10}$/, "Invalid phone number").optional()
}).strict();

/**
 * Strict Validation Schema for User Login
 */
const userLoginValidator = z.object({
  email: z.string().email("Invalid email address format"),
  password: z.string().min(1, "Password is required")
}).strict();

module.exports = {
  userUpdateValidator,
  userRegistrationValidator,
  userLoginValidator
};