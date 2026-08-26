const express = require('express');
const router = express.Router();
const { ContentPost } = require('../models');

// Get all posts or filter by type (/api/content?type=comparison)
router.get('/api/content', async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;
    const query = type ? { type } : {};
    const posts = await ContentPost.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).lean();
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching content engine data" });
  }
});

// Get single post by slug with view increment
router.get('/api/content/:slug', async (req, res) => {
  try {
    const post = await ContentPost.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!post) return res.status(404).json({ success: false, message: "Article not found" });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;