const mongoose = require('mongoose');
const { Product } = require('../models');

const checkStock = async (args = {}) => {
  if (!args.productId && !args.productName) {
    return { error: 'Product ID or Name required.' };
  }

  if (args.productId && !mongoose.Types.ObjectId.isValid(args.productId)) {
    return { error: 'Invalid Product ID format provided.' };
  }

  try {
    let query = {};
    if (args.productId) {
      query._id = args.productId;
    } else if (args.productName) {
      // SECURITY FIX: Escape regex to prevent ReDoS or database crashes
      const cleanName = String(args.productName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!cleanName) return { error: 'Product name cannot be empty.' };
      
      // SCHEMA FIX: Support both name and title
      query.$or = [
        { name: { $regex: cleanName, $options: 'i' } },
        { title: { $regex: cleanName, $options: 'i' } }
      ];
    }

    // MEMORY FIX: Use .lean()
    const product = await Product.findOne(query)
      .select('name title price pricePaise countInStock inventory images')
      .lean();

    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    let imageUrl = null;
    if (product.images && product.images.length > 0) {
      const firstImg = product.images[0];
      imageUrl = typeof firstImg === 'string' ? firstImg : (firstImg.url || null);
    }

    // Support multiple schema variations seamlessly
    const stockCount = product.inventory ?? product.countInStock ?? 0;
    const priceStr = `₹${(product.pricePaise || (product.price ? product.price * 100 : 0)) / 100}`;

    return {
      success: true,
      data: {
        productId: product._id.toString(),
        title: product.title || product.name,
        price: priceStr,
        stockStatus: stockCount > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        quantityAvailable: stockCount,
        image: imageUrl
      }
    };
  } catch (error) {
    console.error('Check Stock Tool Error:', error.message);
    return { error: 'Failed to fetch product information.' };
  }
};

module.exports = { checkStock };