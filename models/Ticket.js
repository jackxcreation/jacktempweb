const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: [true, "User ID is required"],
    trim: true,
    index: true 
  },
  userName: { 
    type: String, 
    required: [true, "User name is required"],
    trim: true,
    maxlength: [100, "User name is too long"]
  },
  orderId: { 
    type: String, 
    trim: true,
    index: true 
  },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    index: true 
  },
  messages: [{
    sender: { 
      type: String, 
      required: true,
      enum: ['user', 'admin', 'support'] 
    },
    text: { 
      type: String, 
      required: [true, "Message text cannot be empty"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"]
    },
    timestamp: { 
      type: Date, 
      default: Date.now 
    }
  }]
}, { 
  timestamps: true,
  strict: true // Automatically strips out any unallowed fields passed in req.body
});

// Ticket model ko overwrite hone se bachane ke liye safe export
module.exports = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);