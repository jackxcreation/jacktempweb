const mongoose = require('mongoose');

const supportEventSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true, trim: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', index: true, default: null },
  eventType: {
    type: String,
    required: true,
    lowercase: true, // 🔥 FIX: Prevents crash if 'AGENT_JOINED' is passed instead of 'agent_joined'
    enum: [
      'conversation_created', 'message_received', 'ai_started', 'tool_called',
      'tool_completed', 'ai_answered', 'escalation_requested', 'ticket_created',
      'ticket_updated', 'ticket_closed', // 🔥 FIX: Added missing Ticket lifecycle events
      'agent_assigned', 'agent_joined', 'agent_left', 'agent_replied', 'conversation_resolved',
      'conversation_reopened', 'sla_warning', 'sla_breached', 'csat_submitted' // 🔥 FIX: Added CSAT event
    ],
    index: true
  },
  actorId: { type: String, default: 'SYSTEM', trim: true }, // Can be customer ID, agent ID, or 'SYSTEM' / 'AI'
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: false, versionKey: false });

// ==========================================
// 🔥 COMPOUND INDEXES FOR TIMELINE & AUDIT PERFORMANCE
// ==========================================
supportEventSchema.index({ conversationId: 1, createdAt: -1 });
supportEventSchema.index({ eventType: 1, createdAt: -1 });

// Optional: If you want to automatically delete logs older than 90 days to save DB space
// supportEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); 

// ==========================================
// 🔥 STATIC HELPER METHOD FOR CLEAN EVENT LOGGING
// ==========================================
supportEventSchema.statics.logEvent = async function({ conversationId, ticketId = null, eventType, actorId = 'SYSTEM', payload = {} }) {
  try {
    return await this.create({
      conversationId,
      ticketId,
      eventType,
      actorId,
      payload,
      createdAt: new Date()
    });
  } catch (error) {
    console.error(`Failed to log support event [${eventType}]:`, error.message);
    return null; // Non-blocking audit failure protection
  }
};

// Export model safely preventing duplicate compilation error during hot reloads
module.exports = mongoose.models.SupportEvent || mongoose.model('SupportEvent', supportEventSchema);