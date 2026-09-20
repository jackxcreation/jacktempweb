// services/pricing/shippingService.js

/**
 * 🔥 TASK #61: Server-Side Dynamic Shipping Fee Calculation Service
 * Calculates shipping costs authoritatively on the backend based on order subtotal, 
 * total package weight, and delivery pincode serviceability.
 * 
 * @param {Object} context - Shipping context
 * @param {Number} context.subtotalPaise - Authoritative order subtotal in paise
 * @param {Number} [context.totalWeightGrams=500] - Total package weight in grams
 * @param {String} [context.pincode] - Delivery destination pincode
 * @returns {Promise<Number>} - Final shipping fee in paise
 */
const calculateShippingFee = async ({ subtotalPaise = 0, totalWeightGrams = 500, pincode = '' }) => {
  try {
    // 1. Free Shipping Threshold Rule (Orders above ₹999 / 99900 paise get free shipping)
    const FREE_SHIPPING_THRESHOLD_PAISE = 99900;
    if (subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE) {
      return 0; // Free shipping
    }

    // 2. Base Standard Shipping Fee (₹50 / 5000 paise)
    let shippingFeePaise = 5000;

    // 3. Weight-based incremental adjustment (if total package weight exceeds 1kg / 1000g)
    if (totalWeightGrams > 1000) {
      const extraWeightGrams = totalWeightGrams - 1000;
      const extraSlabs = Math.ceil(extraWeightGrams / 500); // Every extra 500g adds ₹15 / 1500 paise
      shippingFeePaise += extraSlabs * 1500;
    }

    // 4. Pincode / Zone-based regional surcharge check
    if (pincode && typeof pincode === 'string') {
      const cleanPin = pincode.trim();
      // Regional or remote hub surcharge logic
      const remotePrefixes = ['754', '79']; 
      if (remotePrefixes.some(prefix => cleanPin.startsWith(prefix))) {
        shippingFeePaise += 1000; // ₹10 regional handling surcharge
      }
    }

    return Math.max(0, shippingFeePaise);
  } catch (error) {
    console.error("Shipping Calculation Error:", error);
    return 5000; // Default fallback ₹50 in paise
  }
};

module.exports = {
  calculateShippingFee
};