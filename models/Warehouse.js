const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Warehouse name is required"], 
    trim: true,
    maxlength: [100, "Warehouse name cannot exceed 100 characters"],
    index: true
  },
  managerName: { 
    type: String, 
    required: [true, "Manager name is required"], 
    trim: true,
    maxlength: [100, "Manager name cannot exceed 100 characters"]
  },
  phone: { 
    type: String, 
    required: [true, "Phone number is required"], 
    match: [/^\d{10}$/, "Invalid mobile number format. Must be 10 digits"],
    trim: true 
  },
  street: { 
    type: String, 
    required: [true, "Street address is required"], 
    trim: true,
    maxlength: [150, "Street address is too long"]
  },
  landmark: { 
    type: String, 
    trim: true,
    maxlength: [100, "Landmark is too long"]
  },
  city: { 
    type: String, 
    required: [true, "City is required"], 
    trim: true,
    maxlength: [50, "City name is too long"]
  },
  state: { 
    type: String, 
    required: [true, "State is required"], 
    trim: true,
    maxlength: [50, "State name is too long"]
  },
  pincode: { 
    type: String, 
    required: [true, "Pincode is required"], 
    match: [/^\d{6}$/, "Invalid pincode format. Must be 6 digits"],
    trim: true 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  }
}, { 
  timestamps: true,
  strict: true // Automatically strips out any unallowed fields passed in req.body
});

module.exports = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);