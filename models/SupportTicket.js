const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  category: { type: String, index: true },
  subCategory: { type: String },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM', index: true },
  status: {
    type: String,
    enum: ['OPEN', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
    index: true
  },
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  queue: { type: String, default: 'GENERAL' },
  language: { type: String, default: 'en' },
  sentiment: { type: String, default: 'neutral' },
  sla: {
    deadline: { type: Date },
    status: { type: String, enum: ['NORMAL', 'WARNING', 'BREACHED'], default: 'NORMAL' }
  },
  tags: [{ type: String }],
  aiSummary: { type: String },
  aiResolutionAttempt: { type: String },
  escalationReason: { type: String },
  resolution: { type: String },
  resolvedAt: { type: Date },
  closedAt: { type: Date }
}, { timestamps: true });

// Advanced indexing for fast Inbox filtering and SLA monitoring
supportTicketSchema.index({ status: 1, 'sla.deadline': 1 });
supportTicketSchema.index({ assignedAgentId: 1, status: 1 });

// 🔥 FIXED: Auto-generate professional Ticket ID safely without next() callback error
supportTicketSchema.pre('validate', function() {
  if (!this.ticketNumber) {
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${randomStr}`;
  }
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);