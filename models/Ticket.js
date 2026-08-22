const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  orderId: String,
  status: { type: String, default: 'open' },
  messages: [{
    sender: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);