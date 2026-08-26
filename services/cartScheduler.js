// services/cartScheduler.js
const { Queue } = require('bullmq');
const AbandonedCart = require('../models/AbandonedCart');

// 🔥 Explicitly pass Redis URL from .env to stop it from hitting localhost
const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const abandonedCartQueue = new Queue('abandoned-cart-queue', { connection });

// Function to be called by your Cron job every 30 minutes
const queueAbandonedCarts = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find carts abandoned > 30 mins ago, where email hasn't been sent yet, and max attempts < 3
    const oldCarts = await AbandonedCart.find({
      abandonedEmailSentAt: null,
      attemptCount: { $lt: 3 },
      updatedAt: { $lte: thirtyMinutesAgo }
    }).lean();

    console.info(`📦 Found ${oldCarts.length} abandoned carts to enqueue.`);

    for (const cart of oldCarts) {
      // Add job to BullMQ queue with backoff/retry options
      await abandonedCartQueue.add('send-abandoned-email', {
        cartId: cart._id.toString(),
        userEmail: cart.user.email,
        userName: cart.user.name || 'Valued Customer',
        items: cart.items,
        totalValue: cart.totalValue
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000 // Retry after 5s, then 10s, then 20s if failed
        },
        removeOnComplete: true,
        removeOnFail: false
      });
    }
  } catch (error) {
    console.error("❌ Error queuing abandoned carts:", error);
  }
};

module.exports = { abandonedCartQueue, queueAbandonedCarts };