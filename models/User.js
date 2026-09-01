const mongoose = require('mongoose');

// ==========================================
// 🔥 SECURITY SUB-SCHEMAS FOR ENTERPRISE SECURITY CENTER
// ==========================================
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  ipAddress: { type: String, default: 'Unknown' },
  device: { type: String, default: 'Unknown Device' },
  loginAt: { type: Date, default: Date.now }
});

const loginHistorySchema = new mongoose.Schema({
  ipAddress: { type: String, default: 'Unknown' },
  device: { type: String, default: 'Unknown Device' },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
  timestamp: { type: Date, default: Date.now }
});

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, default: '' },
  ip: { type: String, default: 'Unknown' },
  timestamp: { type: Date, default: Date.now }
});

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
    select: false // 🔥 Security: Database query karne par password default hide rahega
  }, 
  googleId: {
    type: String, 
    index: true
  },
  role: { 
    type: String, 
    enum: [
      'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
      'warehouse_manager', 'customer_support', 'finance_manager', 
      'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
      'manager', 'catalog', 'support', 'customer'
    ], 
    default: 'customer',
    index: true
  },
  
  // 🔥 ENTERPRISE SECURITY CENTER FIELDS 🔥
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false },
  activeSessions: [sessionSchema],
  loginHistory: [loginHistorySchema],
  auditLogs: [auditLogSchema],
  failedLoginAttempts: { type: Number, default: 0 },

  // 🔥 PRO FEATURE 2: Store Customer's Addresses 🔥
  addresses: [addressSchema], 

  // 🔥 PRO FEATURE 3: E-commerce Core Features 🔥
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product' 
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
    default: true 
  }
  
}, { 
  // 🔥 PRO FEATURE 5: Auto Timestamps 🔥
  timestamps: true,
  strict: true 
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);