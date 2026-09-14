const mongoose = require('mongoose');

const supportAgentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  // 🔥 FIX: Made name & email optional since we populate them dynamically from the User model in routes
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  
  // 🔥 FIX: Added uppercase: true so 'Offline' from frontend automatically becomes 'OFFLINE'
  status: { type: String, uppercase: true, enum: ['ONLINE', 'OFFLINE', 'AWAY', 'BUSY'], default: 'OFFLINE', index: true },
  
  skills: [{ type: String, trim: true, lowercase: true }], // e.g., 'refunds', 'technical', 'shipping'
  languages: [{ type: String, default: 'en', trim: true }],
  maxConcurrentTickets: { type: Number, default: 5, min: 1 },
  currentActiveTickets: { type: Number, default: 0, min: 0 },
  availability: { type: Boolean, default: true, index: true },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Optimized indexes for Assignment Service
supportAgentSchema.index({ status: 1, currentActiveTickets: 1, availability: 1 });
supportAgentSchema.index({ skills: 1 });

// ==========================================
// 🔥 BULLETPROOF PRE-SAVE VALIDATION HOOK
// ==========================================
supportAgentSchema.pre('save', function(next) {
  if (this.currentActiveTickets < 0) this.currentActiveTickets = 0;
  if (this.maxConcurrentTickets < 1) this.maxConcurrentTickets = 1;
  
  // Automatically adjust status if capacity is full or free
  if (this.currentActiveTickets >= this.maxConcurrentTickets && this.status === 'ONLINE') {
    this.status = 'BUSY';
  } else if (this.currentActiveTickets < this.maxConcurrentTickets && this.status === 'BUSY') {
    this.status = 'ONLINE';
  }
  
  next();
});

// ==========================================
// 🔥 HELPER INSTANCE METHODS FOR ASSIGNMENT
// ==========================================
supportAgentSchema.methods.canAcceptTicket = function() {
  return this.availability && 
         this.status === 'ONLINE' && 
         this.currentActiveTickets < this.maxConcurrentTickets;
};

// ==========================================
// 🛡️ ADVANCED: ATOMIC COUNTER UPDATES (Prevents Race Conditions)
// ==========================================
supportAgentSchema.statics.assignTicketToAgent = async function(agentId) {
  // Uses $inc to safely add 1 to the counter exactly at the database level
  const agent = await this.findOneAndUpdate(
    { _id: agentId, status: 'ONLINE', availability: true }, // Ensure still available
    { 
      $inc: { currentActiveTickets: 1 },
      $set: { lastActiveAt: Date.now() }
    },
    { new: true, runValidators: true }
  );

  // If agent hit max capacity after this assignment, update their status to BUSY
  if (agent && agent.currentActiveTickets >= agent.maxConcurrentTickets) {
    agent.status = 'BUSY';
    await agent.save();
  }
  return agent;
};

supportAgentSchema.statics.releaseTicketFromAgent = async function(agentId) {
  const agent = await this.findOneAndUpdate(
    { _id: agentId, currentActiveTickets: { $gt: 0 } },
    { $inc: { currentActiveTickets: -1 } },
    { new: true, runValidators: true }
  );

  // If agent was BUSY but now has space, make them ONLINE again
  if (agent && agent.status === 'BUSY' && agent.currentActiveTickets < agent.maxConcurrentTickets) {
    agent.status = 'ONLINE';
    await agent.save();
  }
  return agent;
};

// Export model safely preventing duplicate compilation error during hot reloads
module.exports = mongoose.models.SupportAgent || mongoose.model('SupportAgent', supportAgentSchema);