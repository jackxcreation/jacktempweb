const mongoose = require('mongoose');

// ==========================================
// 1. PRODUCT SCHEMA
// ==========================================
const productSchema = new mongoose.Schema({
  title: String, price: String, mrp: String, category: { type: String, index: true }, 
  
  // 🔥 AI & RECOMMENDATION FIELDS (NEW) 🔥
  tags: [{ type: String, trim: true, lowercase: true }], // Tags like ["laptop", "gaming"] for Similar Products
  views: { type: Number, default: 0, index: true },      // View tracking for Trending Badge
  sales: { type: Number, default: 0, index: true },      // Sales tracking
  isTrending: { type: Boolean, default: false },         // Manual override or automated badge
  
  image: String, images: [String], brand: String, description: String, 
  weight: String, size: String, sku: String, inventory: String, 
  color: String, material: String, manufacturerName: String,
  
  // 🔥 FIX: String type with default null and indexed for superfast filtering
  warehouseId: { type: String, default: null, index: true }, 
  
  rating: { type: Number, default: 4.5 }, reviews: { type: Number, default: 120 },
  discount: String, createdAt: { type: Date, default: Date.now, index: true }
});

// ==========================================
// 2. USER SCHEMA (TERA ADVANCED PRO SCHEMA + SECURITY)
// ==========================================
const addressSchema = new mongoose.Schema({
  flat: { type: String, required: true },
  street: { type: String, required: true },
  landmark: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  primaryPhone: { type: String, required: true },
  secondaryPhone: { type: String },
  email: { type: String }, 
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Full name is required"], trim: true },
  email: { type: String, required: [true, "Email address is required"], unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true, },
  password: { type: String, select: false }, 
  googleId: { type: String, },
  role: { type: String, enum: ['admin', 'manager', 'catalog', 'support', 'customer'], default: 'customer' },
  addresses: [addressSchema], 
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  isActive: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false },
  securityCode: { type: String, default: "" }
}, { timestamps: true });

// ==========================================
// 3. ORDER SCHEMA
// ==========================================
const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  items: Array, totalAmount: String, status: { type: String, default: "Processing", index: true },
  date: { type: String, default: () => new Date().toLocaleDateString('en-IN') },
  time: { type: String, default: () => new Date().toLocaleTimeString('en-IN') }, 
  createdAt: { type: Date, default: Date.now, index: true },
  shiprocketOrderId: { type: String, default: "" }, paymentMethod: { type: String, default: "" },
  address: { type: Object, default: {} }, userDetails: { type: Object, default: {} },
  adminNotes: { type: String, default: "" }, refundStatus: { type: String, default: "N/A" },
  deviceInfo: { type: String, default: "Web Browser" },
  trafficSource: { type: Object, default: { source: 'Direct/Unknown', medium: 'organic', campaign: 'none' } }
});

// ==========================================
// 4. SETTING SCHEMA
// ==========================================
const settingSchema = new mongoose.Schema({
  footerAbout: { type: String, default: "Upgrade your lifestyle with our premium collection of electronics, fashion, and daily essentials." },
  socialLinks: { instagram: { type: String, default: "#" }, twitter: { type: String, default: "#" }, facebook: { type: String, default: "#" }, youtube: { type: String, default: "#" } },
  shopLinks: { type: Array, default: [{ title: "Electronics", url: "/shop/electronics" }, { title: "Men's Fashion", url: "/shop/fashion" }, { title: "Super Offers 🔥", url: "/shop" }]},
  supportLinks: { type: Array, default: [{ title: "Track Your Order", url: "/track-order" }, { title: "Returns & Exchanges", url: "/returns" }, { title: "Contact Us", url: "/contact" }]},
});

// ==========================================
// 5. SUBSCRIBER SCHEMA
// ==========================================
const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  subscribedAt: { type: Date, default: Date.now }
});

// ==========================================
// 6. EMAIL TEMPLATE SCHEMA
// ==========================================
const emailTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true }, subject: { type: String, required: true },
  bannerImage: { type: String, default: "" }, messageBody: { type: String, required: true },
  buttonText: { type: String, default: "" }, buttonLink: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 7. TICKET SCHEMA
// ==========================================
const ticketSchema = new mongoose.Schema({
  userId: { type: String, index: true }, userName: String, orderId: String,
  status: { type: String, default: "open", index: true }, 
  messages: [{ sender: String, text: String, timestamp: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now, index: true }
});

// ==========================================
// 8. ABANDONED CART SCHEMA
// ==========================================
const abandonedCartSchema = new mongoose.Schema({
  user: { userId: String, name: String, email: String, phone: String },
  items: Array, totalValue: Number, adminNote: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now, index: true }
});

// ==========================================
// 🔥 9. WAREHOUSE SCHEMA (NEW) 🔥
// ==========================================
const warehouseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  managerName: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  landmark: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// ==========================================
// 🔥 EXPORT ALL MODELS (SAFE OVERWRITE FIX) 🔥
// ==========================================
module.exports = {
  Product: mongoose.models.Product || mongoose.model('Product', productSchema),
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Order: mongoose.models.Order || mongoose.model('Order', orderSchema),
  Setting: mongoose.models.Setting || mongoose.model('Setting', settingSchema),
  Subscriber: mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema),
  EmailTemplate: mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', emailTemplateSchema),
  Ticket: mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema),
  AbandonedCart: mongoose.models.AbandonedCart || mongoose.model('AbandonedCart', abandonedCartSchema),
  Warehouse: mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema)    
};