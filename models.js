const mongoose = require('mongoose');

// ==========================================
// 1. PRODUCT SCHEMA (🔥 FLIPKART-SCALE COMPOUND INDEXED)
// ==========================================
const productSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Product title is required'], trim: true, maxlength: 200, index: true }, 
  price: String, // Kept for legacy display compatibility if needed
  mrp: String,   // Kept for legacy display compatibility if needed
  
  // 🔥 AUDIT FIX: Integer paise fields and numeric inventory for strict validation & sorting
  pricePaise: { type: Number, required: [true, 'Price in paise is required'], min: 0, default: 0, index: true }, 
  mrpPaise: { type: Number, required: [true, 'MRP in paise is required'], min: 0, default: 0 }, 
  inventory: { type: Number, required: [true, 'Inventory is required'], default: 0, min: 0 },

  category: { type: String, required: [true, 'Category is required'], trim: true, index: true }, 
  
  // 🔥 AI & RECOMMENDATION FIELDS 🔥
  tags: [{ type: String, trim: true, lowercase: true }], 
  views: { type: Number, default: 0, index: true },       
  sales: { type: Number, default: 0, index: true },       
  isTrending: { type: Boolean, default: false },         
  
  image: { type: String, required: [true, 'Main product image is required'], trim: true }, 
  images: { type: [String], default: [] }, 
  brand: { type: String, required: [true, 'Brand is required'], trim: true, maxlength: 100, index: true }, 
  description: { type: String, trim: true, maxlength: 2000, default: '' }, 
  weight: { type: String, trim: true }, 
  size: { type: String, trim: true }, 
  sku: { type: String, required: [true, 'SKU is required'], unique: true, trim: true, uppercase: true, index: true }, 
  color: { type: String, trim: true }, 
  material: { type: String, trim: true }, 
  manufacturerName: { type: String, trim: true },
  
  warehouseId: { type: String, default: null, index: true }, 
  
  rating: { type: Number, min: 0, max: 5, default: 4.8 }, 
  reviews: { type: Number, min: 0, default: 120 },
  discount: { type: String, trim: true }, 
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  strict: true // Automatically strip out any unallowed fields passed in req.body
});

// ==========================================
// 🔥 E-COMMERCE QUERY-PATTERN COMPOUND INDEXES (ESR RULE)
// ==========================================
productSchema.index({ category: 1, pricePaise: 1 });
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ brand: 1, pricePaise: 1 });
productSchema.index({ warehouseId: 1, inventory: 1 });
productSchema.index({ category: 1, views: -1 });
productSchema.index({ title: 'text', description: 'text' });

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
  phone: { type: String, trim: true },
  password: { type: String, select: false }, 
  googleId: { type: String },
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
  items: Array, 
  totalAmount: String, // Kept for backward compatibility
  
  // 🔥 AUDIT FIX: Integer paise total field for strict financial reconciliation
  totalPaise: { type: Number, default: 0 },

  status: { 
    type: String, 
    enum: ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'], 
    default: "Pending", 
    index: true 
  },
  date: { type: String, default: () => new Date().toLocaleDateString('en-IN') },
  time: { type: String, default: () => new Date().toLocaleTimeString('en-IN') }, 
  createdAt: { type: Date, default: Date.now, index: true },
  shiprocketOrderId: { type: String, default: "" }, 
  paymentMethod: { type: String, default: "" },
  paymentDetails: {
    gatewayOrderId: { type: String, default: "" },
    gatewayPaymentId: { type: String, default: "" },
    eventId: { type: String, default: "" }
  },
  address: { type: Object, default: {} }, 
  userDetails: { type: Object, default: {} },
  adminNotes: { type: String, default: "" }, 
  refundStatus: { type: String, default: "N/A" },
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
// 8. ABANDONED CART SCHEMA (🔥 ENTERPRISE SCALE UPGRADE)
// ==========================================
const abandonedCartSchema = new mongoose.Schema({
  user: { userId: String, name: String, email: String, phone: String },
  items: Array, 
  totalValue: Number, 
  
  // 🔥 ENTERPRISE STATE TRACKING FLAGS (Replaced adminNote hack)
  abandonedEmailSentAt: { type: Date, default: null },
  campaignId: { type: String, default: 'cart_recovery_v1' },
  attemptCount: { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: null },
  
  adminNote: { type: String, default: "" }, // Strictly for human staff notes
  updatedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

// ==========================================
// 9. WAREHOUSE SCHEMA
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
// 10. PRICE ALERT SCHEMA (🔥 PRICE-DROP ALERTS)
// ==========================================
const priceAlertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  targetPricePaise: { type: Number, required: true },
  initialPricePaise: { type: Number, required: true },
  isNotified: { type: Boolean, default: false }
}, { timestamps: true });
priceAlertSchema.index({ user: 1, product: 1 }, { unique: true });

// ==========================================
// 11. STOCK ALERT SCHEMA (🔥 BACK-IN-STOCK ALERTS)
// ==========================================
const stockAlertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  email: { type: String, required: true },
  isNotified: { type: Boolean, default: false }
}, { timestamps: true });
stockAlertSchema.index({ user: 1, product: 1 }, { unique: true });

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
  Warehouse: mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema),
  PriceAlert: mongoose.models.PriceAlert || mongoose.model('PriceAlert', priceAlertSchema),
  StockAlert: mongoose.models.StockAlert || mongoose.model('StockAlert', stockAlertSchema)
};