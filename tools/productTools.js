const { Product } = require('../models');

const checkStock = async (args) => {
  if (!args.productId && !args.productName) return { error: 'Product ID or Name required.' };

  try {
    let query = {};
    if (args.productId) query._id = args.productId;
    else if (args.productName) query.name = { $regex: args.productName, $options: 'i' };

    const product = await Product.findOne(query).select('name price countInStock images');

    if (!product) return { error: 'Product not found.' };

    return {
      success: true,
      data: {
        productId: product._id,
        title: product.name,
        price: product.price,
        stockStatus: product.countInStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        quantityAvailable: product.countInStock,
        image: product.images && product.images.length > 0 ? product.images[0].url : null
      }
    };
  } catch (error) {
    return { error: 'Failed to fetch product information.' };
  }
};

module.exports = { checkStock };