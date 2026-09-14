// routes/chatRoutes.js
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // 🔥 FIXED: Changed to CommonJS require

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, chatHistory, systemInstruction, languageStyle } = req.body;

    // Check if Gemini API key is configured properly
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing in environment variables!");
      return res.status(500).json({ 
        error: "Gemini API key not configured on server", 
        reply: languageStyle === 'hinglish' 
          ? "Bhai, server par AI key configure nahi hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
          : "AI service configuration error. Let me connect you with a human agent. [TRANSFER_TO_AGENT]" 
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

    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Gemini Chat API Error on Server:", error);
    
    return res.status(500).json({ 
      error: error.message || "Failed to fetch AI response", 
      reply: req.body?.languageStyle === 'hinglish' 
        ? "Bhai, abhi thoda technical issue aa raha hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
        : "I'm experiencing a minor glitch. Let me connect you with a human agent. [TRANSFER_TO_AGENT]" 
    });
  }
});

// 🔥 FIXED: CommonJS Export Export
module.exports = router;