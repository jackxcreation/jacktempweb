const mongoose = require('mongoose');
const { Order } = require('../models');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// ==========================================
// 🛒 ABANDONED CART BACKGROUND WORKER
// ==========================================
const processAbandonedCarts = async () => {
  try {
    logger.info('🔄 Abandoned cart worker started execution...');

    // Define time threshold: carts inactive for more than 2 hours
    const thresholdTime = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const abandonedOrders = await Order.find({
      status: 'Pending',
      createdAt: { $lte: thresholdTime },
      abandonedProcessed: { $ne: true }
    }).limit(50);

    if (abandonedOrders.length === 0) {
      logger.info('✅ No abandoned carts found to process.');
      return;
    }

    for (const order of abandonedOrders) {
      order.abandonedProcessed = true;
      await order.save();

      logger.info({
        message: '🛒 Abandoned cart identified and queued for follow-up',
        orderId: order._id,
        userId: order.userId,
        createdAt: order.createdAt
      });
    }

    logger.info(`✅ Successfully processed ${abandonedOrders.length} abandoned carts.`);
  } catch (error) {
    logger.error({
      message: '❌ Error running abandoned cart worker',
      error: error.message,
      stack: error.stack
    });
  }
};

// If executed directly or imported
if (require.main === module) {
  processAbandonedCarts();
}

module.exports = { processAbandonedCarts };