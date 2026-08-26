const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  // Footer Left Section Text
  footerAbout: { 
    type: String, 
    trim: true,
    maxlength: [500, "Footer description cannot exceed 500 characters"],
    default: "Upgrade your lifestyle with our premium collection of electronics, fashion, and daily essentials. Designed for the modern Indian."
  },
  
  // Dynamic Social Media Links
  socialLinks: {
    instagram: { type: String, trim: true, default: "#" },
    twitter: { type: String, trim: true, default: "#" },
    facebook: { type: String, trim: true, default: "#" },
    youtube: { type: String, trim: true, default: "#" }
  },
  
  // Custom Links arrays (Jo tu dashboard se add/delete karega)
  shopLinks: [
    {
      title: { type: String, required: true, trim: true },
      url: { type: String, required: true, trim: true }
    }
  ],
  
  supportLinks: [
    {
      title: { type: String, required: true, trim: true },
      url: { type: String, required: true, trim: true }
    }
  ]
}, { 
  timestamps: true,
  strict: true // Automatically strips out any unallowed fields passed in req.body
});

// Setting model ko overwrite hone se bachane ke liye safe export
module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);