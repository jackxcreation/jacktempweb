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
    // 🔥 Leverage the singleton static method defined in Setting model
    let settings = await Setting.getSettings();

    // Agar shopLinks ya supportLinks khali hain, toh default values assign kar do
    let needsSave = false;
    if (!settings.shopLinks || settings.shopLinks.length === 0) {
      settings.shopLinks = [
        { title: "Electronics", url: "/shop/electronics" },
        { title: "Men's Fashion", url: "/shop/fashion" },
        { title: "Super Offers 🔥", url: "/shop" }
      ];
      needsSave = true;
    }

    if (!settings.supportLinks || settings.supportLinks.length === 0) {
      settings.supportLinks = [
        { title: "Track Your Order", url: "/track-order" },
        { title: "Returns & Exchanges", url: "/returns" },
        { title: "Contact Us", url: "/contact" }
      ];
      needsSave = true;
    }

    if (needsSave) {
      await settings.save();
    }

    return res.json(settings.toObject ? settings.toObject() : settings);
  } catch (error) {
    console.error("Fetch Settings Error:", error);
    return res.status(500).json({ error: "Failed to load store configuration." });
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

    return res.json({ message: "Store configuration updated successfully!", settings });
  } catch (error) {
    console.error("Update Settings Error:", error);
    return res.status(500).json({ error: "Failed to update store configuration." });
  }
});

module.exports = router;