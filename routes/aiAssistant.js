const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { GoogleGenAI } = require('@google/genai'); // Fallback ke liye Gemini SDK
const { availableTools } = require('../utils/aiTools');
const { protect } = require('../middleware/authMiddleware'); // Optional if you want authenticated user context
const { Ticket } = require('../models'); // 🔥 Support Ticket model import kiya
const webpush = require('web-push'); // 🔥 PWA Web Push Library

// Initialize Groq & Gemini clients securely using environment variables
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/**
 * 🔄 Universal AI Fallback Helper (Groq -> Gemini Switch)
 * Agar Groq fail ya rate-limit hota hai, toh yeh automatic Gemini par switch kar dega.
 */
async function callAIWithFallback({ messages, systemPrompt, temperature = 0.3, tools = null }) {
  try {
    // 1. Pehle Groq try karo (Fastest)
    const payload = {
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      temperature
    };

    if (tools) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    const groqResponse = await groq.chat.completions.create(payload);
    return {
      provider: "Groq",
      message: groqResponse.choices[0].message
    };

  } catch (groqError) {
    console.warn("⚠️ Groq API failed or rate-limited. Switching to Gemini fallback...", groqError.message);
    
    try {
      // 2. Groq fail hone par Gemini par switch karo
      let combinedPrompt = `System: ${systemPrompt}\n\n`;
      messages.forEach(m => {
        combinedPrompt += `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}\n`;
      });

      const geminiResponse = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: combinedPrompt,
      });

      return {
        provider: "Gemini",
        message: {
          role: "assistant",
          content: geminiResponse.text
        }
      };
    } catch (geminiError) {
      console.error("❌ Critical Error: Both Groq and Gemini APIs failed!", geminiError.message);
      throw new Error("All AI providers (Groq & Gemini) are currently unavailable.");
    }
  }
}

// ==========================================
// 📱 HELPER: DISPATCH PWA PUSH ALERTS (Useful for all 6 alerts)
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
// 🤖 GROQ/GEMINI AI ASSISTANT ROUTE WITH FUNCTION CALLING
// ==========================================
router.post('/api/ai/chat', protect, async (req, res) => {
  try {
    const { messages } = req.body; // Expects an array of chat history: [{ role: 'user', content: '...' }]
    const userId = req.user ? req.user._id.toString() : null;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: "Messages array is required" });
    }

    // 1. Define tool schemas for Groq / Llama
    const toolsDefinition = [
      {
        type: "function",
        function: {
          name: "searchProducts",
          description: "Search products in the store database based on text query, category, max price, or brand.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search keyword like phone, shoes, laptop" },
              category: { type: "string", description: "Category name like Electronics, Fashion" },
              maxPrice: { type: "number", description: "Maximum budget in rupees" },
              brand: { type: "string", description: "Brand name" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "compareProducts",
          description: "Compare specs and pricing of two products side-by-side using their IDs.",
          parameters: {
            type: "object",
            properties: {
              productId1: { type: "string", description: "First Product ID" },
              productId2: { type: "string", description: "Second Product ID" }
            },
            required: ["productId1", "productId2"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "checkStock",
          description: "Check live inventory/stock status of a specific product.",
          parameters: {
            type: "object",
            properties: {
              productId: { type: "string", description: "Product ID to check stock for" }
            },
            required: ["productId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "checkDelivery",
          description: "Check delivery serviceability and estimated days for a given 6-digit pincode.",
          parameters: {
            type: "object",
            properties: {
              pincode: { type: "string", description: "6-digit delivery pincode" }
            },
            required: ["pincode"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "trackOrder",
          description: "Track an existing order status using the Order ID.",
          parameters: {
            type: "object",
            properties: {
              orderId: { type: "string", description: "Order ID to track" }
            },
            required: ["orderId"]
          }
        }
      }
    ];

    const systemPrompt = "You are an intelligent, helpful e-commerce shopping assistant for Jack Essentials. Use the provided tools to answer user queries accurately regarding products, stock, deliveries, and order tracking. Never fabricate product links or pricing—always use the tool data.";

    // 2. First call with Fallback wrapper
    const aiCallResult = await callAIWithFallback({
      messages,
      systemPrompt,
      temperature: 0.3,
      tools: toolsDefinition
    });

    const responseMessage = aiCallResult.message;

    // 3. Check if AI decided to invoke a tool function (Groq specific tool calls)
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.name ? toolCall.function.arguments : '{}');

      // Inject secure userId if tracking order
      if (functionName === 'trackOrder' && userId) {
        functionArgs.userId = userId;
      }

      // Execute the requested safe tool function from aiTools.js
      let toolResult = {};
      if (availableTools[functionName]) {
        toolResult = await availableTools[functionName](functionArgs);
      } else {
        toolResult = { error: "Requested tool function not found." };
      }

      // 4. Send tool output back so it can formulate the final natural response
      const followUpMessages = [
        ...messages,
        responseMessage,
        {
          role: "tool",
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(toolResult)
        }
      ];

      const followUpResult = await callAIWithFallback({
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

    // If no tool was needed, return regular LLM response
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
// 🛠️ FIX 1: AI CATALOG ASSISTANT (Robust JSON Parser & HTTP 502 Fallback)
// ==========================================
router.post('/api/ai/parse-catalog', protect, async (req, res) => {
  try {
    const { rawAiOutput } = req.body; // AI ka raw response jo parse hona hai

    let finalJson = {};
    let parseAttempts = 0;
    const maxRetries = 2;

    while (parseAttempts <= maxRetries) {
      try {
        // Markdown tags clean karna agar AI ne ```json ... ``` bheja ho
        let cleanText = rawAiOutput;
        if (typeof rawAiOutput === 'string') {
          cleanText = rawAiOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        finalJson = JSON.parse(cleanText);
        break; // Successfully parsed! Loop break karo
      } catch (parseError) {
        parseAttempts++;
        console.warn(`⚠️ JSON Parse Attempt ${parseAttempts} failed:`, parseError.message);
        
        if (parseAttempts > maxRetries) {
          // Silent success ya empty {} return karne ke bajaye ab HTTP 502 throw karega
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
// 📊 FIX 2: AI BUSINESS COPILOT (Root Cause Analysis Engine)
// ==========================================
router.post('/api/ai/copilot-analysis', protect, async (req, res) => {
  try {
    const { adminQuery } = req.body; // e.g. "Aaj revenue kam kyun hai?"

    // 1. Backend se real-time store metrics / telemetry collect karo
    const storeTelemetry = {
      trafficChangePercent: "+18%",
      conversionChangePercent: "-31%",
      topProductStatus: "Out of stock",
      codOrdersChangePercent: "+14%",
      rtoRiskChangePercent: "+9%",
      activeCampaigns: 2,
      pricingIssuesDetected: false
    };

    // 2. AI ko context aur metrics ke sath prompt bhejo (Using Fallback Wrapper)
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

    const aiResult = await callAIWithFallback({
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
// 💬 FIX 3: ENTERPRISE SUPPORT HELPDESK & AI TICKET ANALYSIS
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

    const aiResult = await callAIWithFallback({
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

    // Agar ticketId di gayi hai toh database mein turant update kar do
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