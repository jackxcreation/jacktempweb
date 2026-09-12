const { GoogleGenerativeAI } = require("@google/generative-ai");

const MAX_RETRIES = 2;

/**
 * Universal wrapper for calling the LLM
 */
const callLLM = async (messages, model = "gemini-3.5-flash", jsonMode = false) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('AI Service configuration missing (GEMINI_API_KEY).');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      let systemInstruction = "";
      const formattedContents = [];

      // Convert OpenAI/Groq message format to Gemini format
      for (const msg of messages) {
        if (msg.role === 'system') {
          systemInstruction = msg.content;
        } else {
          formattedContents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
          });
        }
      }

      const generationConfig = {
        temperature: 0.3, // Lower temperature for more factual responses
        maxOutputTokens: 1000,
      };

      // Gemini Native JSON Mode Support
      if (jsonMode) {
        generationConfig.responseMimeType = "application/json";
      }

      // Initialize Gemini Model
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-3.5-flash", 
        systemInstruction: systemInstruction || undefined
      });

      // Execute API Call
      const result = await geminiModel.generateContent({
        contents: formattedContents,
        generationConfig
      });
      
      const content = result.response.text();
      
      if (jsonMode) {
        return JSON.parse(content);
      }
      return content;

    } catch (error) {
      attempt++;
      console.error(`AI Gateway Error (Attempt ${attempt}):`, error.message);
      if (attempt > MAX_RETRIES) {
        throw new Error('AI Provider failed after multiple attempts.');
      }
      // Small delay before retry
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
};

module.exports = { callLLM };