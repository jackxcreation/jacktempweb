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

  // 🔥 ENTERPRISE SUPPORT HELPDESK FIELDS (NEW)
  aiCategory: { 
    type: String, 
    enum: ['Shipping', 'Billing', 'Product Issue', 'Returns & Refund', 'General Inquiry', 'Other'], 
    default: 'General Inquiry',
    index: true 
  },
  priority: { 
    type: String, 
    enum: ['Low', 'Medium', 'High', 'Urgent'], 
    default: 'Medium',
    index: true 
  },
  sentiment: { 
    type: String, 
    enum: ['Positive', 'Neutral', 'Negative'], 
    default: 'Neutral' 
  },
  assignedAgent: { 
    type: String, 
    trim: true, 
    default: 'Unassigned',
    index: true 
  },
  slaDeadline: { 
    type: Date, 
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h SLA
  },
  firstResponseAt: { 
    type: Date, 
    default: null 
  },
  resolvedAt: { 
    type: Date, 
    default: null 
  },
  csatRating: { 
    type: Number, 
    min: 1, 
    max: 5, 
    default: null 
  },

  messages: [{
    sender: { 
      type: String, 
      required: true,
      enum: ['user', 'admin', 'support', 'bot'] 
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