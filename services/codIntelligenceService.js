// services/shipping/codEngine.js
const { Order, Warehouse } = require('../models');

// 🔥 COD Intelligence Engine
const evaluateCodEligibility = async (pincode, cartTotalPaise, userId) => {
  try {
    let codAvailable = true;
    let codFeePaise = 0; // Default no extra fee
    let riskLevel = 'LOW';
    let reason = "Serviceable";

    // 🔥 Sanitize inputs
    const cleanPincode = pincode ? String(pincode).trim() : "";
    const numericCartTotal = Number(cartTotalPaise) || 0;

    if (!cleanPincode || cleanPincode.length < 6) {
      return { codAvailable: false, codFeePaise: 0, riskLevel: 'MEDIUM', reason: "Invalid or missing pincode." };
    }

    // 1. Check Pincode Blacklist or High Risk Zones (e.g. sample pin starting with '85' or remote)
    const restrictedPrefixes = ['82', '83', '84']; // Example high RTO zones
    if (restrictedPrefixes.some(prefix => cleanPincode.startsWith(prefix))) {
      codAvailable = false;
      reason = "COD unavailable for this location due to high transit risk.";
      return { codAvailable, codFeePaise, riskLevel: 'HIGH', reason };
    }

    // 2. Check Order Value Threshold (e.g., COD disabled above ₹5000 for safety)
    if (numericCartTotal > 500000) { // ₹5,000
      codAvailable = false;
      reason = "Orders above ₹5,000 require prepaid payment.";
      return { codAvailable, codFeePaise, riskLevel: 'MEDIUM', reason };
    }

    // 3. Evaluate User History & Risk (Check past cancelled/returned/RTO orders)
    if (userId) {
      const pastOrders = await Order.find({ userId }).lean();
      
      // 🔥 Enhanced: Track Cancelled, Returned, and RTO orders
      const badOrdersCount = pastOrders.filter(o => 
        o.status === 'Cancelled' || o.status === 'Returned' || o.status === 'RTO'
      ).length;
      
      if (badOrdersCount >= 2) {
        riskLevel = 'HIGH';
        codFeePaise = 9900; // Charge ₹99 extra COD risk fee
        reason = "High cancellation or return history detected. COD fee applicable.";
      } else if (numericCartTotal > 200000) {
        codFeePaise = 4900; // Standard ₹49 COD handling fee for orders > ₹2,000
        reason = "Standard COD handling fee applied for orders above ₹2,000.";
      }
    }

    return {
      codAvailable,
      codFeePaise,
      riskLevel,
      reason
    };
  } catch (error) {
    console.error("COD Intelligence Evaluation Error:", error);
    return { codAvailable: true, codFeePaise: 0, riskLevel: 'LOW', reason: "Default fallback due to evaluation error" };
  }
};

module.exports = { evaluateCodEligibility };