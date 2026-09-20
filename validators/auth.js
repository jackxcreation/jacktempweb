// validators/auth.js
const { z } = require('zod');

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for User Registration
 */
const registerValidator = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").max(100, "Name cannot exceed 100 characters"),
  email: z.string().email("Invalid email format. Please provide a valid email address."),
  password: z.string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password is too long"),
  phone: z.string()
    .regex(/^\d{10}$/, "Invalid phone number. Must be exactly 10 digits")
    .optional()
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for User Login
 */
const loginValidator = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required")
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for OTP Verification / Request
 */
const otpValidator = z.object({
  identifier: z.string().min(1, "Identifier (email or phone) is required"),
  otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d+$/, "OTP must contain only numbers")
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Password Reset
 */
const passwordResetValidator = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long")
});

module.exports = {
  registerValidator,
  loginValidator,
  otpValidator,
  passwordResetValidator
};