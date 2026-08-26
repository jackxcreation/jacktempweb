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

contentPostSchema.index({ type: 1, createdAt: -1 });

module.exports = {
  ContentPost: mongoose.models.ContentPost || mongoose.model('ContentPost', contentPostSchema)
};