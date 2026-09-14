// workers/abandonedCartWorker.js
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

    if (!abandonedOrders || abandonedOrders.length === 0) {
      logger.info('✅ No abandoned carts found to process.');
      return;
    }

    let processedCount = 0;

    for (const order of abandonedOrders) {
      try {
        order.abandonedProcessed = true;
        await order.save();

        logger.info({
          message: '🛒 Abandoned cart identified and queued for follow-up',
          orderId: order._id,
          userId: order.userId || order.user || 'Guest',
          createdAt: order.createdAt
        });
        processedCount++;
      } catch (orderErr) {
        logger.error({
          message: `❌ Failed to process individual abandoned order ${order._id}`,
          error: orderErr.message
        });
      }
    }

    logger.info(`✅ Successfully processed ${processedCount} out of ${abandonedOrders.length} abandoned carts.`);
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
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error("FATAL: MONGO_URI environment variable is required to run abandoned cart worker directly.");
    process.exit(1);
  }

  mongoose.connect(MONGO_URI)
    .then(async () => {
      logger.info("Connected to MongoDB for abandoned cart worker standalone execution.");
      await processAbandonedCarts();
      await mongoose.connection.close();
      process.exit(0);
    })
    .catch(err => {
      logger.error("MongoDB standalone connection failed:", err.message);
      process.exit(1);
    });
}

module.exports = { processAbandonedCarts };