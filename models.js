const mongoose = require('mongoose');

// ==========================================
// 🔥 MULTI-STATE INVENTORY SUB-SCHEMA
// ==========================================
const inventoryStateSchema = new mongoose.Schema({
  available: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  packed: { type: Number, default: 0, min: 0 },
  inTransit: { type: Number, default: 0, min: 0 },
  damaged: { type: Number, default: 0, min: 0 },
  returned: { type: Number, default: 0, min: 0 },
  qcPending: { type: Number, default: 0, min: 0 },
  sellable: { type: Number, default: 0, min: 0 }
}, { _id: false });

// ==========================================
// 🔥 STOCK MOVEMENT LEDGER SUB-SCHEMA (IMMUTABLE AUDIT TRAIL)
// ==========================================
const stockLedgerSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['IN', 'OUT', 'RESERVED', 'RELEASED', 'TRANSFER', 'RETURN', 'DAMAGE', 'ADJUSTMENT'], 
    required: true 
  },
  quantity: { type: Number, required: true },
  previousAvailable: { type: Number, required: true },
  newAvailable: { type: Number, required: true },
  source: { 
    type: String, 
    enum: ['Order', 'Return', 'Manual Adjustment', 'Warehouse Transfer', 'Purchase'], 
    required: true 
  },
  referenceId: { type: String, default: '' }, // Order ID or Transfer ID
  reason: { type: String, default: '' },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  timestamp: { type: Date, default: Date.now }
});

// ==========================================
// 🔥 PER-WAREHOUSE INVENTORY MAPPING SUB-SCHEMA
// ==========================================
const warehouseInventorySchema = new mongoose.Schema({
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  inventory: { type: Number, default: 0, min: 0 },
  inventoryState: { type: inventoryStateSchema, default: () => ({ available: 0, sellable: 0 }) }
}, { _id: false });

// ==========================================
// 1. PRODUCT SCHEMA (🔥 MULTI-WAREHOUSE & MULTI-STATE INVENTORY + INTELLIGENCE HEALTH SCORE)
// ==========================================
const productSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Product title is required'], trim: true, maxlength: 200, index: true }, 
  
  price: { type: Number, default: 0 }, 
  mrp: { type: Number, default: 0 }, 
  cogs: { type: Number, default: 0 }, // Cost of Goods Sold (Purchase Price)
  
  pricePaise: { type: Number, required: [true, 'Price in paise is required'], min: 0, default: 0, index: true }, 
  mrpPaise: { type: Number, required: [true, 'MRP in paise is required'], min: 0, default: 0 }, 
  cogsPaise: { type: Number, default: 0 }, 
  
  // Legacy global inventory field kept for complete backward compatibility
  inventory: { type: Number, required: [true, 'Inventory is required'], default: 0, min: 0 },

  // 🔥 MULTI-STATE INVENTORY & LEDGER 🔥
  inventoryState: { type: inventoryStateSchema, default: () => ({ available: 0, sellable: 0 }) },
  warehouseInventories: [warehouseInventorySchema], 
  stockLedger: [stockLedgerSchema],

  category: { type: String, required: [true, 'Category is required'], trim: true, index: true }, 

  subCategory: { type: String, trim: true, default: '' },
  listingStatus: { type: String, enum: ['Active', 'Inactive', 'Draft'], default: 'Draft', index: true },
  minimumOrderQty: { type: Number, default: 1, min: 1 },
  
  shippingProvider: { type: String, trim: true, default: 'Auto Select' },
  handlingLocal: { type: Number, default: 0 },
  handlingZonal: { type: Number, default: 0 },
  handlingNational: { type: Number, default: 0 },
  
  length: { type: Number, default: 0 },
  breadth: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  
  hsnCode: { type: String, trim: true, default: '' },
  tax: { type: Number, default: 0 },
  countryOfOrigin: { type: String, trim: true, default: 'India' },
  
  manufactureDetails: { type: String, trim: true, default: '' },
  packerDetails: { type: String, trim: true, default: '' },
  importDetails: { type: String, trim: true, default: '' },
  eanUpc: { type: String, trim: true, default: '' },
  
  searchKeywords: { type: String, trim: true, default: '' },
  packOf: { type: Number, default: 1 },
  variant: { type: String, trim: true, default: '' },
  
  modelNo: { type: String, trim: true, default: '' },
  itemsIncluded: { type: String, trim: true, default: '' },
  noOfTools: { type: String, trim: true, default: '' },
  toolFeatures: { type: String, trim: true, default: '' },
  powerConsumption: { type: String, trim: true, default: '' },
  otherPowerFeatures: { type: String, trim: true, default: '' },
  
  domesticWarranty: { type: String, trim: true, default: '' },
  internationalWarranty: { type: String, trim: true, default: '' },
  warrantySummary: { type: String, trim: true, default: '' },
  warrantyServiceType: { type: String, trim: true, default: '' },
  coveredInWarranty: { type: String, trim: true, default: '' },
  notCoveredInWarranty: { type: String, trim: true, default: '' },
  
  tags: [{ type: String, trim: true, lowercase: true }], 
  views: { type: Number, default: 0, index: true },          
  sales: { type: Number, default: 0, index: true },          
  isTrending: { type: Boolean, default: false },         
  trendingScore: { type: Number, default: 0, index: true }, 
  conversion: { type: Number, default: 0, index: true }, 

  // 🔥 PRODUCT INTELLIGENCE METRICS (NEW)
  addToCartCount: { type: Number, default: 0 },
  checkoutCount: { type: Number, default: 0 },
  totalRevenuePaise: { type: Number, default: 0 },
  returnCount: { type: Number, default: 0 },
  rtoCount: { type: Number, default: 0 },
  profitPaise: { type: Number, default: 0 },
  
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
  
  rating: { type: Number, min: 0, max: 5, default: 0 }, 
  reviews: { type: Number, min: 0, default: 0 },
  discount: { type: String, trim: true }, 
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  strict: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// 🔥 PRODUCT HEALTH SCORE VIRTUAL PROPERTY (0 - 100)
// ==========================================
productSchema.virtual('healthScore').get(function() {
  let score = 70; // Base score

  // 1. Conversion bonus/penalty (Healthy conversion is > 2%)
  if (this.conversion > 3) score += 15;
  else if (this.conversion < 1) score -= 15;

  // 2. Return & RTO penalty (High returns drop health drastically)
  const totalOrders = (this.sales || 0) + (this.returnCount || 0) + (this.rtoCount || 0);
  if (totalOrders > 0) {
    const returnRate = (this.returnCount / totalOrders) * 100;
    const rtoRate = (this.rtoCount / totalOrders) * 100;

    if (returnRate > 10) score -= 15;
    if (rtoRate > 15) score -= 20;
  }

  // 3. Stock availability bonus
  if (this.inventory > 5) score += 10;
  else if (this.inventory === 0) score -= 30; // Out of stock heavy penalty

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
});

// ==========================================
// 🔥 BULLETPROOF DATA CONVERSION HOOKS (FIXED SYNCHRONOUS HOOKS)
// ==========================================
productSchema.pre('save', function () {
  if (this.price !== undefined) this.price = Number(this.price) || 0;
  if (this.mrp !== undefined) this.mrp = Number(this.mrp) || 0;
  if (this.cogs !== undefined) this.cogs = Number(this.cogs) || 0; 
  if (this.inventory !== undefined) this.inventory = Number(this.inventory) || 0;
  
  if (this.inventoryState) {
    if (this.inventoryState.available === undefined || this.inventoryState.available === 0) {
      this.inventoryState.available = this.inventory;
    }
    if (this.inventoryState.sellable === undefined || this.inventoryState.sellable === 0) {
      this.inventoryState.sellable = this.inventory;
    }
  }

  if (this.tax !== undefined) this.tax = Number(this.tax) || 0;
  if (this.minimumOrderQty !== undefined) this.minimumOrderQty = Number(this.minimumOrderQty) || 1;
  if (this.packOf !== undefined) this.packOf = Number(this.packOf) || 1;
  if (this.length !== undefined) this.length = Number(this.length) || 0;
  if (this.breadth !== undefined) this.breadth = Number(this.breadth) || 0;
  if (this.height !== undefined) this.height = Number(this.height) || 0;

  if (this.price && !this.pricePaise) this.pricePaise = Math.round(this.price * 100);
  if (this.mrp && !this.mrpPaise) this.mrpPaise = Math.round(this.mrp * 100);
  if (this.cogs && !this.cogsPaise) this.cogsPaise = Math.round(this.cogs * 100); 
});

productSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update && update.$set) {
    if (update.$set.price !== undefined) update.$set.price = Number(update.$set.price) || 0;
    if (update.$set.mrp !== undefined) update.$set.mrp = Number(update.$set.mrp) || 0;
    if (update.$set.cogs !== undefined) update.$set.cogs = Number(update.$set.cogs) || 0; 
    if (update.$set.inventory !== undefined) {
      update.$set.inventory = Number(update.$set.inventory) || 0;
      update.$set['inventoryState.available'] = update.$set.inventory;
      update.$set['inventoryState.sellable'] = update.$set.inventory;
    }
    if (update.$set.tax !== undefined) update.$set.tax = Number(update.$set.tax) || 0;
    if (update.$set.minimumOrderQty !== undefined) update.$set.minimumOrderQty = Number(update.$set.minimumOrderQty) || 1;
    if (update.$set.packOf !== undefined) update.$set.packOf = Number(update.$set.packOf) || 1;
    if (update.$set.length !== undefined) update.$set.length = Number(update.$set.length) || 0;
    if (update.$set.breadth !== undefined) update.$set.breadth = Number(update.$set.breadth) || 0;
    if (update.$set.height !== undefined) update.$set.height = Number(update.$set.height) || 0;

    if (update.$set.price !== undefined && update.$set.pricePaise === undefined) {
      update.$set.pricePaise = Math.round(update.$set.price * 100);
    }
    if (update.$set.mrp !== undefined && update.$set.mrpPaise === undefined) {
      update.$set.mrpPaise = Math.round(update.$set.mrp * 100);
    }
    if (update.$set.cogs !== undefined && update.$set.cogsPaise === undefined) {
      update.$set.cogsPaise = Math.round(update.$set.cogs * 100); 
    }
  }
});

// ==========================================
// 🔥 E-COMMERCE QUERY-PATTERN COMPOUND INDEXES (ESR RULE & INVENTORY IMPROVEMENTS)
// ==========================================
productSchema.index({ category: 1, pricePaise: 1 });
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ brand: 1, pricePaise: 1 });
productSchema.index({ warehouseId: 1, inventory: 1 });
productSchema.index({ category: 1, views: -1 });
productSchema.index({ title: 'text', description: 'text', searchKeywords: 'text' }); 
// 🔥 Inventory Improvements Index
productSchema.index({ 'warehouseInventories.warehouse': 1, 'warehouseInventories.inventoryState.available': 1 });
productSchema.index({ sku: 1 });

// ==========================================
// 2. USER SCHEMA (CUSTOMER INDEX IMPROVEMENTS)
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
  securityCode: { type: String, default: "" },
  auditLogs: [{
    action: String,
    details: String,
    ip: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// 🔥 Customer Index Improvements
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ createdAt: -1 });

// ==========================================
// 3. ORDER SCHEMA (🔥 ENTERPRISE SHIPMENT STRUCTURE & OPTIMIZED INDEXES)
// ==========================================
const shipmentSchema = new mongoose.Schema({
  provider: { type: String, enum: ['delhivery', 'shiprocket', 'none'], default: 'none' },
  awb: { type: String, default: '' },
  providerOrderId: { type: String, default: '' },
  labelUrl: { type: String, default: '' },
  manifestId: { type: String, default: '' },
  trackingStatus: { type: String, default: 'Pending' },
  lastSyncedAt: { type: Date, default: null },
  pickupScheduledAt: { type: Date, default: null },
  cancellationStatus: { type: Boolean, default: false }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  items: Array, 
  totalAmount: String, 
  totalPaise: { type: Number, default: 0 },

  // 🔥 CORE FINANCIAL LEDGER (Frozen at time of order for accurate P&L)
  cogsPaise: { type: Number, default: 0 }, 
  shippingCostPaise: { type: Number, default: 0 }, 
  paymentFeePaise: { type: Number, default: 0 }, 
  codFeePaise: { type: Number, default: 0 }, 
  taxAmountPaise: { type: Number, default: 0 }, 
  refundAmountPaise: { type: Number, default: 0 }, 
  discountPaise: { type: Number, default: 0 }, 
  rtoCostPaise: { type: Number, default: 0 },
  contributionPaise: { type: Number, default: 0 }, 

  status: { 
    type: String, 
    enum: [
      'Pending Review', 'Pending', 'Paid', 'Processing', 'Packed', 
      'Shipped', 'OutForDelivery', 'Delivered', 'Cancelled', 
      'Refunded', 'ReturnRequested', 'ReturnApproved', 'Returned', 'RTO'
    ], 
    default: "Pending", 
    index: true 
  },
  
  fulfilledFromWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null }, 
  trackingId: { type: String, unique: true, sparse: true, index: true },
  courierPartner: { type: String, default: 'Delhivery Express' },
  estimatedDelivery: { type: Date, default: null },

  date: { type: String, default: () => new Date().toLocaleDateString('en-IN') },
  time: { type: String, default: () => new Date().toLocaleTimeString('en-IN') }, 
  createdAt: { type: Date, default: Date.now, index: true },
  
  shipment: { type: shipmentSchema, default: () => ({}) },
  
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

orderSchema.virtual('shiprocketOrderId').get(function() {
  return this.shipment?.awb || '';
});

// 🔥 Orders Compound Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, createdAt: -1 });
orderSchema.index({ fulfilledFromWarehouse: 1, status: 1 });
orderSchema.index({ 'shipment.awb': 1 });

// ==========================================
// 🔥 3.1 ENTERPRISE PAYMENT ARCHITECTURE MODELS (NEW)
// ==========================================
const paymentIntentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  gatewayOrderId: { type: String, required: true, unique: true, index: true },
  amountPaise: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['CREATED', 'ATTEMPTED', 'PAID', 'FAILED', 'EXPIRED'], 
    default: 'CREATED',
    index: true 
  },
  paymentGateway: { type: String, default: 'razorpay' },
  metadata: { type: Object, default: {} }
}, { timestamps: true });

const paymentAttemptSchema = new mongoose.Schema({
  paymentIntentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentIntent', required: true, index: true },
  gatewayPaymentId: { type: String, default: '', index: true },
  gatewaySignature: { type: String, default: '' },
  status: { type: String, enum: ['SUCCESS', 'FAILURE', 'PENDING'], default: 'PENDING', index: true },
  errorCode: { type: String, default: '' },
  errorDescription: { type: String, default: '' },
  rawResponse: { type: Object, default: {} }
}, { timestamps: true });

const refundSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  paymentIntentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentIntent', default: null },
  gatewayRefundId: { type: String, required: true, unique: true, index: true },
  amountPaise: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['PENDING', 'PROCESSED', 'FAILED'], default: 'PENDING', index: true },
  reason: { type: String, default: 'Requested by Admin' },
  speedRequested: { type: String, default: 'normal' }
}, { timestamps: true });

const settlementSchema = new mongoose.Schema({
  gatewaySettlementId: { type: String, required: true, unique: true, index: true },
  gatewayPaymentId: { type: String, required: true, index: true },
  amountPaise: { type: Number, required: true },
  feePaise: { type: Number, default: 0 },
  taxPaise: { type: Number, default: 0 },
  status: { type: String, default: 'SETTLED', index: true },
  settledAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ==========================================
// 4. SETTING SCHEMA
// ==========================================
const settingSchema = new mongoose.Schema({
  footerAbout: { type: String, default: "Upgrade your lifestyle with our premium collection of electronics, fashion, and daily essentials." },
  socialLinks: { 
    instagram: { type: String, default: "#" }, 
    twitter: { type: String, default: "#" }, 
    facebook: { type: String, default: "#" }, 
    youtube: { type: String, default: "#" } 
  },
  shopLinks: { type: Array, default: [{ title: "Electronics", url: "/shop/electronics" }, { title: "Men's Fashion", url: "/shop/fashion" }, { title: "Super Offers 🔥", url: "/shop" }] },
  supportLinks: { type: Array, default: [{ title: "Track Your Order", url: "/track-order" }, { title: "Returns & Exchanges", url: "/returns" }, { title: "Contact Us", url: "/contact" }] },
  
  storeShippingConfig: {
    defaultWarehouse: { type: String, default: "JACK_HUB" },
    pickupLocations: { type: [String], default: ["JACK_HUB"] },
    returnAddress: { type: String, default: "Jack Essentials Return Address" },
    returnPhone: { type: String, default: "9999999999" },
    returnPincode: { type: String, default: "754132" },
    returnCity: { type: String, default: "Jagatsinghpur" },
    returnState: { type: String, default: "Odisha" },
    gstin: { type: String, default: "" },
    invoicePrefix: { type: String, default: "JACK" }
  }
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
  aiCategory: { type: String, enum: ['Shipping', 'Billing', 'Product Issue', 'Returns & Refund', 'General Inquiry', 'Other'], default: 'General Inquiry', index: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium', index: true },
  sentiment: { type: String, enum: ['Positive', 'Neutral', 'Negative'], default: 'Neutral' },
  assignedAgent: { type: String, trim: true, default: 'Unassigned', index: true },
  slaDeadline: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  firstResponseAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  csatRating: { type: Number, min: 1, max: 5, default: null },
  messages: [{ sender: { type: String, enum: ['user', 'admin', 'support', 'bot'] }, text: String, timestamp: { type: Date, default: Date.now } }],
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
  pincode: { type: String, required: true, index: true },
  
  priority: { type: Number, default: 10, index: true }, 
  cutoffTime: { type: String, default: "17:00" }, 
  dailyCapacity: { type: Number, default: 1000 }, 
  currentLoad: { type: Number, default: 0 }, 
  serviceablePincodes: [{ type: String }], 
  isActive: { type: Boolean, default: true, index: true }
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
// 🔥 12. SEPARATED ANALYTICS MODELS (NEW)
// ==========================================
const productDailyMetricsSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  date: { type: Date, required: true, index: true },
  views: { type: Number, default: 0 },
  sales: { type: Number, default: 0 },
  revenuePaise: { type: Number, default: 0 },
  returns: { type: Number, default: 0 },
  rto: { type: Number, default: 0 }
}, { timestamps: true });
productDailyMetricsSchema.index({ product: 1, date: -1 }, { unique: true });

const productViewEventSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  userId: { type: String, default: null },
  sessionId: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, expires: 2592000 } // TTL 30 days
});
productViewEventSchema.index({ product: 1, timestamp: -1 });

const orderMetricSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true, index: true },
  totalOrders: { type: Number, default: 0 },
  grossRevenuePaise: { type: Number, default: 0 },
  netProfitPaise: { type: Number, default: 0 },
  rtoCostPaise: { type: Number, default: 0 }
}, { timestamps: true });
orderMetricSchema.index({ date: -1 });

const trafficEventSchema = new mongoose.Schema({
  source: { type: String, default: 'Direct' },
  medium: { type: String, default: 'none' },
  campaign: { type: String, default: 'none' },
  userId: { type: String, default: null },
  eventType: { type: String, default: 'pageview' },
  timestamp: { type: Date, default: Date.now, expires: 2592000 }
});
trafficEventSchema.index({ timestamp: -1 });

// ==========================================
// 🔥 EXPORT ALL MODELS (INCLUDING SEPARATED ANALYTICS)
// ==========================================
module.exports = {
  Product: mongoose.models.Product || mongoose.model('Product', productSchema),
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Order: mongoose.models.Order || mongoose.model('Order', orderSchema),
  PaymentIntent: mongoose.models.PaymentIntent || mongoose.model('PaymentIntent', paymentIntentSchema),
  PaymentAttempt: mongoose.models.PaymentAttempt || mongoose.model('PaymentAttempt', paymentAttemptSchema),
  Refund: mongoose.models.Refund || mongoose.model('Refund', refundSchema),
  Settlement: mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema),
  Setting: mongoose.models.Setting || mongoose.model('Setting', settingSchema),
  Subscriber: mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema),
  EmailTemplate: mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', emailTemplateSchema),
  Ticket: mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema),
  AbandonedCart: mongoose.models.AbandonedCart || mongoose.model('AbandonedCart', abandonedCartSchema),
  Warehouse: mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema),
  PriceAlert: mongoose.models.PriceAlert || mongoose.model('PriceAlert', priceAlertSchema),
  StockAlert: mongoose.models.StockAlert || mongoose.model('StockAlert', stockAlertSchema),
  ProductDailyMetrics: mongoose.models.ProductDailyMetrics || mongoose.model('ProductDailyMetrics', productDailyMetricsSchema),
  ProductViewEvent: mongoose.models.ProductViewEvent || mongoose.model('ProductViewEvent', productViewEventSchema),
  OrderMetric: mongoose.models.OrderMetric || mongoose.model('OrderMetric', orderMetricSchema),
  TrafficEvent: mongoose.models.TrafficEvent || mongoose.model('TrafficEvent', trafficEventSchema)
};