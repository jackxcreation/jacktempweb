const cron = require('node-cron');
const { Product } = require('./models');

// ==========================================
// 🚀 1. TRENDING SCORE PRE-COMPUTATION WORKER
// ==========================================
const updateTrendingScores = async () => {
  try {
    console.log('🔄 Running background worker to precompute trending scores...');
    const products = await Product.find({});

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
      await Product.bulkWrite(bulkOperations);
      console.log('✅ Trending scores successfully precomputed and updated in DB.');
    }
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
// 🛒 2. ABANDONED CART EMAIL REMINDER WORKER
// ==========================================
// 🔥 PHASE 4 FIX: Removed conflicting Abandoned Cart Cron logic. 
// This is now exclusively and safely handled by BullMQ inside `services/cartScheduler.js` and `workers/abandonedCartWorker.js`.
// This resolves the double-firing issue and cleans up the architecture.

console.log("✅ Automatic Background Analytics Systems Activated!");