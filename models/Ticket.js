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

// YAHAN CHANGE KIYA HAI 🔥 - Ticket model ko overwrite hone se bachane ke liye
module.exports = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);