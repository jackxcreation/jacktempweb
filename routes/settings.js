const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');

// ==========================================
// 1. GET STORE SETTINGS (Public - For Footer)
// ==========================================
router.get('/', async (req, res) => {
  try {
    // Database mein humesha sirf EK hi settings document rahega
    let settings = await Setting.findOne();
    
    // Agar database ekdum khali hai, toh default values se ek create kar do
    if (!settings) {
      settings = new Setting({
        shopLinks: [
          { title: "Electronics", url: "/shop/electronics" },
          { title: "Men's Fashion", url: "/shop/fashion" },
          { title: "Super Offers 🔥", url: "/shop" }
        ],
        supportLinks: [
          { title: "Track Your Order", url: "/track-order" },
          { title: "Returns & Exchanges", url: "/returns" },
          { title: "Contact Us", url: "/contact" }
        ]
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error("Fetch Settings Error:", error);
    res.status(500).json({ error: "Failed to load store configuration." });
  }
});

// ==========================================
// 2. UPDATE STORE SETTINGS (Admin Only)
// ==========================================
router.put('/', async (req, res) => {
  try {
    const { footerAbout, socialLinks, shopLinks, supportLinks } = req.body;

    // Pehle settings document dhoodo, nahi mile toh naya banao
    let settings = await Setting.findOne();

    if (settings) {
      // Existing data ko update karo
      settings.footerAbout = footerAbout || settings.footerAbout;
      settings.socialLinks = socialLinks || settings.socialLinks;
      settings.shopLinks = shopLinks || settings.shopLinks;
      settings.supportLinks = supportLinks || settings.supportLinks;
      await settings.save();
    } else {
      // Naya create karo agar nahi milta
      settings = new Setting({ footerAbout, socialLinks, shopLinks, supportLinks });
      await settings.save();
    }

    res.json({ message: "Store configuration updated successfully!", settings });
  } catch (error) {
    console.error("Update Settings Error:", error);
    res.status(500).json({ error: "Failed to update store configuration." });
  }
});

module.exports = router;