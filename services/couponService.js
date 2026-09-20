// services/couponService.js
const { Coupon } = require('../models');

/**
 * 🔥 TASK #60: Server-Side Coupon Verification and Calculation Service
 * Validates coupon code authenticity, expiration, minimum cart value, usage limits, 
 * and calculates precise discount in paise.
 * 
 * @param {String} couponCode - The promotional coupon code entered by user
 * @param {Number} cartSubtotalPaise - The authoritative subtotal in paise
 * @returns {Object} { success: boolean, discountPaise: number, message?: string }
 */
const validateAndCalculateCoupon = async (couponCode, cartSubtotalPaise) => {
  try {
    if (!couponCode || typeof couponCode !== 'string') {
      return { success: false, discountPaise: 0, message: "Invalid coupon code format." };
    }

    const cleanCode = couponCode.trim().toUpperCase();
    let discountPaise = 0;

    // 1. Try fetching from MongoDB Coupon Model if available
    let couponDoc = null;
    try {
      if (Coupon && typeof Coupon.findOne === 'function') {
        couponDoc = await Coupon.findOne({ code: cleanCode, isActive: true }).lean();
      }
    } catch (dbErr) {
      console.warn("Coupon DB lookup notice: Falling back to secure default rules.", dbErr.message);
    }

    if (couponDoc) {
      // Validate expiration date
      if (couponDoc.expiresAt && new Date() > new Date(couponDoc.expiresAt)) {
        return { success: false, discountPaise: 0, message: "This coupon has expired." };
      }

      // Validate minimum order value
      const minOrderPaise = couponDoc.minOrderPaise || couponDoc.minimumAmount || 0;
      if (cartSubtotalPaise < minOrderPaise) {
        return { 
          success: false, 
          discountPaise: 0, 
          message: `Minimum order value of ₹${(minOrderPaise / 100).toFixed(2)} required for this coupon.` 
        };
      }

      // Validate usage limits if applicable
      if (couponDoc.usageLimit && couponDoc.timesUsed >= couponDoc.usageLimit) {
        return { success: false, discountPaise: 0, message: "Coupon usage limit has been exhausted." };
      }

      // Calculate discount based on type
      if (couponDoc.discountType === 'PERCENTAGE' || couponDoc.type === 'percentage') {
        const percent = couponDoc.discountValue || couponDoc.value || 0;
        discountPaise = Math.round((cartSubtotalPaise * percent) / 100);
        if (couponDoc.maxDiscountPaise && discountPaise > couponDoc.maxDiscountPaise) {
          discountPaise = couponDoc.maxDiscountPaise;
        }
      } else if (couponDoc.discountType === 'FLAT' || couponDoc.type === 'flat') {
        discountPaise = couponDoc.discountValue || couponDoc.value || 0;
      }
    } else {
      // Fallback to enterprise hardcoded promotional codes if not in DB
      if (cleanCode === 'JACK10') {
        discountPaise = Math.round(cartSubtotalPaise * 0.10); // 10% off
      } else if (cleanCode === 'WELCOME50') {
        discountPaise = 5000; // Flat ₹50 off (5000 paise)
      } else if (cleanCode === 'FESTIVE20') {
        discountPaise = Math.round(cartSubtotalPaise * 0.20); // 20% off
      } else {
        return { success: false, discountPaise: 0, message: "Invalid or expired coupon code." };
      }
    }

    // Ensure discount never exceeds cart subtotal
    if (discountPaise > cartSubtotalPaise) {
      discountPaise = cartSubtotalPaise;
    }

    return {
      success: true,
      discountPaise,
      message: "Coupon applied successfully!"
    };
  } catch (error) {
    console.error("Coupon Service Error:", error);
    return {
      success: false,
      discountPaise: 0,
      message: error.message || "Failed to validate coupon."
    };
  }
};

module.exports = {
  validateAndCalculateCoupon
};