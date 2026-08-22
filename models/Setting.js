const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  // Footer Left Section Text
  footerAbout: { 
    type: String, 
    default: "Upgrade your lifestyle with our premium collection of electronics, fashion, and daily essentials. Designed for the modern Indian."
  },
  
  // Dynamic Social Media Links
  socialLinks: {
    instagram: { type: String, default: "#" },
    twitter: { type: String, default: "#" },
    facebook: { type: String, default: "#" },
    youtube: { type: String, default: "#" }
  },
  
  // Custom Links arrays (Jo tu dashboard se add/delete karega)
  shopLinks: [
    {
      title: { type: String, required: true },
      url: { type: String, required: true }
    }
  ],
  
  supportLinks: [
    {
      title: { type: String, required: true },
      url: { type: String, required: true }
    }
  ]
}, { 
  timestamps: true 
});

// YAHAN CHANGE KIYA HAI 🔥 - Setting model ko overwrite hone se bachane ke liye
module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);