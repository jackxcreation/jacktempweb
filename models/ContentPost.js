// models/ContentPost.js
const mongoose = require('mongoose');

const contentPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['blog', 'guide', 'comparison', 'deal'], required: true, index: true },
  excerpt: { type: String, required: true },
  contentHtml: { type: String, required: true }, // Rich markdown or HTML content
  featuredImage: { type: String, required: true },
  
  // Comparison & Specs structured data for AI Overviews
  comparisonData: {
    productA: { name: String, image: String, pricePaise: Number, specs: Object, pros: [String], cons: [String] },
    productB: { name: String, image: String, pricePaise: Number, specs: Object, pros: [String], cons: [String] },
    verdict: String
  },

  faqs: [{ question: String, answer: String }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  views: { type: Number, default: 0 }
}, { timestamps: true });

// ==========================================
// 🔥 PRO FEATURE: INDEXES FOR PERFORMANCE & SEARCH
// ==========================================
contentPostSchema.index({ type: 1, createdAt: -1 });

// Full-text search index across titles, excerpts, and keywords for blog/comparison search
contentPostSchema.index({ 
  title: 'text', 
  excerpt: 'text', 
  'seo.keywords': 'text' 
});

// ==========================================
// 🔥 PRO FEATURE: HELPER STATIC METHODS
// ==========================================
contentPostSchema.statics.incrementViews = function(slug) {
  return this.findOneAndUpdate(
    { slug }, 
    { $inc: { views: 1 } }, 
    { new: true }
  );
};

module.exports = {
  ContentPost: mongoose.models.ContentPost || mongoose.model('ContentPost', contentPostSchema)
};