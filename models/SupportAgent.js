const mongoose = require('mongoose');

const supportAgentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, enum: ['ONLINE', 'OFFLINE', 'AWAY', 'BUSY'], default: 'OFFLINE' },
  skills: [{ type: String }], // e.g., 'refunds', 'technical', 'shipping'
  languages: [{ type: String, default: 'en' }],
  maxConcurrentTickets: { type: Number, default: 5 },
  currentActiveTickets: { type: Number, default: 0 },
  availability: { type: Boolean, default: true },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Optimized index for Assignment Service to quickly find free agents
supportAgentSchema.index({ status: 1, currentActiveTickets: 1, availability: 1 });

module.exports = mongoose.model('SupportAgent', supportAgentSchema);