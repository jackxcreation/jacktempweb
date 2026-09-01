// routes/settings.js
const express = require('express');
const router = express.Router();
const { Setting } = require('../models'); // 🔥 Unified model import

// 🚨 IMPORT AUTH & RBAC MIDDLEWARES
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 1. GET STORE SETTINGS (Public - For Footer & Storefront)
// ==========================================
router.get('/', async (req, res) => {
  try {
    let settings = await Setting.findOne().lean();

    // Agar database ekdum khali hai, toh default values se ek create kar do
    if (!settings) {
      const newSettings = new Setting({
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
      await newSettings.save();
      settings = newSettings.toObject();
    }

    res.json(settings);
  } catch (error) {
    console.error("Fetch Settings Error:", error);
    res.status(500).json({ error: "Failed to load store configuration." });
  }
});

// ==========================================
// 2. UPDATE STORE SETTINGS (Admin Only - RBAC Enforced)
// ==========================================
router.put('/', protect, checkPermission('settings:all'), async (req, res) => {
  try {
    const { footerAbout, socialLinks, shopLinks, supportLinks, storeShippingConfig } = req.body;

    // Pehle settings document dhoodo, nahi mile toh naya banao
    let settings = await Setting.findOne();

    if (settings) {
      // Existing data ko update karo
      settings.footerAbout = footerAbout !== undefined ? footerAbout : settings.footerAbout;
      settings.socialLinks = socialLinks || settings.socialLinks;
      settings.shopLinks = shopLinks || settings.shopLinks;
      settings.supportLinks = supportLinks || settings.supportLinks;

      // 🔥 NAYA: Dynamic Store & Shipping Configuration update handle karega
      if (storeShippingConfig) {
        settings.storeShippingConfig = {
          ...(settings.storeShippingConfig?.toObject ? settings.storeShippingConfig.toObject() : settings.storeShippingConfig || {}),
          ...storeShippingConfig
        };
      }

      await settings.save();
    } else {
      // Naya create karo agar nahi milta
      settings = new Setting({ 
        footerAbout, 
        socialLinks, 
        shopLinks, 
        supportLinks,
        storeShippingConfig: storeShippingConfig || {} 
      });
      await settings.save();
    }

    res.json({ message: "Store configuration updated successfully!", settings });
  } catch (error) {
    console.error("Update Settings Error:", error);
    res.status(500).json({ error: "Failed to update store configuration." });
  }
});

module.exports = router;