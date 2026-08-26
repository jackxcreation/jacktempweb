const { Order, Warehouse } = require('../models');

// 🔥 COD Intelligence Engine
const evaluateCodEligibility = async (pincode, cartTotalPaise, userId) => {
  try {
    let codAvailable = true;
    let codFeePaise = 0; // Default no extra fee
    let riskLevel = 'LOW';
    let reason = "Serviceable";

    // 1. Check Pincode Blacklist or High Risk Zones (e.g. sample pin starting with '85' or remote)
    const restrictedPrefixes = ['82', '83', '84']; // Example high RTO zones
    if (restrictedPrefixes.some(prefix => pincode.startsWith(prefix))) {
      codAvailable = false;
      reason = "COD unavailable for this location due to high transit risk.";
      return { codAvailable, codFeePaise, riskLevel: 'HIGH', reason };
    }

    // 2. Check Order Value Threshold (e.g., COD disabled above ₹5000 for safety)
    if (cartTotalPaise > 500000) { // ₹5,000
      codAvailable = false;
      reason = "Orders above ₹5,000 require prepaid payment.";
      return { codAvailable, codFeePaise, riskLevel: 'MEDIUM', reason };
    }

    // 3. Evaluate User History & Risk (Check past cancelled/returned orders)
    if (userId) {
      const pastOrders = await Order.find({ user: userId }).lean();
      const cancelledCount = pastOrders.filter(o => o.status === 'Cancelled' || o.status === 'Returned').count || 0;
      
      if (cancelledCount >= 2) {
        riskLevel = 'HIGH';
        codFeePaise = 9900; // Charge ₹99 extra COD risk fee
        reason = "High cancellation history detected. COD fee applicable.";
      } else if (cartTotalPaise > 200000) {
        codFeePaise = 4900; // Standard ₹49 COD handling fee for orders > ₹2,000
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
    return { codAvailable: true, codFeePaise: 0, riskLevel: 'LOW', reason: "Default fallback" };
  }
};

module.exports = { evaluateCodEligibility };