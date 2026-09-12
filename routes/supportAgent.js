const express = require('express');
const router = express.Router();
const SupportAgent = require('../models/SupportAgent');
const { protect, admin } = require('../middleware/authMiddleware');

// Get all agents and their availability (Admin Dashboard)
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const agents = await SupportAgent.find({})
      .populate('userId', 'name email')
      .sort({ availability: -1, currentActiveTickets: 1 });
    res.status(200).json(agents);
  } catch (error) {
    next(error);
  }
});

// Update agent status (Online/Offline/Busy)
router.patch('/status', protect, admin, async (req, res, next) => {
  try {
    const { status, availability } = req.body;
    const agent = await SupportAgent.findOneAndUpdate(
      { userId: req.user._id },
      { status, availability, lastActiveAt: Date.now() },
      { new: true, upsert: true }
    );
    res.status(200).json(agent);
  } catch (error) {
    next(error);
  }
});

module.exports = router;