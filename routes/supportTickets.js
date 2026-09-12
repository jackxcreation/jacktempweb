const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');
const { protect, admin } = require('../middleware/authMiddleware');

// List tickets with filtering (Admin Dashboard)
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const { status, priority, agentId, page = 1, limit = 50 } = req.query;
    let query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (agentId) query.assignedAgentId = agentId === 'unassigned' ? null : agentId;

    const tickets = await SupportTicket.find(query)
      .populate('customerId', 'name email')
      .populate('assignedAgentId', 'name')
      .sort({ 'sla.deadline': 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.status(200).json({ tickets, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// Update Ticket Status/Assignment
router.patch('/:id', protect, admin, async (req, res, next) => {
  try {
    const { status, assignedAgentId, resolution } = req.body;
    let updateData = { status };

    if (assignedAgentId !== undefined) updateData.assignedAgentId = assignedAgentId;
    if (resolution) {
      updateData.resolution = resolution;
      updateData.resolvedAt = Date.now();
    }
    if (status === 'CLOSED') updateData.closedAt = Date.now();

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('customerId assignedAgentId');

    res.status(200).json(ticket);
  } catch (error) {
    next(error);
  }
});

module.exports = router;