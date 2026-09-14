const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  // Allows both registered ObjectIds and guest session strings
  userId: { 
    type: String, 
    required: [true, "User ID is required"],
    trim: true,
    index: true 
  },
  userName: { 
    type: String, 
    required: [true, "User name is required"],
    trim: true,
    maxlength: [100, "User name is too long"]
  },
  orderId: { 
    type: String, 
    trim: true, 
    index: true 
  },
  ticketNumber: {
    type: String,
    index: true,
    trim: true
  },
  status: { 
    type: String, 
    uppercase: true, // Forces standardization
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'PENDING'],
    default: 'OPEN',
    index: true 
  },

  aiCategory: { 
    type: String, 
    // Aligned with the exact outputs from the Gemini Orchestrator and Webhooks
    enum: ['Shipping', 'SHIPPING', 'Billing', 'BILLING', 'Product Issue', 'Returns & Refund', 'General Inquiry', 'Other', 'GENERAL'], 
    default: 'General Inquiry',
    index: true 
  },
  priority: { 
    type: String, 
    uppercase: true,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 
    default: 'MEDIUM',
    index: true 
  },
  sentiment: { 
    type: String, 
    uppercase: true,
    enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'], 
    default: 'NEUTRAL' 
  },
  
  // Added ID mapping for Admin API compatibility
  assignedAgentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    index: true, 
    default: null 
  },
  assignedAgent: { 
    type: String, 
    trim: true, 
    default: 'Unassigned',
    index: true 
  },
  
  slaDeadline: { 
    type: Date, 
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) 
  },
  firstResponseAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  csatRating: { type: Number, min: 1, max: 5, default: null },

  messages: [{
    sender: { 
      type: String, 
      required: true,
      uppercase: true,
      // Added SYSTEM and AI to prevent webhook crashes
      enum: ['USER', 'ADMIN', 'SUPPORT', 'BOT', 'SYSTEM', 'AI', 'AGENT', 'CUSTOMER'] 
    },
    text: { 
      type: String, 
      required: [true, "Message text cannot be empty"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"]
    },
    timestamp: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true,
  strict: true, 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// 🔥 ADVANCED COMPOUND INDEXES FOR DASHBOARD & SLA
// ==========================================
ticketSchema.index({ userId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ status: 1, slaDeadline: 1 });
ticketSchema.index({ assignedAgentId: 1, status: 1 });

// ==========================================
// 🔥 BULLETPROOF PRE-SAVE LIFECYCLE HOOKS
// ==========================================
ticketSchema.pre('save', function(next) {
  if (!this.ticketNumber) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${randomStr}`;
  }

  if (!this.firstResponseAt && this.messages && this.messages.length > 0) {
    const hasAgentReply = this.messages.some(m => ['ADMIN', 'SUPPORT', 'AGENT', 'SYSTEM'].includes(m.sender.toUpperCase()));
    if (hasAgentReply) {
      this.firstResponseAt = new Date();
    }
  }

  if ((this.status === 'RESOLVED' || this.status === 'CLOSED') && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }

  next();
});

// ==========================================
// 🔥 SLA BREACH VIRTUAL PROPERTY
// ==========================================
ticketSchema.virtual('isSlaBreached').get(function() {
  if (!this.slaDeadline) return false;
  if (this.status === 'RESOLVED' || this.status === 'CLOSED') return false;
  return Date.now() > new Date(this.slaDeadline).getTime();
});

// ==========================================
// 🔥 HELPER INSTANCE METHODS
// ==========================================
ticketSchema.methods.addMessage = function(sender, text) {
  this.messages.push({
    sender: sender.toUpperCase(),
    text,
    timestamp: new Date()
  });
  return this.save();
};

ticketSchema.methods.markResolved = function() {
  this.status = 'RESOLVED';
  this.resolvedAt = new Date();
  return this.save();
};

module.exports = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);