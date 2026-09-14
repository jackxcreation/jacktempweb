// routes/questionRouter.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 🔥 FIX: Direct Model Import to prevent 'undefined' crash
const Question = require('../models/Question');
const { protect } = require('../middleware/authMiddleware');

// Get all Q&A for a product
router.get('/api/products/:productId/questions', async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid Product ID format" });
    }

    // 🔥 FIXED: Check both 'product' and 'productId' fields in DB to prevent any 500 error
    const questions = await Question.find({ 
      $or: [{ product: productId }, { productId: productId }] 
    })
      .sort({ createdAt: -1 })
      .lean();
      
    return res.json(questions);
  } catch (error) {
    console.error("Fetch Questions Error:", error);
    return res.status(500).json({ message: "Error fetching questions" });
  }
});

// Post a new Question (Protected)
router.post('/api/products/:productId/questions', protect, async (req, res) => {
  try {
    const { question } = req.body;
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid Product ID format" });
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Question text cannot be empty" });
    }

    if (question.length > 500) {
      return res.status(400).json({ success: false, message: "Question cannot exceed 500 characters" });
    }

    const newQ = new Question({
      product: productId,
      productId: productId, // Support both schemas safely
      user: req.user._id,
      userName: req.user.name,
      question: question.trim()
    });
    const saved = await newQ.save();
    
    // Real-time broadcast via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      try {
        io.emit(`new_question_${productId}`, saved);
      } catch (socketErr) {
        console.error("Socket emit error:", socketErr);
      }
    }

    return res.status(201).json(saved);
  } catch (error) {
    console.error("Post Question Error:", error);
    return res.status(500).json({ message: "Error posting question" });
  }
});

// Post an Answer (Protected: Customer, Seller, or Support)
router.post('/api/questions/:questionId/answers', protect, async (req, res) => {
  try {
    const { answer } = req.body;
    const { questionId } = req.params;

    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ success: false, message: "Invalid Question ID format" });
    }

    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Answer text cannot be empty" });
    }

    if (answer.length > 1000) {
      return res.status(400).json({ success: false, message: "Answer cannot exceed 1000 characters" });
    }

    // Determine role: if user is admin or seller role, mark accordingly
    let role = 'customer';
    if (['admin', 'super_admin', 'operations_manager', 'customer_support'].includes(req.user.role)) {
      role = 'support';
    } else if (req.user.role === 'seller') {
      role = 'seller';
    }

    const questionDoc = await Question.findById(questionId);
    if (!questionDoc) {
      return res.status(404).json({ message: "Question not found" });
    }

    const newAnswer = {
      user: req.user._id,
      userName: req.user.name,
      role,
      answer: answer.trim()
    };

    questionDoc.answers.push(newAnswer);
    await questionDoc.save();

    const io = req.app.get('io');
    if (io) {
      try {
        const targetProductId = questionDoc.product || questionDoc.productId;
        io.emit(`new_answer_${targetProductId}`, questionDoc);
      } catch (socketErr) {
        console.error("Socket emit error:", socketErr);
      }
    }

    return res.status(201).json(questionDoc);
  } catch (error) {
    console.error("Post Answer Error:", error);
    return res.status(500).json({ message: "Error posting answer" });
  }
});

module.exports = router;