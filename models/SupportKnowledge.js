const mongoose = require('mongoose');

const supportKnowledgeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, index: true, trim: true },
  content: { type: String, required: true, trim: true },
  
  // 🔥 FIX: Renamed 'keywords' to 'tags' to perfectly match the API route and Admin UI
  tags: [{ type: String, index: true, trim: true, lowercase: true }],
  
  language: { type: String, default: 'en', trim: true },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'PUBLISHED', index: true },
  source: { type: String, default: 'INTERNAL', trim: true },
  version: { type: Number, default: 1, min: 1 },
  priority: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// ==========================================
// 🔥 INDEXES FOR FULL-TEXT SEARCH & PERFORMANCE
// ==========================================
// 🔥 FIX: Updated text index to use 'tags' instead of 'keywords'
supportKnowledgeSchema.index({ title: 'text', content: 'text', tags: 'text' });
supportKnowledgeSchema.index({ status: 1, category: 1, priority: -1 });

// ==========================================
// 🔥 BULLETPROOF PRE-SAVE HOOK (NORMALIZE TAGS)
// ==========================================
supportKnowledgeSchema.pre('save', function(next) {
  // Deduplicate and lowercase tags before saving to database
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = [...new Set(this.tags.map(t => t.toLowerCase().trim()).filter(Boolean))];
  }
  next();
});

// Export model safely preventing duplicate compilation error during hot reloads
module.exports = mongoose.models.SupportKnowledge || mongoose.model('SupportKnowledge', supportKnowledgeSchema);