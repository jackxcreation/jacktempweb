// models/PaymentEvent.js
const mongoose = require('mongoose');

const paymentEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  eventType: { type: String, required: true, index: true },
  paymentGateway: { type: String, default: 'razorpay' },
  payload: { type: Object, required: true },
  status: { type: String, enum: ['PROCESSED', 'FAILED', 'IGNORED'], default: 'PROCESSED', index: true },
  processedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

// TTL index to automatically clean up raw webhook event logs after 30 days
paymentEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const PaymentEvent = mongoose.models.PaymentEvent || mongoose.model('PaymentEvent', paymentEventSchema);

module.exports = PaymentEvent;