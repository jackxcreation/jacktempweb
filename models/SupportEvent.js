const mongoose = require('mongoose');

const supportEventSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', index: true },
  eventType: {
    type: String,
    required: true,
    enum: [
      'conversation_created', 'message_received', 'ai_started', 'tool_called',
      'tool_completed', 'ai_answered', 'escalation_requested', 'ticket_created',
      'agent_assigned', 'agent_joined', 'agent_replied', 'conversation_resolved',
      'conversation_reopened', 'sla_warning', 'sla_breached'
    ]
  },
  actorId: { type: String }, // Can be customer ID, agent ID, or 'SYSTEM' / 'AI'
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: false, versionKey: false });

module.exports = mongoose.model('SupportEvent', supportEventSchema);