// models/Subscriber.js
const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, "Email address is required"], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    index: true 
  },
  // 🔥 Pro Feature: Active status and source tracking for newsletter campaigns
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  source: {
    type: String,
    default: 'footer',
    trim: true
  },
  unsubscribeToken: {
    type: String
  },
  subscribedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true,
  strict: true // Automatically strips out any unallowed fields passed in req.body
});

// ==========================================
// 🔥 PRO FEATURE: HELPER STATIC METHODS
// ==========================================
subscriberSchema.statics.isSubscribed = async function(email) {
  const sub = await this.findOne({ email: email.toLowerCase().trim(), isActive: true });
  return !!sub;
};

// Subscriber model ko overwrite hone se bachane ke liye safe export
const Subscriber = mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema);

module.exports = Subscriber;