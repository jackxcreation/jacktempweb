// models/Warehouse.js
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
    maxlength: [50, "City name is too long"],
    index: true
  },
  state: { 
    type: String, 
    required: [true, "State is required"], 
    trim: true,
    maxlength: [50, "State name is too long"],
    index: true
  },
  pincode: { 
    type: String, 
    required: [true, "Pincode is required"], 
    match: [/^\d{6}$/, "Invalid pincode format. Must be 6 digits"],
    trim: true,
    index: true
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

// ==========================================
// 🔥 PRO FEATURE: HELPER STATIC METHODS
// ==========================================
warehouseSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

warehouseSchema.statics.findByPincode = function(pincode) {
  return this.findOne({ pincode, isActive: true });
};

// ==========================================
// 🔥 PRO FEATURE: INSTANCE METHODS (Full Address)
// ==========================================
warehouseSchema.methods.getFullAddress = function() {
  const parts = [this.street, this.landmark, this.city, this.state, `Pin: ${this.pincode}`];
  return parts.filter(Boolean).join(', ');
};

// Warehouse model ko overwrite hone se bachane ke liye safe export
const Warehouse = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);

module.exports = Warehouse;