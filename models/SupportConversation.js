const mongoose = require('mongoose');

const supportConversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  guestId: { type: String, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', index: true },
  mode: { 
    type: String, 
    enum: ['AI_ACTIVE', 'ESCALATING', 'ESCALATION_REQUESTED', 'WAITING_FOR_AGENT', 'HUMAN_ACTIVE', 'RESOLVED', 'CLOSED'], 
    default: 'AI_ACTIVE',
    index: true 
  },
  status: { type: String, default: 'active', index: true },
  language: { type: String, default: 'en' },
  intent: { type: String },
  category: { type: String, index: true },
  subCategory: { type: String },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
  sentiment: { type: String, default: 'neutral' },
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  aiResolved: { type: Boolean, default: false },
  escalated: { type: Boolean, default: false },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Compound indexes for extremely fast admin dashboard sorting
supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ assignedAgentId: 1, status: 1 });

module.exports = mongoose.model('SupportConversation', supportConversationSchema);