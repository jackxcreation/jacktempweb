const mongoose = require('mongoose');

// ==========================================
// 1. PRODUCT SCHEMA (🔥 FLIPKART-SCALE COMPOUND INDEXED)
// ==========================================
const productSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Product title is required'], trim: true, maxlength: 200, index: true }, 
  
  // 🔥 ROOT CAUSE FIX: Changed price and mrp from String to strictly Number
  price: { type: Number, default: 0 }, 
  mrp: { type: Number, default: 0 }, 
  
  // Integer paise fields and numeric inventory for strict validation & sorting
  pricePaise: { type: Number, required: [true, 'Price in paise is required'], min: 0, default: 0, index: true }, 
  mrpPaise: { type: Number, required: [true, 'MRP in paise is required'], min: 0, default: 0 }, 
  inventory: { type: Number, required: [true, 'Inventory is required'], default: 0, min: 0 },

  category: { type: String, required: [true, 'Category is required'], trim: true, index: true }, 
  
  // 🔥 AI & RECOMMENDATION FIELDS 🔥
  tags: [{ type: String, trim: true, lowercase: true }], 
  views: { type: Number, default: 0, index: true },       
  sales: { type: Number, default: 0, index: true },       
  isTrending: { type: Boolean, default: false },         
  trendingScore: { type: Number, default: 0, index: true }, 
  conversion: { type: Number, default: 0, index: true }, 
  
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
  strict: true 
});

// ==========================================
// 🔥 BULLETPROOF DATA CONVERSION HOOKS (Saves you from String/Number crashes)
// ==========================================
// 1. Convert before creating a new product
productSchema.pre('save', function (next) {
  if (this.price !== undefined) this.price = Number(this.price) || 0;
  if (this.mrp !== undefined) this.mrp = Number(this.mrp) || 0;
  if (this.inventory !== undefined) this.inventory = Number(this.inventory) || 0;

  // Auto-calculate paise if not provided by admin panel
  if (this.price && !this.pricePaise) this.pricePaise = Math.round(this.price * 100);
  if (this.mrp && !this.mrpPaise) this.mrpPaise = Math.round(this.mrp * 100);

  next();
});

// 2. Convert before updating an existing product via Admin panel
productSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.$set) {
    if (update.$set.price !== undefined) update.$set.price = Number(update.$set.price) || 0;
    if (update.$set.mrp !== undefined) update.$set.mrp = Number(update.$set.mrp) || 0;
    if (update.$set.inventory !== undefined) update.$set.inventory = Number(update.$set.inventory) || 0;

    if (update.$set.price !== undefined && update.$set.pricePaise === undefined) {
      update.$set.pricePaise = Math.round(update.$set.price * 100);
    }
    if (update.$set.mrp !== undefined && update.$set.mrpPaise === undefined) {
      update.$set.mrpPaise = Math.round(update.$set.mrp * 100);
    }
  }
  next();
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
// 2. USER SCHEMA
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
  totalAmount: String, 
  
  totalPaise: { type: Number, default: 0 },

  status: { 
    type: String, 
    enum: [
      'Pending', 'Paid', 'Processing', 'Shipped', 'OutForDelivery', 
      'Delivered', 'ReturnRequested', 'ReturnApproved', 'Returned', 
      'Refunded', 'Cancelled'
    ], 
    default: "Pending", 
    index: true 
  },
  
  trackingId: { type: String, unique: true, sparse: true, index: true },
  courierPartner: { type: String, default: 'Delhivery Express' },
  estimatedDelivery: { type: Date, default: null },

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
// 8. ABANDONED CART SCHEMA
// ==========================================
const abandonedCartSchema = new mongoose.Schema({
  user: { userId: String, name: String, email: String, phone: String },
  items: Array, 
  totalValue: Number, 
  
  abandonedEmailSentAt: { type: Date, default: null },
  campaignId: { type: String, default: 'cart_recovery_v1' },
  attemptCount: { type: Number, default: 0 },
  lastAttemptAt: { type: Date, default: null },
  
  adminNote: { type: String, default: "" }, 
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
// 10. PRICE ALERT SCHEMA
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
// 11. STOCK ALERT SCHEMA
// ==========================================
const stockAlertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  email: { type: String, required: true },
  isNotified: { type: Boolean, default: false }
}, { timestamps: true });
stockAlertSchema.index({ user: 1, product: 1 }, { unique: true });

// ==========================================
// 🔥 EXPORT ALL MODELS
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