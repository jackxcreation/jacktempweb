// routes/chatRoutes.js
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai'; // 🔥 Switched to Gemini SDK

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

    // Format messages for Gemini LLM (Gemini uses 'model' instead of 'assistant')
    const formattedHistory = (chatHistory || []).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || "" }]
    }));

    const serverSystemInstruction = systemInstruction || "You are a helpful support assistant for Jack Essentials.";

    // Initialize the Gemini model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash",
      systemInstruction: serverSystemInstruction
    });

    // Start chat session with history
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
      error: "Failed to fetch AI response", 
      reply: req.body?.languageStyle === 'hinglish' 
        ? "Bhai, abhi thoda technical issue aa raha hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
        : "I'm experiencing a minor glitch. Let me connect you with a human agent. [TRANSFER_TO_AGENT]" 
    });
  }
});

export default router;