// services/support/tools/catalogTools.js
const mongoose = require('mongoose');
const { Product } = require('../../models');

/**
 * Retrieves product information and catalog details.
 * Enhanced with ID/SKU validation and .lean() memory optimization.
 */
const getProduct = async (args = {}) => {
  if (!args.productId && !args.sku && !args.title) {
    return { error: 'Product ID, SKU, or title is required to search the catalog.' };
  }

  try {
    let query = {};
    if (args.productId) {
      if (!mongoose.Types.ObjectId.isValid(args.productId)) {
        return { error: 'Invalid Product ID format provided.' };
      }
      query._id = args.productId;
    } else if (args.sku) {
      query.sku = { $regex: new RegExp(`^${args.sku}$`, 'i') };
    } else if (args.title) {
      query.title = { $regex: new RegExp(args.title, 'i') };
    }

    // MEMORY FIX: Use .lean() to prevent memory bloat during AI execution
    const product = await Product.findOne(query)
      .select('title description price pricePaise mrp sku category brand images inventory inventoryState stock')
      .lean();

    if (!product) {
      return { success: false, message: 'No matching product found in the catalog.' };
    }

    const priceValue = product.pricePaise ? product.pricePaise / 100 : (product.price || 0);
    const availableStock = product.inventoryState?.available ?? product.inventory ?? product.stock ?? 0;

    return {
      success: true,
      data: {
        productId: product._id.toString(),
        title: product.title,
        description: product.description,
        price: `₹${priceValue}`,
        sku: product.sku || 'N/A',
        category: product.category || 'General',
        brand: product.brand || 'Jack Essentials',
        inStock: availableStock > 0,
        availableStock
      }
    };
  } catch (error) {
    console.error('Get Product Catalog Tool Error:', error.message);
    return { error: 'Failed to retrieve product details from the catalog.' };
  }
};

module.exports = { getProduct };