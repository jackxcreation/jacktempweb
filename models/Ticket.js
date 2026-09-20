// models/Ticket.js
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
  // 🔥 TASK #39: Added conversationId for persistent ticket and chat continuity
  conversationId: {
    type: String,
    index: true,
    trim: true,
    default: null
  },
  ticketNumber: {
    type: String,
    index: true,
    trim: true
  },
  status: { 
    type: String, 
    uppercase: true, // Forces standardization
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'PENDING', 'ESCALATED'],
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
  
  // 🔥 TASK #41: Required Assignment & SLA Tracking Fields
  assignedAt: { type: Date, default: null },
  lastCustomerMessageAt: { type: Date, default: Date.now },
  
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
  }],

  // 🔥 TASK #68: Dedicated internal notes schema strictly isolated from customer viewing
  internalNotes: [{
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agentName: { type: String, required: true, trim: true },
    text: { 
      type: String, 
      required: [true, "Internal note text cannot be empty"],
      trim: true,
      maxlength: [2000, "Internal note cannot exceed 2000 characters"]
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
// 🔥 ADVANCED COMPOUND INDEXES FOR DASHBOARD & SLA (TASK #63)
// ==========================================
ticketSchema.index({ userId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ status: 1, slaDeadline: 1 });
ticketSchema.index({ assignedAgentId: 1, status: 1 });
ticketSchema.index({ conversationId: 1, status: 1 }); // 🔥 TASK #39 Index

// ==========================================
// 🔥 BULLETPROOF PRE-SAVE LIFECYCLE HOOKS
// ==========================================
ticketSchema.pre('save', function(next) {
  if (!this.ticketNumber) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${randomStr}`;
  }

  // 🔥 TASK #41: Automatically timestamp assignment when assignedAgentId is updated
  if (this.isModified('assignedAgentId') && this.assignedAgentId && !this.assignedAt) {
    this.assignedAt = new Date();
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
  const upperSender = sender.toUpperCase();
  this.messages.push({
    sender: upperSender,
    text,
    timestamp: new Date()
  });

  // 🔥 TASK #41: Update last customer message timestamp if sender is user/customer
  if (upperSender === 'USER' || upperSender === 'CUSTOMER') {
    this.lastCustomerMessageAt = new Date();
  }

  return this.save();
};

ticketSchema.methods.addInternalNote = function(agentId, agentName, text) {
  this.internalNotes.push({
    agentId,
    agentName,
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