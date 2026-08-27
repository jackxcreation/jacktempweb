const { Worker } = require('bullmq');
const { Resend } = require('resend');
const AbandonedCart = require('../models/AbandonedCart');

const resend = new Resend(process.env.RESEND_API_KEY);

// ==========================================
// 🔥 PRODUCTION REDIS VALIDATION FOR WORKER
// ==========================================
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    throw new Error('FATAL: REDIS_URL environment variable is required in production for BullMQ workers.');
}

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

// 🔥 Setup BullMQ Worker for Scalable Email Dispatch
const abandonedCartWorker = new Worker('abandoned-cart-queue', async (job) => {
  const { cartId, userEmail, userName, items, totalValue } = job.data;

  try {
    const cart = await AbandonedCart.findById(cartId);
    if (!cart || cart.abandonedEmailSentAt) {
      return { status: 'skipped', reason: 'Cart already processed or not found' };
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is missing in environment");
    }

    // Build Email HTML Content
    const itemsListHtml = items.map(i => `<li>${i.title} (x${i.quantity}) - ₹${(i.pricePaise / 100).toFixed(2)}</li>`).join('');
    const checkoutLink = `https://thejackessentials.com/checkout`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Hey ${userName}, you left something behind! 🛒</h2>
        <p>We noticed you left items worth ₹${(totalValue / 100).toFixed(2)} in your cart at Jack Essentials.</p>
        <ul>${itemsListHtml}</ul>
        <p>Complete your order before stock runs out:</p>
        <a href="${checkoutLink}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Checkout</a>
      </div>
    `;

    // Send email via Resend
    await resend.emails.send({
      from: 'Jack Essentials <updates@thejackessentials.com>',
      to: [userEmail],
      subject: '⏳ Complete your purchase - Jack Essentials',
      html: htmlContent
    });

    // 🔥 Update tracking fields atomically
    cart.abandonedEmailSentAt = new Date();
    cart.attemptCount += 1;
    cart.lastAttemptAt = new Date();
    await cart.save();

    return { status: 'success', cartId };
  } catch (error) {
    console.error(`❌ Failed to process abandoned cart job for ID ${cartId}:`, error.message);
    
    // Update attempt metrics even on failure
    await AbandonedCart.findByIdAndUpdate(cartId, {
      $inc: { attemptCount: 1 },
      $set: { lastAttemptAt: new Date() }
    });

    throw error; // BullMQ will handle retries based on job configuration
  }
}, { 
  connection,
  concurrency: 5 // Process 5 emails concurrently per worker thread
});

abandonedCartWorker.on('completed', (job) => {
  console.info(`✅ Abandoned cart email job ${job.id} completed successfully.`);
});

abandonedCartWorker.on('failed', (job, err) => {
  console.error(`❌ Abandoned cart email job ${job.id} failed with error: ${err.message}`);
});

module.exports = abandonedCartWorker;