// models/User.js
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
  // ==========================================
  // 👤 1. IDENTITY & CONTACT
  // ==========================================
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
    match: [/^\d{10}$/, "Invalid mobile number format"],
    index: true
  },

  // ==========================================
  // 🛡️ 2. VERIFICATION
  // ==========================================
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String, 
    index: true
  },

  // ==========================================
  // 🔑 3. PASSWORD & SECURITY
  // ==========================================
  password: { 
    type: String, 
    select: false // 🔥 Security: Database query karne par password default hide rahega
  }, 
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false },

  // ==========================================
  // 🏷️ 4. ROLES
  // ==========================================
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

  // ==========================================
  // 🌐 5. SESSIONS
  // ==========================================
  activeSessions: [sessionSchema],
  loginHistory: [loginHistorySchema],

  // ==========================================
  // 📊 6. AUDIT & TRACKING
  // ==========================================
  auditLogs: [auditLogSchema],
  failedLoginAttempts: { type: Number, default: 0 },

  // ==========================================
  // 🏠 7. ADDRESSES
  // ==========================================
  addresses: [addressSchema], 

  // ==========================================
  // ⭐ 8. WISHLIST & RECENTLY VIEWED (E-COMMERCE)
  // ==========================================
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product' 
  }],
  recentlyViewed: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],

  // ==========================================
  // 🔓 9. RECOVERY & ACCOUNT LOCK
  // ==========================================
  resetPasswordToken: { type: String, index: true },
  resetPasswordExpire: Date,
  resetOTP: { type: String, select: false },
  resetOTPExpires: Date,
  isLocked: { type: Boolean, default: false, index: true },
  securityCode: { type: String, default: "" },

  // ==========================================
  // ⚡ 10. STATUS
  // ==========================================
  isActive: {
    type: Boolean,
    default: true 
  }
  
}, { 
  // ==========================================
  // 🕒 11. TIMESTAMPS
  // ==========================================
  timestamps: true,
  strict: true 
});

// ==========================================
// 🔥 PRO FEATURE: PRE-SAVE NORMALIZATION & DATA MINIMIZATION
// ==========================================
userSchema.pre('save', function(next) {
  if (this.isModified('email') && this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  if (this.isModified('phone') && this.phone) {
    this.phone = this.phone.replace(/^\+91/, '').trim();
  }

  // Data Minimization: Prevent unbounded growth of login and audit history logs
  if (this.loginHistory && this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(-10);
  }
  if (this.auditLogs && this.auditLogs.length > 20) {
    this.auditLogs = this.auditLogs.slice(-20);
  }

  next();
});

// ==========================================
// 🔥 PRO FEATURE: HELPER STATIC METHODS
// ==========================================
userSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() }).select('+password');
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;