// routes/chatRoutes.js
import express from 'express';
import Groq from "groq-sdk";

const router = express.Router();

// Initialize Groq client securely using environment variable
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/', async (req, res) => {
  try {
    const { message, chatHistory, systemInstruction, languageStyle } = req.body;

    // Check if Groq API key is configured properly
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is missing in environment variables!");
      return res.status(500).json({ 
        error: "Groq API key not configured on server", 
        reply: languageStyle === 'hinglish' 
          ? "Bhai, server par AI key configure nahi hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
          : "AI service configuration error. Let me connect you with a human agent. [TRANSFER_TO_AGENT]" 
      });
    }

    // Format messages for Groq LLM
    const messages = [
      { role: "system", content: systemInstruction || "You are a helpful support assistant for Jack Essentials." },
      ...(chatHistory || []),
      { role: "user", content: message }
    ];

    // Call Groq Cloud API
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const replyText = completion.choices[0]?.message?.content || "[TRANSFER_TO_AGENT]";

    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Groq Chat API Error on Server:", error);
    return res.status(500).json({ 
      error: "Failed to fetch AI response", 
      reply: req.body?.languageStyle === 'hinglish' 
        ? "Bhai, abhi thoda technical issue aa raha hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
        : "I'm experiencing a minor glitch. Let me connect you with a human agent. [TRANSFER_TO_AGENT]" 
    });
  }
});

export default router;