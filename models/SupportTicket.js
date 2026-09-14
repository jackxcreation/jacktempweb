const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true, index: true, trim: true },
  conversationId: { type: String, required: true, index: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  
  // 🔥 FIX: Added fields required by the Carrier Webhook for Guest/RTO Orders
  userName: { type: String, trim: true, default: 'Guest/System' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, default: null },
  
  category: { type: String, index: true, trim: true },
  aiCategory: { type: String, trim: true }, // 🔥 FIX: Used by Webhook auto-categorization
  subCategory: { type: String, trim: true },
  
  priority: { type: String, uppercase: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM', index: true },
  status: {
    type: String,
    uppercase: true, // 🔥 FIX: Prevents validation crash if frontend sends lowercase 'open'
    enum: ['OPEN', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
    index: true
  },
  
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  assignedAgent: { type: String, trim: true }, // 🔥 FIX: Admin API uses this for instant UI display
  
  queue: { type: String, default: 'GENERAL', trim: true },
  language: { type: String, default: 'en', trim: true },
  sentiment: { type: String, uppercase: true, default: 'NEUTRAL', trim: true },
  
  // 🔥 FIX: Flattened SLA to match the Dashboard Statistics Aggregation query
  slaDeadline: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: true },
  slaStatus: { type: String, uppercase: true, enum: ['NORMAL', 'WARNING', 'BREACHED'], default: 'NORMAL' },
  
  tags: [{ type: String, trim: true, lowercase: true }],
  
  aiSummary: { type: String, trim: true },
  aiResolutionAttempt: { type: String, trim: true },
  escalationReason: { type: String, trim: true },
  resolution: { type: String, trim: true },
  
  // 🔥 FIX: Added analytics tracking fields for First Response Time (FRT) & CSAT
  firstResponseAt: { type: Date, default: null },
  csatRating: { type: Number, min: 1, max: 5, default: null },
  
  resolvedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null }
}, { timestamps: true });

// ==========================================
// 🔥 ADVANCED INDEXES FOR INBOX & SLA MONITORING
// ==========================================
supportTicketSchema.index({ status: 1, slaDeadline: 1 });
supportTicketSchema.index({ assignedAgentId: 1, status: 1 });
supportTicketSchema.index({ createdAt: -1 });

// ==========================================
// 🔥 PRE-VALIDATE & PRE-SAVE HOOKS
// ==========================================
supportTicketSchema.pre('validate', function(next) {
  if (!this.ticketNumber) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${randomStr}`;
  }
  next();
});

supportTicketSchema.pre('save', function(next) {
  // Automatically track resolution & closure timestamps
  if (this.isModified('status')) {
    if (this.status === 'RESOLVED' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'CLOSED' && !this.closedAt) {
      this.closedAt = new Date();
      if (!this.resolvedAt) this.resolvedAt = new Date();
    }
  }

  // Normalize tags
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = [...new Set(this.tags.map(t => t.toLowerCase().trim()).filter(Boolean))];
  }

  next();
});

// ==========================================
// 🔥 HELPER INSTANCE METHODS
// ==========================================
supportTicketSchema.methods.isResolved = function() {
  return this.status === 'RESOLVED' || this.status === 'CLOSED';
};

supportTicketSchema.methods.markResolved = function(resolutionText = 'Resolved by system/agent') {
  this.status = 'RESOLVED';
  this.resolution = resolutionText;
  this.resolvedAt = new Date();
};

// Export model safely preventing duplicate compilation error during hot reloads
module.exports = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);