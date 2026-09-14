// cron/backgroundJobs.js (or server cron runner)
const cron = require('node-cron');
const { Product } = require('./models');
const { queueAbandonedCarts } = require('./services/abandonedCartQueue'); // 🔥 Integrated BullMQ Abandoned Cart Cron Trigger

// ==========================================
// 🚀 1. TRENDING SCORE PRE-COMPUTATION WORKER
// ==========================================
const updateTrendingScores = async () => {
  try {
    console.time('TrendingScoreExecution');
    console.log('🔄 Running background worker to precompute trending scores...');
    
    // 🔥 Pro optimization: .lean() for faster execution and lower memory footprint
    const products = await Product.find({}).lean();

    if (!products || products.length === 0) {
      console.log('ℹ️ No products found for trending score computation.');
      console.timeEnd('TrendingScoreExecution');
      return;
    }

    const bulkOperations = products.map(product => {
      const sales = product.sales || 0;
      const recentViews = product.views || 0;
      const rating = product.rating || 0;

      // Calculate conversion dynamically instead of relying on a dead 0 value
      const calculatedConversion = recentViews > 0 ? parseFloat(((sales / recentViews) * 100).toFixed(2)) : 0;

      // Formula: sales × 5 + recentViews × 2 + conversion × 10 + rating × 3
      const score = (sales * 5) + (recentViews * 2) + (calculatedConversion * 10) + (rating * 3);

      return {
        updateOne: {
          filter: { _id: product._id },
          update: { 
            $set: { 
              trendingScore: score, 
              conversion: calculatedConversion 
            } 
          }
        }
      };
    });

    if (bulkOperations.length > 0) {
      await Product.bulkWrite(bulkOperations, { ordered: false });
      console.log(`✅ Trending scores successfully precomputed and updated for ${bulkOperations.length} products.`);
    }
    console.timeEnd('TrendingScoreExecution');
  } catch (error) {
    console.error('❌ Error in trending score worker:', error);
  }
};

// 🔥 CRON JOB 1: Har 1 ghante mein Trending Scores precompute karega
cron.schedule('0 * * * *', async () => {
  console.log("📈 CRON JOB RUNNING: Precomputing trending product scores...");
  await updateTrendingScores();
});

// ==========================================
// 🛒 2. ABANDONED CART EMAIL REMINDER WORKER (BullMQ Enqueuer)
// ==========================================
// 🔥 Scheduled every 30 minutes to push eligible abandoned carts into BullMQ queue
cron.schedule('*/30 * * * *', async () => {
  try {
    console.log("🛒 CRON JOB RUNNING: Enqueuing eligible abandoned carts...");
    if (typeof queueAbandonedCarts === 'function') {
      await queueAbandonedCarts();
    }
  } catch (err) {
    console.error("❌ Error in Abandoned Cart Cron Trigger:", err);
  }
});

console.log("✅ Automatic Background Analytics & Cron Systems Activated!");

module.exports = { updateTrendingScores };