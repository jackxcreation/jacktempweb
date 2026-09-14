// models/CampaignLog.js
import mongoose from 'mongoose';

const CampaignLogSchema = new mongoose.Schema({
  campaignId: { 
    type: String, 
    required: true, 
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  eventType: { 
    type: String, 
    enum: ['DELIVERY', 'OPEN', 'CLICK', 'PURCHASE'], 
    required: true,
    index: true
  },
  orderValue: { 
    type: Number, 
    default: 0 
  }, // PURCHASE event ke waqt order amount track karne ke liye (ROI ke liye)
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

// ==========================================
// 🔥 PRO FEATURE: COMPOUND INDEXES FOR FAST ROI AGGREGATIONS
// ==========================================
CampaignLogSchema.index({ campaignId: 1, eventType: 1 });

// Next.js hot-reload model overwrite prevention
export default mongoose.models.CampaignLog || mongoose.model('CampaignLog', CampaignLogSchema);