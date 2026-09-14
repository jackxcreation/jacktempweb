// routes/contentRouter.js
const express = require('express');
const router = express.Router();
const { ContentPost } = require('../models');

// Get all posts or filter by type / text search (/api/content?type=comparison&search=query&limit=10&page=1)
router.get('/api/content', async (req, res) => {
  try {
    const { type, search, limit = 10, page = 1 } = req.query;
    let query = {};

    if (type) {
      query.type = type;
    }

    // 🔥 Pro Feature: Full-text search support leveraging MongoDB text index
    if (search && typeof search === 'string' && search.trim().length > 0) {
      query.$text = { $search: search.trim() };
    }

    const parsedLimit = Math.max(1, Math.min(50, parseInt(limit) || 10));
    const parsedPage = Math.max(1, parseInt(page) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const posts = await ContentPost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await ContentPost.countDocuments(query);

    return res.json({ 
      success: true, 
      posts,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit) || 1
      }
    });
  } catch (err) {
    console.error("Error fetching content engine data:", err);
    return res.status(500).json({ success: false, message: "Error fetching content engine data" });
  }
});

// Get single post by slug with view increment
router.get('/api/content/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!slug) {
      return res.status(400).json({ success: false, message: "Slug is required" });
    }

    const post = await ContentPost.findOneAndUpdate(
      { slug },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Article not found" });
    }

    return res.json({ success: true, post });
  } catch (err) {
    console.error("Server error fetching single content post:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;