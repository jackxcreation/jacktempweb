// services/support/aiOrchestrator.js
const { GoogleGenAI } = require('@google/genai');
const { getOrderStatus } = require('./tools/orderTools');
const { enforceResponsePolicy } = require('./responsePolicy'); // 🔥 TASK #36: Anti-hallucination guard
const { detectLanguage, getLanguageInstruction } = require('./languageService'); // 🔥 TASK #37: Language detection & matching
const { evaluateEscalation } = require('./escalationPolicy'); // 🔥 TASK #38: Deterministic escalation policy
const { Ticket, Order } = require('../../models');

/**
 * Enterprise AI Support Orchestrator with Business-Data Tool / Function Calling (Task #35),
 * Anti-Hallucination Policy (Task #36), Multi-Language Auto-Detection (Task #37),
 * Deterministic Escalation Evaluation (Task #38), and Task #67 AI Suggested Reply for Agents.
 */
class AIOrchestrator {
  constructor() {
    // Tool declarations for Gemini function calling
    this.toolsConfig = [
      {
        functionDeclarations: [
          {
            name: 'getOrderStatus',
            description: 'Fetches real-time authoritative order status, tracking AWB, payment status, and delivery details for a customer order.',
            parameters: {
              type: 'OBJECT',
              properties: {
                orderId: {
                  type: 'STRING',
                  description: 'The MongoDB ObjectId or Order Number of the order to look up.'
                }
              },
              required: []
            }
          }
        ]
      }
    ];
  }

  /**
   * Executes AI generation with dynamic tool handling, language adaptation, policy enforcement, and escalation evaluation.
   */
  async processQuery({ message, chatHistory = [], userId, apiKeys = [] }) {
    const keys = apiKeys.length > 0 ? apiKeys : [process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY];
    if (!keys || keys.length === 0 || !keys[0]) {
      throw new Error('Gemini API keys are missing configuration.');
    }

    // 🔥 TASK #38: Check deterministic escalation triggers before calling expensive LLM
    const escalationCheck = evaluateEscalation(message, chatHistory);
    if (escalationCheck.shouldEscalate) {
      const detectedLang = detectLanguage(message);
      let escalationReply = "Mujhe lagta hai ki is mamle mein aapko human support agent se baat karni chahiye. Main aapki chat transfer kar raha hoon. [TRANSFER_TO_AGENT]";
      
      if (detectedLang === 'english') {
        escalationReply = "This requires personal attention from our support team. Transferring you to a human agent now. [TRANSFER_TO_AGENT]";
      }

      return {
        reply: escalationReply,
        toolExecuted: null,
        detectedLanguage: detectedLang,
        shouldEscalate: true,
        escalationReason: escalationCheck.reason
      };
    }

    // 🔥 TASK #37: Automatically detect user language
    const detectedLang = detectLanguage(message);
    const langInstruction = getLanguageInstruction(detectedLang);

    const baseSystemInstruction = 
      "You are an official, authoritative, and helpful AI support assistant for Jack Essentials e-commerce store. " +
      "You have direct database tools available to look up real-time order statuses, shipments, and store policies. " +
      "Always use the provided tools when a customer asks about their specific order or shipping status. Never guess order details.";

    const systemInstruction = `${baseSystemInstruction}\n\n${langInstruction}`;

    const formattedContents = [];
    (chatHistory || []).slice(-10).forEach(msg => {
      formattedContents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : (msg.text || '') }]
      });
    });
    formattedContents.push({ role: 'user', parts: [{ text: message }] });

    let lastError = null;
    let aiResponse = null;

    for (const apiKey of keys) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: formattedContents,
          config: {
            systemInstruction,
            tools: this.toolsConfig,
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        });
        aiResponse = response;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('All Gemini API keys failed during orchestration.');
    }

    const functionCalls = aiResponse.functionCalls;
    let toolExecutedName = null;
    let toolResult = null;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const { name, args } = call;
      toolExecutedName = name;
      toolResult = { error: 'Requested tool not found.' };

      if (name === 'getOrderStatus') {
        toolResult = await getOrderStatus(args || {}, userId);
      }

      // 🔥 TASK #36: Enforce Response Policy & Anti-Hallucination Check
      const policyCheck = enforceResponsePolicy(message, toolExecutedName, toolResult);
      if (!policyCheck.safe) {
        return {
          reply: policyCheck.fallbackReply,
          toolExecuted: toolExecutedName,
          detectedLanguage: detectedLang,
          shouldEscalate: true,
          escalationReason: 'ANTI_HALLUCINATION_FALLBACK'
        };
      }

      for (const apiKey of keys) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const followUpResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              ...formattedContents,
              { role: 'model', parts: [{ functionCall: call }] },
              { role: 'function', parts: [{ functionResponse: { name, response: toolResult } }] }
            ],
            config: {
              systemInstruction,
              temperature: 0.3,
              maxOutputTokens: 1024
            }
          });

          const responseText = (followUpResponse.text || '').trim();
          const postToolEscalation = evaluateEscalation(responseText, chatHistory);

          return {
            reply: responseText,
            toolExecuted: toolExecutedName,
            detectedLanguage: detectedLang,
            shouldEscalate: postToolEscalation.shouldEscalate,
            escalationReason: postToolEscalation.reason
          };
        } catch (err) {
          lastError = err;
        }
      }
    }

    const policyCheck = enforceResponsePolicy(message, toolExecutedName, toolResult);
    if (!policyCheck.safe) {
      return {
        reply: policyCheck.fallbackReply,
        toolExecuted: null,
        detectedLanguage: detectedLang,
        shouldEscalate: true,
        escalationReason: 'ANTI_HALLUCINATION_FALLBACK'
      };
    }

    const finalReplyText = (aiResponse.text || '').trim();
    const finalEscalationCheck = evaluateEscalation(finalReplyText, chatHistory);

    return {
      reply: finalReplyText,
      toolExecuted: null,
      detectedLanguage: detectedLang,
      shouldEscalate: finalEscalationCheck.shouldEscalate,
      escalationReason: finalEscalationCheck.reason
    };
  }

  /**
   * 🔥 TASK #67: Generates an AI suggested reply for support agents (Manual Approval Required).
   * Returns reply, reason, confidence, and source/tool telemetry.
   */
  async generateSuggestedReplyService(ticketId, apiKeys = []) {
    const keys = apiKeys.length > 0 ? apiKeys : [process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY];
    try {
      const ticket = await Ticket.findById(ticketId).lean();
      if (!ticket) {
        throw new Error("Ticket not found for AI suggestion");
      }

      let orderContext = null;
      if (ticket.orderId) {
        orderContext = await Order.findOne({ $or: [{ _id: ticket.orderId }, { orderNumber: ticket.orderId }] }).lean();
      }

      const lastCustomerMsg = ticket.messages?.slice(-1)[0]?.text || ticket.subject;

      const prompt = `You are an expert e-commerce customer support AI for Jack Essentials.
Analyze the customer message and return a strictly valid JSON object (no markdown formatting blocks) with these exact keys:
{
  "reply": "Professional helpful response for the agent to review and approve",
  "reason": "Policy reason or context justification for the suggestion",
  "confidence": 95,
  "sourceResult": "Summary of order status or tool telemetry used"
}

Customer Message: "${lastCustomerMsg}"
Category: ${ticket.category}
Order Details: ${orderContext ? JSON.stringify({ status: orderContext.status, total: orderContext.totalAmount }) : 'No linked order'}`;

      let rawText = '';
      for (const apiKey of keys) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { temperature: 0.2 }
          });
          rawText = response.text || '';
          break;
        } catch (e) {}
      }

      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsedData;
      try {
        parsedData = JSON.parse(rawText);
      } catch (e) {
        parsedData = {
          reply: "Hello, thank you for contacting Jack Essentials support. I have noted your request and am here to assist you.",
          reason: "Standard policy fallback alignment",
          confidence: 90,
          sourceResult: orderContext ? `Order #${orderContext._id}` : "General Support Inquiry"
        };
      }

      return {
        success: true,
        suggestion: {
          reply: parsedData.reply,
          reason: parsedData.reason || 'Standard support guideline',
          confidence: parsedData.confidence || 95,
          sourceResult: parsedData.sourceResult || 'System database lookup'
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to generate AI suggestion"
      };
    }
  }
}

const aiOrchestrator = new AIOrchestrator();

module.exports = {
  aiOrchestrator,
  AIOrchestrator
};