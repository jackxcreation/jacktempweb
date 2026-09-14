// services/priceDropService.js (or wherever this file is located)
const { User, Product, PriceAlert } = require('../models');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525', 10),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// 🔥 Smart Background Cron Job: Runs daily or hourly to process personalized price-drop recs
const processSmartPriceDropRecommendations = async (io) => {
  try {
    console.info("🧠 Running AI-driven Personal Price Drop & Recommendation engine...");
    
    // 🔥 Pro Fix: Populate recentlyViewed so category is directly available
    const users = await User.find({ 'recentlyViewed.0': { $exists: true } })
      .populate('recentlyViewed')
      .lean();

    if (!users || users.length === 0) {
      console.info("ℹ️ No users with recent browsing history found.");
      return;
    }

    for (const user of users) {
      try {
        if (!user.recentlyViewed || user.recentlyViewed.length === 0 || !user.email) continue;

        // Pick the last viewed product category to find related price drops
        const lastViewed = user.recentlyViewed[0];
        if (!lastViewed || !lastViewed.category) continue;

        const category = lastViewed.category;
        const viewedIds = user.recentlyViewed.map(p => p._id ? p._id.toString() : p.toString());

        // Find products in the same category that have active discounts or price drops
        const relatedDiscountedProducts = await Product.find({
          category: category,
          _id: { $nin: viewedIds },
          mrpPaise: { $exists: true },
          $expr: { $gt: ["$mrpPaise", "$pricePaise"] }
        }).sort({ createdAt: -1 }).limit(2).lean();

        if (relatedDiscountedProducts && relatedDiscountedProducts.length > 0) {
          const recommendedItem = relatedDiscountedProducts[0];
          const mrpVal = recommendedItem.mrpPaise || 0;
          const priceVal = recommendedItem.pricePaise || 0;

          if (mrpVal <= 0) continue;

          const discountPercent = Math.round(((mrpVal - priceVal) / mrpVal) * 100);

          // 1. Real-time Push via Socket.io if user is connected
          if (io) {
            try {
              io.to(user._id.toString()).emit('smart_price_drop_recommendation', {
                title: "🔥 Price Drop on your recent interest!",
                message: `Because you viewed ${lastViewed.title || 'similar items'}, ${recommendedItem.title} is now ${discountPercent}% OFF!`,
                productId: recommendedItem._id,
                newPrice: priceVal
              });
            } catch (socketErr) {
              console.error("Socket emit error for user:", user._id, socketErr.message);
            }
          }

          // 2. Automated Personalized Email Alert
          await transporter.sendMail({
            from: '"Jack Essentials Personal Shopper" <support@thejackessentials.com>',
            to: user.email,
            subject: `📉 Price Drop Alert: Save ${discountPercent}% on items related to your recent search!`,
            html: `
              <div style="font-family:sans-serif;padding:24px;background:#f8f9fa;border-radius:20px;max-width:600px;margin:auto;border:1px solid #e2e8f0;">
                <div style="background:#FF4500;color:#fff;padding:8px 16px;border-radius:8px;display:inline-block;font-size:12px;font-weight:bold;text-transform:uppercase;margin-bottom:12px;">Personalized Price Drop</div>
                <h2 style="color:#0f172a;margin-top:0;">We noticed you were browsing ${category}!</h2>
                <p style="color:#475569;font-size:14px;">Based on your recent activity, an item you might love just dropped in price:</p>
                
                <div style="background:#ffffff;padding:16px;border-radius:12px;border:1px solid #cbd5e1;margin:16px 0;">
                  <h3 style="color:#1e293b;margin:0 0 8px 0;">${recommendedItem.title}</h3>
                  <p style="margin:0;"><s style="color:#94a3b8;">₹${mrpVal / 100}</s> &nbsp;➔&nbsp; <b style="color:#16a34a;font-size:18px;">₹${priceVal / 100}</b> (${discountPercent}% OFF)</p>
                </div>

                <a href="${process.env.CLIENT_URL || 'https://thejackessentials.com'}/product/${recommendedItem._id}" style="background:#0f172a;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;display:block;text-align:center;font-weight:bold;font-size:14px;">View Deal Now</a>
              </div>
            `
          });
        }
      } catch (userLoopErr) {
        console.error(`Failed processing price drop for user ${user._id}:`, userLoopErr.message);
      }
    }
    console.info("✅ Smart price drop recommendation engine cycle completed.");
  } catch (err) {
    console.error("Smart price-drop background engine error:", err);
  }
};

module.exports = { processSmartPriceDropRecommendations };