const mongoose = require('mongoose');

// 🔥 PRO FEATURE 1: Address Sub-Schema (Strictly Typed & Required)
const addressSchema = new mongoose.Schema({
  flat: { type: String, required: [true, "Flat/House info is required"], trim: true, maxlength: 100 },
  street: { type: String, required: [true, "Street info is required"], trim: true, maxlength: 150 },
  landmark: { type: String, trim: true, maxlength: 100 },
  city: { type: String, required: [true, "City is required"], trim: true, maxlength: 50 },
  state: { type: String, required: [true, "State is required"], trim: true, maxlength: 50 },
  pincode: { type: String, required: [true, "Pincode is required"], match: [/^\d{6}$/, "Invalid pincode format"], trim: true },
  primaryPhone: { type: String, required: [true, "Primary phone is required"], match: [/^\d{10}$/, "Invalid mobile number format"], trim: true },
  secondaryPhone: { type: String, match: [/^\d{10}$/, "Invalid mobile number format"], trim: true, default: '' },
  email: { type: String, lowercase: true, trim: true }, 
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Full name is required"],
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"]
  },
  email: { 
    type: String, 
    required: [true, "Email address is required"], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    index: true
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\d{10}$/, "Invalid mobile number format"]
  },
  password: { 
    type: String, 
    // Password is NOT required if user logs in via Google
    select: false // 🔥 Security: Database query karne par password default hide rahega
  }, 
  googleId: {
    type: String, // Google Auth ke liye zaroori
    index: true
  },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'catalog', 'support', 'customer'], 
    default: 'customer',
    index: true
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
  resetPasswordToken: { type: String, index: true },
  resetPasswordExpire: Date,
  isLocked: { type: Boolean, default: false, index: true },
  securityCode: { type: String, default: "" },
  
  isActive: {
    type: Boolean,
    default: true // Agar account delete/deactivate karna ho toh ise false kar denge
  }
  
}, { 
  // 🔥 PRO FEATURE 5: Auto Timestamps 🔥
  timestamps: true,
  strict: true // Automatically strips out any unallowed fields passed in req.body
});

// YAHAN CHANGE KIYA HAI 🔥 - Ab error nahi aayega!
module.exports = mongoose.models.User || mongoose.model('User', userSchema);