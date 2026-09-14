// workers/analyticsWorker.js
const { Worker } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose'); // 🔥 Added for strict ObjectId validation
const { Product, ProductDailyMetrics, ProductViewEvent, OrderMetric, TrafficEvent } = require('../models');

// Safe logger import fallback to prevent undefined method crashes
let logger;
try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger || loggerModule;
} catch (e) {
  logger = console;
}

// ==========================================
// 🔥 ROBUST REDIS CONNECTION FOR BULLMQ WORKER
// ==========================================
const connection = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      tls: {
        rejectUnauthorized: false
      },
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    })
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    };

// 🔥 Prevent unhandled Redis error crashes
if (connection instanceof Redis) {
  connection.on('error', (err) => {
    if (typeof logger.error === 'function') {
      logger.error('Redis Analytics Worker Connection Error:', err.message);
    } else {
      console.error('Redis Analytics Worker Connection Error:', err.message);
    }
  });
}

// ==========================================
// 🔥 BULLMQ ANALYTICS & AGGREGATION WORKER
// ==========================================
const analyticsWorker = new Worker('analytics-queue', async (job) => {
  const { type, data } = job.data || {};
  if (!type) return;
  
  // Normalized Date object for Mongoose Schema compatibility
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  try {
    switch (type) {
      case 'PRODUCT_VIEW': {
        const { productId, userId, sessionId } = data || {};
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) return;

        // 1. Log raw view event
        await ProductViewEvent.create({ product: productId, userId: userId || null, sessionId: sessionId || '' });

        // 2. Increment Product global views counter safely
        await Product.findByIdAndUpdate(productId, { $inc: { views: 1 } });

        // 3. Upsert Daily Metrics for Product 
        await ProductDailyMetrics.findOneAndUpdate(
          { product: productId, date: todayDate },
          { $inc: { views: 1 } },
          { upsert: true, new: true }
        );
        break;
      }

      case 'ORDER_COMPLETED': {
        const { orderId, totalPaise, cogsPaise, contributionPaise, items, trafficSource } = data || {};
        if (!orderId) return;

        // 1. Upsert daily order metric
        await OrderMetric.findOneAndUpdate(
          { date: todayDate },
          { 
            $inc: { 
              totalOrders: 1, 
              grossRevenuePaise: totalPaise || 0,
              netProfitPaise: contributionPaise || 0 
            } 
          },
          { upsert: true, new: true }
        );

        // 2. Log traffic source acquisition event
        if (trafficSource) {
          await TrafficEvent.create({
            source: trafficSource.source || 'Direct',
            medium: trafficSource.medium || 'organic',
            campaign: trafficSource.campaign || 'none',
            userId: data.userId || null
          });
        }

        // 3. Update Daily Metrics per product in the order 
        if (Array.isArray(items)) {
          for (const item of items) {
            const prodId = item.productId || item.id;
            if (!prodId || !mongoose.Types.ObjectId.isValid(prodId)) continue;

            const qty = item.quantity || 1;
            const itemRev = (item.pricePaise || 0) * qty;

            await ProductDailyMetrics.findOneAndUpdate(
              { product: prodId, date: todayDate },
              { $inc: { sales: qty, revenuePaise: itemRev } },
              { upsert: true, new: true }
            );

            await Product.findByIdAndUpdate(prodId, { $inc: { sales: qty, totalRevenuePaise: itemRev } });
          }
        }
        break;
      }

      case 'ORDER_RETURN_OR_RTO': {
        const { orderId, type: eventType, items } = data || {};
        if (!Array.isArray(items)) return;

        for (const item of items) {
          const prodId = item.productId || item.id;
          if (!prodId || !mongoose.Types.ObjectId.isValid(prodId)) continue;

          const qty = item.quantity || 1;

          const updateQuery = eventType === 'RTO' ? { $inc: { rto: qty } } : { $inc: { returns: qty } };
          await ProductDailyMetrics.findOneAndUpdate({ product: prodId, date: todayDate }, updateQuery, { upsert: true });

          if (eventType === 'RTO') {
            await Product.findByIdAndUpdate(prodId, { $inc: { rtoCount: qty } });
          } else {
            await Product.findByIdAndUpdate(prodId, { $inc: { returnCount: qty } });
          }
        }
        break;
      }

      default:
        if (typeof logger.warn === 'function') {
          logger.warn(`Unknown analytics event type: ${type}`);
        } else {
          console.warn(`Unknown analytics event type: ${type}`);
        }
    }
  } catch (err) {
    const errorMsg = `Analytics Worker Error processing job ${job.id}`;
    if (typeof logger.error === 'function') {
      logger.error({ message: errorMsg, error: err.message, stack: err.stack });
    } else {
      console.error(errorMsg, err);
    }
    throw err;
  }
}, { connection, concurrency: 5 });

// Handle worker-level errors gracefully
analyticsWorker.on('error', (err) => {
  const workerErr = `Analytics Worker General Error: ${err.message}`;
  if (typeof logger.error === 'function') {
    logger.error(workerErr);
  } else {
    console.error(workerErr);
  }
});

analyticsWorker.on('completed', (job) => {});

analyticsWorker.on('failed', (job, err) => {
  const failMsg = `Analytics Job ${job?.id || 'Unknown'} failed with error: ${err.message}`;
  if (typeof logger.error === 'function') {
    logger.error(failMsg);
  } else {
    console.error(failMsg);
  }
});

module.exports = analyticsWorker;