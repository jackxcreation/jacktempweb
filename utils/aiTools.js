const { Product, Order } = require('../models');

// ==========================================
// 🛡️ CONTROLLED AI TOOL FUNCTIONS FOR GROQ
// ==========================================

/**
 * 1. Search Products securely with filters
 */
async function searchProducts({ query, category, maxPrice, brand }) {
  try {
    const filter = {};
    if (category && category !== 'All') filter.category = new RegExp(category, 'i');
    if (brand) filter.brand = new RegExp(brand, 'i');
    if (maxPrice) filter.pricePaise = { $lte: Number(maxPrice) * 100 }; // Convert to paise
    
    if (query) {
      filter.$or = [
        { title: new RegExp(query, 'i') },
        { description: new RegExp(query, 'i') },
        { tags: new RegExp(query, 'i') }
      ];
    }

    const products = await Product.find(filter).limit(5).lean();
    return products.map(p => ({
      id: p._id.toString(),
      title: p.title,
      price: `₹${p.pricePaise / 100}`,
      category: p.category,
      brand: p.brand,
      rating: p.rating,
      inStock: p.inventory > 0
    }));
  } catch (error) {
    console.error("AI Tool Search Error:", error);
    return { error: "Failed to search products" };
  }
}

/**
 * 2. Compare two products side-by-side
 */
async function compareProducts({ productId1, productId2 }) {
  try {
    const p1 = await Product.findById(productId1).lean();
    const p2 = await Product.findById(productId2).lean();

    if (!p1 || !p2) return { error: "One or both products not found for comparison." };

    return {
      product1: {
        title: p1.title,
        price: `₹${p1.pricePaise / 100}`,
        brand: p1.brand,
        rating: p1.rating,
        specs: { weight: p1.weight, size: p1.size, color: p1.color, material: p1.material }
      },
      product2: {
        title: p2.title,
        price: `₹${p2.pricePaise / 100}`,
        brand: p2.brand,
        rating: p2.rating,
        specs: { weight: p2.weight, size: p2.size, color: p2.color, material: p2.material }
      }
    };
  } catch (error) {
    console.error("AI Tool Compare Error:", error);
    return { error: "Failed to compare products" };
  }
}

/**
 * 3. Check live product inventory/stock
 */
async function checkStock({ productId }) {
  try {
    const product = await Product.findById(productId).lean();
    if (!product) return { error: "Product not found" };

    return {
      productId: product._id.toString(),
      title: product.title,
      inventory: product.inventory,
      isAvailable: product.inventory > 0
    };
  } catch (error) {
    console.error("AI Tool Stock Error:", error);
    return { error: "Failed to check stock" };
  }
}

/**
 * 4. Check delivery serviceability via Delhivery API / Pincode
 */
async function checkDelivery({ pincode }) {
  try {
    if (!pincode || pincode.length !== 6) {
      return { serviceable: false, message: "Invalid 6-digit pincode provided." };
    }

    // Call Delhivery pincode serviceability check API or simulated logic
    const response = await fetch(`https://track.delhivery.com/c/api/pin-codes.json?filter_codes=${pincode}`, {
      headers: { 'Authorization': `Token ${process.env.DELHIVERY_TOKEN}` }
    });
    
    if (!response.ok) {
      // Fallback response if external api fails
      return { serviceable: true, estimatedDays: 3, message: "Standard delivery available within 3-5 business days." };
    }

    const data = await response.json();
    const isServiceable = data.delivery_codes && data.delivery_codes.length > 0;

    return {
      pincode,
      serviceable: isServiceable,
      codAvailable: isServiceable ? true : false,
      estimatedDelivery: isServiceable ? "3-5 Business Days" : "Not serviceable"
    };
  } catch (error) {
    console.error("AI Tool Delivery Check Error:", error);
    return { serviceable: true, estimatedDays: 4, message: "Standard delivery available." };
  }
}

/**
 * 5. Track user order securely (IDOR protected via userId mapping)
 */
async function trackOrder({ orderId, userId }) {
  try {
    const order = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) return { error: "Order not found or access denied." };

    return {
      orderId: order._id.toString(),
      status: order.status,
      totalAmount: `₹${order.totalPaise / 100}`,
      paymentMethod: order.paymentMethod,
      shiprocketAWB: order.shiprocketOrderId || "Yet to be generated",
      createdAt: order.createdAt
    };
  } catch (error) {
    console.error("AI Tool Track Order Error:", error);
    return { error: "Failed to track order" };
  }
}

// Map tools for Groq Function Calling execution router
const availableTools = {
  searchProducts,
  compareProducts,
  checkStock,
  checkDelivery,
  trackOrder
};

module.exports = { availableTools };