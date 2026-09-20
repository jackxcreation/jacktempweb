// routes/chatRoutes.js
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // 🔥 FIXED: Changed to CommonJS require

const router = express.Router();

// 🔥 TASK #49: IMPORT STANDARDIZED API RESPONSE HELPERS
const { sendSuccess, sendError } = require('../utils/apiResponse');

// 🔥 TASK #50 & #45: IMPORT STRUCTURED LOGGER & SANITIZER
const { logger, logInfo, logError, logWarn } = require('../utils/logger');

// 🔥 TASK #47: IMPORT GRANULAR CHAT RATE LIMITER
const { chatLimiter } = require('../middleware/rateLimit');

// 🔥 TASK #48: IMPORT CENTRALIZED ZOD VALIDATORS FOR SUPPORT/CHAT
const { supportMessageValidator } = require('../validators/support');

router.post('/', chatLimiter, async (req, res) => {
  try {
    // 🔥 TASK #48: Strict Zod Input Validation
    const validationResult = supportMessageValidator.safeParse({
      conversationId: req.body.conversationId || 'default-conv',
      content: req.body.message || ''
    });

    if (!validationResult.success) {
      return sendError(
        res, 
        'VALIDATION_FAILED', 
        "Validation failed", 
        400, 
        req, 
        validationResult.error.format()
      );
    }

    const { message, chatHistory, systemInstruction, languageStyle } = req.body;

    // Check if Gemini API key is configured properly
    if (!process.env.GEMINI_API_KEY) {
      logError("GEMINI_API_KEY is missing in environment variables!", null, { requestId: req.requestId });
      return res.status(500).json({ 
        success: false,
        code: 'AI_CONFIG_MISSING',
        error: "Gemini API key not configured on server", 
        reply: languageStyle === 'hinglish' 
          ? "Bhai, server par AI key configure nahi hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
          : "AI service configuration error. Let me connect you with a human agent. [TRANSFER_TO_AGENT]",
        requestId: req.requestId
      });
    }

    // Initialize Gemini client securely using environment variable
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 🔥 FIXED: Bulletproof History Formatting (Squashes consecutive roles & enforces alternating logic)
    let formattedHistory = [];
    
    if (chatHistory && Array.isArray(chatHistory)) {
      let lastRole = null;

      chatHistory.forEach(msg => {
        // Force mapped roles to be ONLY 'user' or 'model'
        const mappedRole = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
        
        let text = "";
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          text = "[System checked internal data]";
        } else if (msg.role === 'tool') {
          text = `[System Tool Data]: ${msg.content || "Success"}`;
        } else if (msg.content) {
          text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        }

        if (text) {
          if (lastRole === mappedRole) {
            // CRITICAL: If the same role speaks twice, append to the last message to avoid crashing Gemini
            formattedHistory[formattedHistory.length - 1].parts[0].text += `\n${text}`;
          } else {
            // Otherwise, add a new history entry
            formattedHistory.push({ role: mappedRole, parts: [{ text: text }] });
            lastRole = mappedRole;
          }
        }
      });
    }

    // 🔥 Gemini STRICTLY requires the first message in history to be from the 'user'
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.shift();
    }

    const serverSystemInstruction = systemInstruction || "You are a helpful support assistant for Jack Essentials. Do NOT answer anything unrelated to the store.";

    // 🔥 FIXED: Changed non-existent 3.5-flash to the stable gemini-1.5-flash
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: serverSystemInstruction
    });

    // Start chat session with safely parsed history
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    });

    // Call Gemini API
    const result = await chat.sendMessage(message);
    const replyText = result.response.text().trim() || "[TRANSFER_TO_AGENT]";

    return sendSuccess(res, { reply: replyText }, "AI response generated successfully", 200, req);

  } catch (error) {
    logError("Gemini Chat API Error on Server:", error, { requestId: req.requestId });
    
    return res.status(500).json({ 
      success: false,
      code: 'AI_CHAT_FAILED',
      error: error.message || "Failed to fetch AI response", 
      reply: req.body?.languageStyle === 'hinglish' 
        ? "Bhai, abhi thoda technical issue aa raha hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
        : "I'm experiencing a minor glitch. Let me connect you with a human agent. [TRANSFER_TO_AGENT]",
      requestId: req.requestId
    }); 
  }
});

// 🔥 FIXED: CommonJS Export
module.exports = router;