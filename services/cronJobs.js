const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { AbandonedCart } = require('../models');

// Email Bhejne ka Setup (Tujhe yahan apni Gmail id aur App Password dalna hoga)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'support@thejackessentials.com', // Apni email daal
    pass: 'wcfdkghuuojnglfd'   // Gmail se 'App Password' generate karke daalna hoga
  }
});

// 🔥 CRON JOB: Har 30 minute mein chalega 🔥
cron.schedule('*/30 * * * *', async () => {
  console.log("🤖 CRON JOB RUNNING: Checking for abandoned carts...");
  
  try {
    // 2 Ghante (2 hours) purana time nikalo
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Wo carts dhundho jo 2 ghante purane hain aur jinko abhi tak mail nahi gaya
    const abandonedCarts = await AbandonedCart.find({
      updatedAt: { $lt: twoHoursAgo },
      adminNote: "Pending" // Hum isko flag ki tarah use kar rahe hain
    });

    if (abandonedCarts.length === 0) {
      console.log("No abandoned carts found.");
      return;
    }

    // Har cart wale user ko mail bhejo
    for (let cart of abandonedCarts) {
      const mailOptions = {
        from: '"Jack Essentials" <support@thejackessentials.com>',
        to: cart.user.email,
        subject: `Hey ${cart.user.name.split(' ')[0]}, You left something behind! 🛒`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1 style="color: #FF4500;">Jack Essentials</h1>
            <h2>Oops! You forgot your items...</h2>
            <p>We noticed you left some amazing items in your cart. They are selling out fast!</p>
            <p>Use code <strong>COMEBACK10</strong> to get an extra 10% OFF if you complete your purchase today.</p>
            
            <a href="http://localhost:5173/cart" style="display: inline-block; background-color: #0B0F19; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">
              COMPLETE MY ORDER
            </a>
          </div>
        `
      };

      // Email Bhejo
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to: ${cart.user.email}`);

      // Database mein update kar do ki mail chala gaya taaki dubara na jaye
      cart.adminNote = "Email Sent";
      await cart.save();
    }
  } catch (error) {
    console.error("Cron Job Error:", error);
  }
});

console.log("✅ Automatic Email System Activated!");