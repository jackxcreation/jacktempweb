const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { availableTools } = require('../utils/aiTools');
const { protect } = require('../middleware/authMiddleware'); // Optional if you want authenticated user context

// Initialize Groq client securely using environment variable
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ==========================================
// 🤖 GROQ AI ASSISTANT ROUTE WITH FUNCTION CALLING
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

    // 2. First call to Groq with tools enabled
    const initialResponse = await groq.chat.completions.create({
      model: "llama3-70b-8192", // High-performance Groq Llama model for tool use
      messages: [
        {
          role: "system",
          content: "You are an intelligent, helpful e-commerce shopping assistant for Jack Essentials. Use the provided tools to answer user queries accurately regarding products, stock, deliveries, and order tracking. Never fabricate product links or pricing—always use the tool data."
        },
        ...messages
      ],
      tools: toolsDefinition,
      tool_choice: "auto",
      temperature: 0.3
    });

    const responseMessage = initialResponse.choices[0].message;

    // 3. Check if Groq decided to invoke a tool function
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

      // 4. Send tool output back to Groq so it can formulate the final natural response
      const followUpResponse = await groq.chat.completions.create({
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: "You are a helpful e-commerce shopping assistant." },
          ...messages,
          responseMessage,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            name: functionName,
            content: JSON.stringify(toolResult)
          }
        ],
        temperature: 0.3
      });

      return res.json({
        success: true,
        message: followUpResponse.choices[0].message.content
      });
    }

    // If no tool was needed, return regular LLM response
    return res.json({
      success: true,
      message: responseMessage.content
    });

  } catch (error) {
    console.error("AI Assistant Chat Error:", error);
    res.status(500).json({ success: false, message: "AI Assistant error", error: error.message });
  }
});

module.exports = router;