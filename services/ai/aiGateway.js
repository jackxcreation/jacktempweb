const { GoogleGenerativeAI } = require("@google/generative-ai");

const MAX_RETRIES = 2;

/**
 * Helper: Multi-key rotation for Gemini across the AI Gateway
 */
function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim()) keys.push(key);
  }
  return [...new Set(keys)];
}

/**
 * Universal wrapper for calling the LLM with multi-key rotation and dynamic model support
 */
const callLLM = async (messages, requestedModel = "gemini-3.5-flash", jsonMode = false) => {
  const apiKeys = getGeminiKeys();
  if (apiKeys.length === 0) {
    throw new Error('AI Service configuration missing (GEMINI_API_KEY is not set).');
  }

  let lastError = null;

  // Format messages once to reuse across key attempts
  let systemInstruction = "";
  const formattedContents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else {
      formattedContents.push({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
      });
    }
  }

  const generationConfig = {
    temperature: 0.3, // Lower temperature for more factual responses
    maxOutputTokens: 1000,
  };

  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  // Loop through available API keys for fault tolerance and rotation
  for (const key of apiKeys) {
    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      try {
        const genAI = new GoogleGenerativeAI(key);

        // 🔥 FIX: Use the requested model parameter dynamically instead of hardcoding
        const geminiModel = genAI.getGenerativeModel({
          model: requestedModel || "gemini-3.5-flash", 
          systemInstruction: systemInstruction || undefined
        });

        const result = await geminiModel.generateContent({
          contents: formattedContents,
          generationConfig
        });
        
        const content = result.response.text();
        
        if (jsonMode) {
          try {
            return JSON.parse(content);
          } catch (parseErr) {
            // Fallback cleaning if markdown code blocks wrap the JSON
            let cleanText = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
          }
        }
        return content;

      } catch (error) {
        attempt++;
        lastError = error;
        console.error(`AI Gateway Error (Key ending in ...${key.slice(-4)}, Attempt ${attempt}):`, error.message);
        
        if (attempt > MAX_RETRIES) {
          // Break inner retry loop to try the next available API key
          break;
        }
        // Small delay before retry with the same key
        await new Promise(res => setTimeout(res, 1000 * attempt));
      }
    }
  }

  throw new Error(`AI Provider failed across all keys. Last error: ${lastError?.message || 'Unknown'}`);
};

module.exports = { callLLM };