const express = require('express');
const router = express.Router();
const SupportAgent = require('../models/SupportAgent');
const { protect, admin } = require('../middleware/authMiddleware');

// ==========================================
// 👥 1. Get all agents and their availability (Admin Dashboard)
// ==========================================
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const agents = await SupportAgent.find({})
      .populate('userId', 'name email role') // 🔥 FIX: Added 'role' for better frontend context
      .sort({ availability: -1, currentActiveTickets: 1 });
    
    res.status(200).json(agents);
  } catch (error) {
    console.error("Fetch Agents Error:", error);
    next(error);
  }
});

// ==========================================
// 🎯 2. 🔥 NEW: Get only AVAILABLE agents for Ticket Routing
// ==========================================
router.get('/available', protect, admin, async (req, res, next) => {
  try {
    // Sirf un agents ko lao jo 'Online' hain aur available hain
    // Aur jinke paas sabse kam tickets hain unhe upar rakho (Load Balancing)
    const availableAgents = await SupportAgent.find({ 
      status: 'Online', 
      availability: true 
    })
    .populate('userId', 'name email')
    .sort({ currentActiveTickets: 1 })
    .limit(10); // Top 10 free agents
    
    res.status(200).json(availableAgents);
  } catch (error) {
    console.error("Fetch Available Agents Error:", error);
    next(error);
  }
});

// ==========================================
// 🟢 3. Update agent status (Online/Offline/Busy)
// ==========================================
router.patch('/status', protect, admin, async (req, res, next) => {
  try {
    const { status, availability } = req.body;
    
    const agent = await SupportAgent.findOneAndUpdate(
      { userId: req.user._id },
      { 
        status, 
        availability, 
        lastActiveAt: Date.now() 
      },
      { new: true, upsert: true }
    ).populate('userId', 'name email role');

    // 🔥 FIX: Real-time Socket Broadcast for Agent Status
    // Isse ticket routing engine aur doosre admins ko turant pata chal jayega
    const io = req.app.get('io');
    if (io) {
      io.emit('agentStatusChanged', {
        agentId: agent._id,
        userId: req.user._id,
        name: agent.userId?.name,
        status: agent.status,
        availability: agent.availability,
        currentActiveTickets: agent.currentActiveTickets
      });
    }

    res.status(200).json({ success: true, agent });
  } catch (error) {
    console.error("Update Agent Status Error:", error);
    next(error);
  }
});

// ==========================================
// 👤 4. Get current logged-in agent's own stats
// ==========================================
router.get('/me', protect, admin, async (req, res, next) => {
  try {
    let agent = await SupportAgent.findOne({ userId: req.user._id })
      .populate('userId', 'name email role');
    
    // 🔥 If an admin logs into the helpdesk for the first time, auto-create their agent profile
    if (!agent) {
      agent = await SupportAgent.create({
        userId: req.user._id,
        status: 'Offline',
        availability: false,
        currentActiveTickets: 0
      });
      // Populate naye banaye gaye agent ke liye
      agent = await SupportAgent.findById(agent._id).populate('userId', 'name email role');
    }
    
    res.status(200).json(agent);
  } catch (error) {
    console.error("Fetch Own Agent Profile Error:", error);
    next(error);
  }
});

module.exports = router;