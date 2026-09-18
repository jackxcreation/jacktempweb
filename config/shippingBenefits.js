// config/shippingBenefits.js
/**
 * @file config/shippingBenefits.js
 * @description Single Source of Truth for Jack Essentials Store Shipping Policy, Thresholds, and Benefits.
 */

const SHIPPING_CONFIG = {
  FREE_SHIPPING_THRESHOLD_PAISE: 49900, // ₹499 in paise
  FREE_SHIPPING_THRESHOLD_RUPEES: 499,
  STANDARD_SHIPPING_FEE_PAISE: 6000,   // ₹60 in paise
  STANDARD_SHIPPING_FEE_RUPEES: 60,
  
  // Canonical Policy Texts (Eliminates UI Inconsistencies)
  POLICY_TEXT: "FREE DELIVERY ON ORDERS ABOVE ₹499",
  SHORT_POLICY_TEXT: "Free Delivery over ₹499",
  BANNER_ANNOUNCEMENT: "🔥 Special Offer: Free Delivery on all prepaid & COD orders above ₹499!",

  /**
   * Calculate shipping cost based on order total in paise.
   * @param {number} orderTotalPaise - Total order value in paise.
   * @returns {number} Shipping cost in paise.
   */
  calculateShippingFee: (orderTotalPaise) => {
    if (!orderTotalPaise || orderTotalPaise < 0) {
      return SHIPPING_CONFIG.STANDARD_SHIPPING_FEE_PAISE;
    }
    return orderTotalPaise >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD_PAISE 
      ? 0 
      : SHIPPING_CONFIG.STANDARD_SHIPPING_FEE_PAISE;
  },

  /**
   * Check if order qualifies for free shipping.
   * @param {number} orderTotalPaise - Total order value in paise.
   * @returns {boolean}
   */
  qualifiesForFreeShipping: (orderTotalPaise) => {
    return (orderTotalPaise || 0) >= SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD_PAISE;
  },

  /**
   * Get amount remaining for free shipping in paise.
   * @param {number} orderTotalPaise - Total order value in paise.
   * @returns {number} Amount remaining in paise (0 if qualified).
   */
  getAmountRemainingForFreeShipping: (orderTotalPaise) => {
    const remaining = SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD_PAISE - (orderTotalPaise || 0);
    return remaining > 0 ? remaining : 0;
  }
};

module.exports = SHIPPING_CONFIG;