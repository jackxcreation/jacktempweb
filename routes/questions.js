const express = require('express');
const router = express.Router();
const { Question } = require('../models');
const { protect } = require('../middleware/authMiddleware');

// Get all Q&A for a product
router.get('/api/products/:productId/questions', async (req, res) => {
  try {
    const { productId } = req.params;
    // 🔥 FIXED: Check both 'product' and 'productId' fields in DB to prevent any 500 error
    const questions = await Question.find({ 
      $or: [{ product: productId }, { productId: productId }] 
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json(questions);
  } catch (error) {
    console.error("Fetch Questions Error:", error);
    res.status(500).json({ message: "Error fetching questions" });
  }
});

// Post a new Question (Protected)
router.post('/api/products/:productId/questions', protect, async (req, res) => {
  try {
    const { question } = req.body;
    const { productId } = req.params;

    const newQ = new Question({
      product: productId,
      productId: productId, // Support both schemas safely
      user: req.user._id,
      userName: req.user.name,
      question
    });
    const saved = await newQ.save();
    
    // Real-time broadcast via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.emit(`new_question_${productId}`, saved);
    }

    res.status(201).json(saved);
  } catch (error) {
    console.error("Post Question Error:", error);
    res.status(500).json({ message: "Error posting question" });
  }
});

// Post an Answer (Protected: Customer, Seller, or Support)
router.post('/api/questions/:questionId/answers', protect, async (req, res) => {
  try {
    const { answer } = req.body;
    // Determine role: if user is admin or seller role, mark accordingly
    let role = 'customer';
    if (req.user.role === 'admin') role = 'support';
    else if (req.user.role === 'seller') role = 'seller';

    const questionDoc = await Question.findById(req.params.questionId);
    if (!questionDoc) return res.status(404).json({ message: "Question not found" });

    const newAnswer = {
      user: req.user._id,
      userName: req.user.name,
      role,
      answer
    };

    questionDoc.answers.push(newAnswer);
    await questionDoc.save();

    const io = req.app.get('io');
    if (io) {
      io.emit(`new_answer_${questionDoc.product || questionDoc.productId}`, questionDoc);
    }

    res.status(201).json(questionDoc);
  } catch (error) {
    console.error("Post Answer Error:", error);
    res.status(500).json({ message: "Error posting answer" });
  }
});

module.exports = router;