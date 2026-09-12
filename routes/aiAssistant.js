const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai'); // 🔥 Switched entirely to Gemini SDK
const { availableTools } = require('../utils/aiTools');
const { protect } = require('../middleware/authMiddleware');
const { Ticket } = require('../models');
const webpush = require('web-push');

// ==========================================
// 🔑 HELPER: MULTI-KEY ROTATION FOR GEMINI
// ==========================================
function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim()) keys.push(key);
  }
  return [...new Set(keys)];
}

// ==========================================
// 🤖 GEMINI AI CORE HANDLER
// ==========================================
async function callGeminiAI({ messages, systemPrompt, temperature = 0.3, tools = null }) {
  const apiKeys = getGeminiKeys();
  if (apiKeys.length === 0) throw new Error("Gemini API Keys are missing!");

  let lastError = null;

  // Transform standard OpenAI/Groq messages to Gemini format
  const formattedContents = messages.map(m => {
    if (m.role === 'assistant') {
      if (m.tool_calls) {
        return {
          role: 'model',
          parts: m.tool_calls.map(tc => ({
            functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) }
          }))
        };
      }
      return { role: 'model', parts: [{ text: m.content || "" }] };
    }
    
    if (m.role === 'tool') {
      return {
        role: 'user', // Gemini processes tool outputs as user/function roles
        parts: [{
          functionResponse: {
            name: m.name,
            response: { result: m.content }
          }
        }]
      };
    }
    
    return { 
      role: 'user', 
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] 
    };
  });

  for (const key of apiKeys) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const modelConfig = {
        model: "gemini-3.5-flash",
        systemInstruction: systemPrompt,
        generationConfig: { temperature }
      };

      if (tools) {
        modelConfig.tools = [{ functionDeclarations: tools }];
      }

      const model = genAI.getGenerativeModel(modelConfig);
      const result = await model.generateContent({ contents: formattedContents });
      const response = result.response;
      
      const functionCalls = response.functionCalls();
      let textContent = "";
      try { textContent = response.text(); } catch (e) { /* text might be empty if function is called */ }

      return {
        provider: "Gemini",
        message: {
          content: textContent,
          tool_calls: functionCalls ? functionCalls.map(call => ({
            function: {
              name: call.name,
              arguments: JSON.stringify(call.args)
            }
          })) : []
        }
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini API providers failed.");
}

// ==========================================
// 📱 HELPER: DISPATCH PWA PUSH ALERTS
// ==========================================
async function sendPushNotificationAlert(subscriptions, title, body, url = '/') {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && subscriptions && subscriptions.length > 0) {
    webpush.setVapidDetails(
      'mailto:support@thejackessentials.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const payload = JSON.stringify({ title, body, url });
    
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        console.error("Error pushing notification:", err);
      }
    }
  }
}

// ==========================================
// 🤖 GEMINI AI ASSISTANT ROUTE WITH FUNCTION CALLING
// ==========================================
router.post('/api/ai/chat', protect, async (req, res) => {
  try {
    const { messages } = req.body; 
    const userId = req.user ? req.user._id.toString() : null;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: "Messages array is required" });
    }

    // 1. Define tool schemas for Gemini (Native Format)
    const toolsDefinition = [
      {
        name: "searchProducts",
        description: "Search products in the store database based on text query, category, max price, or brand.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Search keyword like phone, shoes, laptop" },
            category: { type: "STRING", description: "Category name like Electronics, Fashion" },
            maxPrice: { type: "NUMBER", description: "Maximum budget in rupees" },
            brand: { type: "STRING", description: "Brand name" }
          }
        }
      },
      {
        name: "compareProducts",
        description: "Compare specs and pricing of two products side-by-side using their IDs.",
        parameters: {
          type: "OBJECT",
          properties: {
            productId1: { type: "STRING", description: "First Product ID" },
            productId2: { type: "STRING", description: "Second Product ID" }
          },
          required: ["productId1", "productId2"]
        }
      },
      {
        name: "checkStock",
        description: "Check live inventory/stock status of a specific product.",
        parameters: {
          type: "OBJECT",
          properties: {
            productId: { type: "STRING", description: "Product ID to check stock for" }
          },
          required: ["productId"]
        }
      },
      {
        name: "checkDelivery",
        description: "Check delivery serviceability and estimated days for a given 6-digit pincode.",
        parameters: {
          type: "OBJECT",
          properties: {
            pincode: { type: "STRING", description: "6-digit delivery pincode" }
          },
          required: ["pincode"]
        }
      },
      {
        name: "trackOrder",
        description: "Track an existing order status using the Order ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            orderId: { type: "STRING", description: "Order ID to track" }
          },
          required: ["orderId"]
        }
      }
    ];

    const systemPrompt = "You are an intelligent, helpful e-commerce shopping assistant for Jack Essentials. Use the provided tools to answer user queries accurately regarding products, stock, deliveries, and order tracking. Never fabricate product links or pricing—always use the tool data.";

    // 2. First call to Gemini
    const aiCallResult = await callGeminiAI({
      messages,
      systemPrompt,
      temperature: 0.3,
      tools: toolsDefinition
    });

    const responseMessage = aiCallResult.message;

    // 3. Check if AI invoked a tool function
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

      if (functionName === 'trackOrder' && userId) {
        functionArgs.userId = userId;
      }

      // Execute the tool
      let toolResult = {};
      if (availableTools[functionName]) {
        toolResult = await availableTools[functionName](functionArgs);
      } else {
        toolResult = { error: "Requested tool function not found." };
      }

      // 4. Send tool output back to Gemini
      const followUpMessages = [
        ...messages,
        responseMessage,
        {
          role: "tool",
          name: functionName,
          content: JSON.stringify(toolResult)
        }
      ];

      const followUpResult = await callGeminiAI({
        messages: followUpMessages,
        systemPrompt: "You are a helpful e-commerce shopping assistant.",
        temperature: 0.3
      });

      return res.json({
        success: true,
        providerUsed: followUpResult.provider,
        message: followUpResult.message.content
      });
    }

    // 5. Normal text response
    return res.json({
      success: true,
      providerUsed: aiCallResult.provider,
      message: responseMessage.content
    });

  } catch (error) {
    console.error("AI Assistant Chat Error:", error);
    res.status(500).json({ success: false, message: "AI Assistant error", error: error.message });
  }
});


// ==========================================
// 🛠️ AI CATALOG ASSISTANT
// ==========================================
router.post('/api/ai/parse-catalog', protect, async (req, res) => {
  try {
    const { rawAiOutput } = req.body; 

    let finalJson = {};
    let parseAttempts = 0;
    const maxRetries = 2;

    while (parseAttempts <= maxRetries) {
      try {
        let cleanText = rawAiOutput;
        if (typeof rawAiOutput === 'string') {
          cleanText = rawAiOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        finalJson = JSON.parse(cleanText);
        break; 
      } catch (parseError) {
        parseAttempts++;
        console.warn(`⚠️ JSON Parse Attempt ${parseAttempts} failed:`, parseError.message);
        
        if (parseAttempts > maxRetries) {
          return res.status(502).json({
            success: false,
            error: "Bad Gateway",
            message: "AI returned malformed JSON structure after retries. Listing quality score verification failed.",
            rawSnippet: typeof rawAiOutput === 'string' ? rawAiOutput.substring(0, 100) : ''
          });
        }
      }
    }

    return res.json({
      success: true,
      data: finalJson
    });

  } catch (error) {
    console.error("Catalog Parsing Error:", error);
    return res.status(502).json({ 
      success: false, 
      error: "Bad Gateway", 
      message: error.message 
    });
  }
});


// ==========================================
// 📊 AI BUSINESS COPILOT
// ==========================================
router.post('/api/ai/copilot-analysis', protect, async (req, res) => {
  try {
    const { adminQuery } = req.body; 

    const storeTelemetry = {
      trafficChangePercent: "+18%",
      conversionChangePercent: "-31%",
      topProductStatus: "Out of stock",
      codOrdersChangePercent: "+14%",
      rtoRiskChangePercent: "+9%",
      activeCampaigns: 2,
      pricingIssuesDetected: false
    };

    const copilotPrompt = `
      You are an expert e-commerce Business Copilot for Jack Essentials. 
      The admin is asking: "${adminQuery}"
      
      Here is the current live store telemetry data:
      - Traffic: ${storeTelemetry.trafficChangePercent}
      - Conversion: ${storeTelemetry.conversionChangePercent}
      - Top product status: ${storeTelemetry.topProductStatus}
      - COD orders: ${storeTelemetry.codOrdersChangePercent}
      - RTO risk: ${storeTelemetry.rtoRiskChangePercent}

      Analyze this data and provide a concise root-cause breakdown in bullet points, ending with the primary issue.
    `;

    const aiResult = await callGeminiAI({
      messages: [{ role: "user", content: copilotPrompt }],
      systemPrompt: "You are a sharp, data-driven e-commerce business analyst.",
      temperature: 0.2
    });

    return res.json({
      success: true,
      providerUsed: aiResult.provider,
      metrics: storeTelemetry,
      analysis: aiResult.message.content
    });

  } catch (error) {
    console.error("Business Copilot Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Business Copilot failed to analyze store metrics", 
      error: error.message 
    });
  }
});


// ==========================================
// 💬 ENTERPRISE SUPPORT HELPDESK & AI TICKET ANALYSIS
// ==========================================
router.post('/api/ai/ticket-analysis', protect, async (req, res) => {
  try {
    const { ticketId, messageText } = req.body;

    if (!messageText) {
      return res.status(400).json({ success: false, message: "Message text is required for ticket analysis." });
    }

    const ticketPrompt = `
      Analyze the following customer support message for an e-commerce store:
      "${messageText}"

      Classify and return a strict JSON response with no markdown formatting outside JSON (or clean it):
      {
        "aiCategory": "Shipping" | "Billing" | "Product Issue" | "Returns & Refund" | "General Inquiry" | "Other",
        "priority": "Low" | "Medium" | "High" | "Urgent",
        "sentiment": "Positive" | "Neutral" | "Negative",
        "suggestedResponse": "A polite, helpful draft response for the support agent"
      }
    `;

    const aiResult = await callGeminiAI({
      messages: [{ role: "user", content: ticketPrompt }],
      systemPrompt: "You are an automated AI support dispatcher for Jack Essentials. Return valid JSON only.",
      temperature: 0.1
    });

    let analysisData = {};
    try {
      let rawText = aiResult.message.content;
      if (typeof rawText === 'string') {
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      analysisData = JSON.parse(rawText);
    } catch (parseErr) {
      analysisData = {
        aiCategory: "General Inquiry",
        priority: "Medium",
        sentiment: "Neutral",
        suggestedResponse: "Thank you for reaching out. Our support team will assist you shortly."
      };
    }

    if (ticketId) {
      await Ticket.findByIdAndUpdate(ticketId, {
        $set: {
          aiCategory: analysisData.aiCategory || "General Inquiry",
          priority: analysisData.priority || "Medium",
          sentiment: analysisData.sentiment || "Neutral"
        }
      });
    }

    return res.json({
      success: true,
      providerUsed: aiResult.provider,
      analysis: analysisData
    });

  } catch (error) {
    console.error("Ticket AI Analysis Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "AI Ticket Analysis failed", 
      error: error.message 
    });
  }
});

module.exports = router;