// models/AuditLog.js
const mongoose = require('mongoose');

/**
 * Enterprise Customer Support & Commerce Audit Log Schema (Task #69)
 * Tracks every critical action including agent identity, timestamps, status transitions,
 * messages, assignment handoffs, and refund actions with immutable precision.
 */
const auditLogSchema = new mongoose.Schema({
  action: { 
    type: String, 
    required: [true, "Audit action type is required"], 
    uppercase: true, 
    index: true 
  }, // e.g., 'STATUS_CHANGE', 'MESSAGE_ADDED', 'TICKET_ASSIGNED', 'REFUND_PROCESSED'
  
  targetType: { 
    type: String, 
    required: true, 
    enum: ['TICKET', 'ORDER', 'PAYMENT', 'USER'], 
    default: 'TICKET', 
    index: true 
  },
  
  targetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    index: true 
  },
  
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  
  agentEmail: { 
    type: String, 
    required: true, 
    trim: true 
  },
  
  oldStatus: { 
    type: String, 
    default: '' 
  },
  
  newStatus: { 
    type: String, 
    default: '' 
  },
  
  message: { 
    type: String, 
    default: '' 
  },
  
  assignment: {
    previousAgent: { type: String, default: '' },
    newAgent: { type: String, default: '' },
    assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  
  refundAction: {
    isRefund: { type: Boolean, default: false },
    refundAmountPaise: { type: Number, default: 0 },
    gatewayRefundId: { type: String, default: '' },
    reason: { type: String, default: '' }
  },
  
  details: { 
    type: String, 
    required: true 
  },
  
  metadata: { 
    type: Object, 
    default: {} 
  },
  
  ipAddress: { 
    type: String, 
    default: 'Unknown' 
  },
  
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  }
}, { 
  timestamps: true,
  strict: true 
});

// High-performance compound indexes for fast querying and reporting
auditLogSchema.index({ targetId: 1, timestamp: -1 });
auditLogSchema.index({ agentId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);