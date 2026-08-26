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
  subscribedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true,
  strict: true // Automatically strips out any unallowed fields passed in req.body
});

// Subscriber model ko overwrite hone se bachane ke liye safe export
module.exports = mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema);