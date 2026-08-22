const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  subscribedAt: { type: Date, default: Date.now }
});

// YAHAN CHANGE KIYA HAI 🔥 - Subscriber model ko overwrite hone se bachane ke liye
module.exports = mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema);