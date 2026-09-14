const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  messageId: {
    type: String,
    unique: true,
    sparse: true,
    // Automatically generates a unique messageId if missing to prevent duplicate null key errors
    default: () => `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  },
  senderType: {
    type: String,
    required: true,
    uppercase: true, // 🔥 FIX: Auto-converts 'ai' or 'agent' to uppercase so we don't need a messy enum array
    enum: ['CUSTOMER', 'AI', 'USER', 'AGENT', 'ADMIN', 'BOT', 'SYSTEM']
  },
  senderId: {
    type: String, 
    // 🔥 CRITICAL FIX: Removed 'required: true'. System/AI messages don't always have an ID.
    // This prevents the Carrier Webhook from crashing when it auto-generates RTO alerts.
    default: function() { 
      return (this.senderType === 'SYSTEM' || this.senderType === 'AI') ? 'system' : 'unknown'; 
    }
  },
  content: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['text', 'image', 'system_event', 'action_card'],
    default: 'text'
  },
  // 🔥 CRITICAL FIX: Added isInternal field. This allows agents to leave private notes on tickets 
  // that the customer cannot see on their frontend UI.
  isInternal: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  readBy: [{
    userId: String,
    readAt: Date
  }]
}, { timestamps: true });

// Indexes for fast querying (Chronological chat history)
supportMessageSchema.index({ conversationId: 1, createdAt: 1 });
supportMessageSchema.index({ isInternal: 1 }); 

const SupportMessage = mongoose.models.SupportMessage || mongoose.model('SupportMessage', supportMessageSchema);

module.exports = SupportMessage;