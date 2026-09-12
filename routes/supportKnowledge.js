const express = require('express');
const router = express.Router();
const SupportKnowledge = require('../models/SupportKnowledge');
const { protect, admin } = require('../middleware/authMiddleware');

// Search knowledge base (Used by AI Planner & Web UI)
router.get('/search', async (req, res, next) => {
  try {
    const { q, category } = req.query;
    let query = { status: 'PUBLISHED' };
    
    if (q) {
      query.$text = { $search: q };
    }
    if (category) {
      query.category = category;
    }

    const results = await SupportKnowledge.find(query)
      .sort(q ? { score: { $meta: 'textScore' } } : { priority: -1 })
      .limit(5);

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
});

// Admin: Create new knowledge article
router.post('/', protect, admin, async (req, res, next) => {
  try {
    const article = await SupportKnowledge.create({
      ...req.body,
      createdBy: req.user._id
    });
    res.status(201).json(article);
  } catch (error) {
    next(error);
  }
});

// Admin: Update knowledge article
router.put('/:id', protect, admin, async (req, res, next) => {
  try {
    const article = await SupportKnowledge.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true }
    );
    res.status(200).json(article);
  } catch (error) {
    next(error);
  }
});

module.exports = router;