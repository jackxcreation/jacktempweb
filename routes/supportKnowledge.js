const express = require('express');
const router = express.Router();
// 🔥 FIX: Destructured from index.js megastructure to avoid "Model not found" errors
const { SupportKnowledge } = require('../models'); 
const { protect, admin } = require('../middleware/authMiddleware');

// ==========================================
// 🔍 1. Search knowledge base (Used by AI Planner & Web UI)
// ==========================================
router.get('/search', async (req, res, next) => {
  try {
    const { q, category, tag } = req.query;
    let query = { status: 'PUBLISHED' };
    
    if (q) {
      query.$text = { $search: q };
    }
    
    // 🔥 FIX: Mapped 'category' or 'tag' to the 'tags' array in your schema (Case-insensitive)
    if (category || tag) {
      query.tags = { $in: [new RegExp(category || tag, 'i')] };
    }

    const results = await SupportKnowledge.find(query)
      // 🔥 FIX: Changed 'priority' to 'createdAt' because 'priority' is not in your current schema
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .limit(10); // Increased limit to 10 for better UI display

    res.status(200).json(results);
  } catch (error) {
    console.error("Knowledge Base Search Error:", error);
    next(error);
  }
});

// ==========================================
// 🏷️ 2. 🔥 NEW: Get all unique Tags/Categories for UI Dropdowns
// ==========================================
router.get('/tags', async (req, res, next) => {
  try {
    // Automatically fetches all distinct tags used in published articles
    const tags = await SupportKnowledge.distinct('tags', { status: 'PUBLISHED' });
    res.status(200).json(tags);
  } catch (error) {
    console.error("Fetch Tags Error:", error);
    next(error);
  }
});

// ==========================================
// 🌐 3. 🔥 NEW: Get published articles (For Customer Portal Help Center)
// ==========================================
router.get('/published', async (req, res, next) => {
  try {
    const articles = await SupportKnowledge.find({ status: 'PUBLISHED' })
      .sort({ createdAt: -1 })
      .select('-__v'); // Clean output
      
    res.status(200).json(articles);
  } catch (error) {
    console.error("Fetch Published Articles Error:", error);
    next(error);
  }
});

// ==========================================
// 📖 4. Get ALL knowledge articles (Admin Dashboard)
// ==========================================
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const articles = await SupportKnowledge.find({}).sort({ createdAt: -1 });
    res.status(200).json(articles);
  } catch (error) {
    console.error("Fetch All Articles Error:", error);
    next(error);
  }
});

// ==========================================
// 📄 5. Get a SINGLE knowledge article by ID
// ==========================================
router.get('/:id', async (req, res, next) => {
  try {
    const article = await SupportKnowledge.findById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    
    res.status(200).json(article);
  } catch (error) {
    console.error("Fetch Single Article Error:", error);
    next(error);
  }
});

// ==========================================
// ✍️ 6. Admin: Create new knowledge article
// ==========================================
router.post('/', protect, admin, async (req, res, next) => {
  try {
    const article = await SupportKnowledge.create({
      ...req.body,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, article });
  } catch (error) {
    console.error("Create Article Error:", error);
    next(error);
  }
});

// ==========================================
// 🔄 7. Admin: Update knowledge article
// ==========================================
router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const article = await SupportKnowledge.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true } // 🔥 Prevents invalid enum values from sneaking in
    );
    
    if (!article) return res.status(404).json({ error: 'Article not found' });
    
    res.status(200).json({ success: true, article });
  } catch (error) {
    console.error("Update Article Error:", error);
    next(error);
  }
});

// ==========================================
// 🗑️ 8. Admin: Delete knowledge article
// ==========================================
router.delete('/:id', protect, admin, async (req, res, next) => {
  try {
    const article = await SupportKnowledge.findByIdAndDelete(req.params.id);
    
    if (!article) return res.status(404).json({ error: 'Article not found' });
    
    res.status(200).json({ success: true, message: 'Article deleted successfully' });
  } catch (error) {
    console.error("Delete Article Error:", error);
    next(error);
  }
});

module.exports = router;