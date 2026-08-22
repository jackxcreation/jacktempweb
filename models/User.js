const mongoose = require('mongoose');

// 🔥 PRO FEATURE 1: Address Sub-Schema 🔥
// Ye same fields hain jo humne frontend Profile.jsx mein banaye the
const addressSchema = new mongoose.Schema({
  flat: { type: String, required: true },
  street: { type: String, required: true },
  landmark: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  primaryPhone: { type: String, required: true },
  secondaryPhone: { type: String },
  email: { type: String }, // Optional contact email for this address
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Full name is required"],
    trim: true
  },
  email: { 
    type: String, 
    required: [true, "Email address is required"], 
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    // Phone optional rakha hai kyunki Google Login mein phone direct nahi milta
  },
  password: { 
    type: String, 
    // Password is NOT required if user logs in via Google
    select: false // 🔥 Security: Database query karne par password default hide rahega
  }, 
  googleId: {
    type: String, // Google Auth ke liye zaroori
  },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'catalog', 'support', 'customer'], 
    default: 'customer' 
  },
  
  // 🔥 PRO FEATURE 2: Store Customer's Addresses 🔥
  addresses: [addressSchema], 

  // 🔥 PRO FEATURE 3: E-commerce Core Features 🔥
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product' // Link this to your Product Model
  }],
  recentlyViewed: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],

  // 🔥 PRO FEATURE 4: Security & Account Recovery 🔥
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  isActive: {
    type: Boolean,
    default: true // Agar account delete/deactivate karna ho toh ise false kar denge
  }
  
}, { 
  // 🔥 PRO FEATURE 5: Auto Timestamps 🔥
  // Ye apne aap 'createdAt' aur 'updatedAt' fields add aur update kar dega
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);