const mongoose = require('mongoose');

const supportConversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  guestId: { type: String, index: true, default: null },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, default: null },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', index: true, default: null },
  
  mode: { 
    type: String, 
    uppercase: true,
    enum: ['AI_ACTIVE', 'ESCALATING', 'ESCALATION_REQUESTED', 'WAITING_FOR_AGENT', 'HUMAN_ACTIVE', 'RESOLVED', 'CLOSED'], 
    default: 'AI_ACTIVE',
    index: true 
  },
  
  // 🔥 FIX: Strict Uppercase Enum for standard consistency across the app
  status: { 
    type: String, 
    uppercase: true,
    enum: ['ACTIVE', 'ESCALATED', 'RESOLVED', 'CLOSED'],
    default: 'ACTIVE', 
    index: true 
  },
  
  language: { type: String, default: 'en', trim: true },
  intent: { type: String, trim: true },
  category: { type: String, index: true, trim: true },
  subCategory: { type: String, trim: true },
  priority: { type: String, uppercase: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  sentiment: { type: String, default: 'NEUTRAL', uppercase: true, trim: true },
  
  // 🔥 FIX: Added missing Agent fields for Admin UI display
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  assignedAgentName: { type: String, trim: true, default: null },
  
  aiResolved: { type: Boolean, default: false },
  escalated: { type: Boolean, default: false },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  
  // 🔥 FIX: Added tracking for resolutions
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// ==========================================
// 🔥 COMPOUND INDEXES FOR DASHBOARD PERFORMANCE
// ==========================================
supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ assignedAgentId: 1, status: 1 });
supportConversationSchema.index({ mode: 1, lastMessageAt: -1 });

// ==========================================
// 🔥 BULLETPROOF PRE-SAVE HOOK
// ==========================================
supportConversationSchema.pre('save', function(next) {
  // Automatically sync status with mode changes
  if (this.isModified('mode')) {
    if (this.mode === 'HUMAN_ACTIVE' || this.mode === 'WAITING_FOR_AGENT') {
      this.escalated = true;
      if (this.status !== 'RESOLVED' && this.status !== 'CLOSED') {
        this.status = 'ESCALATED';
      }
    }
    if (this.mode === 'RESOLVED') {
      this.status = 'RESOLVED';
      if (!this.resolvedAt) this.resolvedAt = Date.now();
    }
    if (this.mode === 'CLOSED') {
      this.status = 'CLOSED';
      if (!this.resolvedAt) this.resolvedAt = Date.now();
    }
  }
  next();
});

// ==========================================
// 🔥 HELPER INSTANCE METHODS
// ==========================================
supportConversationSchema.methods.isHumanActive = function() {
  return this.mode === 'HUMAN_ACTIVE' || this.mode === 'WAITING_FOR_AGENT';
};

supportConversationSchema.methods.isAIActive = function() {
  return this.mode === 'AI_ACTIVE';
};

supportConversationSchema.methods.markAsEscalated = function(agentId = null, agentName = null) {
  this.mode = 'HUMAN_ACTIVE';
  this.status = 'ESCALATED';
  this.escalated = true;
  if (agentId) {
    this.assignedAgentId = agentId;
  }
  if (agentName) {
    this.assignedAgentName = agentName;
  }
  this.lastMessageAt = Date.now();
};

// Export model safely preventing duplicate compilation error during hot reloads
module.exports = mongoose.models.SupportConversation || mongoose.model('SupportConversation', supportConversationSchema);