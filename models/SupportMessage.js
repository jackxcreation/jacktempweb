const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  senderType: {
    type: String,
    enum: ['CUSTOMER', 'AI', 'AGENT', 'SYSTEM'],
    required: true,
    index: true
  },
  senderId: { type: String }, // ObjectId for user/agent, or sessionId for guest
  content: { type: String },
  contentType: { type: String, default: 'text' }, // text, order_tracking, product, action_buttons
  language: { type: String, default: 'en' },
  isInternal: { type: Boolean, default: false }, // Hidden from customer (e.g., agent private notes, raw tool data)
  toolName: { type: String },
  toolCallId: { type: String },
  toolResult: { type: mongoose.Schema.Types.Mixed },
  readAt: { type: Date }
}, { timestamps: true });

// Optimized for loading history in chat UI
supportMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('SupportMessage', supportMessageSchema);