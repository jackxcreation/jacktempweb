// models/UserSession.js
const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ipAddress: {
    type: String,
    default: 'Unknown'
  },
  device: {
    type: String,
    default: 'Unknown Device'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
    default: 'ACTIVE',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // 🔥 MongoDB TTL Index: automatically deletes document when expiresAt is reached
  }
}, {
  timestamps: true
});

// Compound index for lightning-fast user session lookups
userSessionSchema.index({ userId: 1, status: 1 });

const UserSession = mongoose.model('UserSession', userSessionSchema);

module.exports = UserSession;