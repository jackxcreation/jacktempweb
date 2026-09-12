const mongoose = require('mongoose');

const supportKnowledgeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true, index: true },
  content: { type: String, required: true },
  keywords: [{ type: String, index: true }],
  language: { type: String, default: 'en' },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'PUBLISHED', index: true },
  source: { type: String, default: 'INTERNAL' },
  version: { type: Number, default: 1 },
  priority: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Full-Text Search Index so AI can query policies efficiently
supportKnowledgeSchema.index({ title: 'text', content: 'text', keywords: 'text' });

module.exports = mongoose.model('SupportKnowledge', supportKnowledgeSchema);