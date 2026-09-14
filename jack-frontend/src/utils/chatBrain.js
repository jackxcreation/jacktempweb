// utils/chatBrain.js

// ✅ QUICK OPTIONS PRESERVED
export const predefinedOptions = [
  { label: "Track my order", reply: "track_order" },
  { label: "Cancel order", reply: "cancel_order" },
  { label: "Return & Refund", reply: "return_refund" },
  { label: "Update Profile", reply: "update_profile" },
  { label: "Latest Offers", reply: "latest_offers" },
  { label: "Talk to Human", reply: "[TRANSFER_TO_AGENT]" }
];

// ✅ LANGUAGE DETECTOR UPGRADED (Regex Word Boundaries added to prevent false positives)
export const detectLanguageStyle = (text = "") => {
  const cleanText = String(text || "").toLowerCase();
  const hinglishWords = [
    "bhai", "kya", "kaise", "mera", "mujhe", "kr", "kar", 
    "acha", "haan", "nahi", "kyu", "tum", "aap", "jaldi", 
    "kab", "ayega", "kahan", "hoga", "hai", "hain", "karna", 
    "karo", "paisa", "payment", "chal", "chahiye", "wala", 
    "bhejo", "dekh", "kaha", "mat"
  ];
  const hasHinglish = hinglishWords.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(cleanText);
  });
  return hasHinglish ? "hinglish" : "english";
};

// ✅ SYSTEM PROMPT PRESERVED & ENHANCED FOR STRUCTURED OUTPUT
export const createSystemPrompt = ({ contextData, user, languageStyle }) => {
  return `
You are "Jack", the official AI Support Agent & Smart ERP Manager for Jack Essentials.

━━━━━━━━━━━━━━━━━━
🔥 LANGUAGE RULE
- ALWAYS reply in SAME language as user.
- English user → English reply. Hinglish user → Hinglish reply.
- Sound natural and human.

━━━━━━━━━━━━━━━━━━
🔥 YOUR CAPABILITIES
You can track orders, help with refunds/returns, update profiles, and escalate to humans.

━━━━━━━━━━━━━━━━━━
🔥 ORDER & USER CONTEXT
Current Order Context: ${contextData ? JSON.stringify(contextData) : "No specific order selected"}
Current User: ${user ? JSON.stringify(user) : "Guest User"}

━━━━━━━━━━━━━━━━━━
🔥 STRUCTURED RESPONSES (PREMIUM UI)
If you have exact backend data for an order or product, you may return a JSON block formatted exactly like this to render a rich card:
\`\`\`json
{
  "type": "order_tracking",
  "data": { "orderId": "123", "status": "SHIPPED", "expectedDelivery": "2026-09-12" }
}
\`\`\`
If you do not have exact data, just reply with natural conversational text.

━━━━━━━━━━━━━━━━━━
🔥 HUMAN ESCALATION
If user is angry, abusive, frustrated, or explicitly asks for human:
Reply EXACTLY: [TRANSFER_TO_AGENT]
`;
};

// ✅ AI RESPONSE FUNCTION PRESERVED & FIXED FOR NEW BACKEND
export const fetchAIResponse = async ({
  userText,
  messages,
  contextData,
  user,
  BACKEND_API_URL,
  token,
  signal // Added for abort capability
}) => {
  const activeToken = token || (
    typeof window !== 'undefined' 
      ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || localStorage.getItem('jack_token') || localStorage.getItem('jwt')) 
      : null
  );

  const languageStyle = detectLanguageStyle(userText);
  const systemInstruction = createSystemPrompt({ contextData, user, languageStyle });

  const chatHistory = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && !String(m.text || "").includes("[TRANSFER_TO_AGENT]") && m.sender !== "admin" && m.type !== "system")
    .map((m) => ({
      // 🔥 CRITICAL FIX: Changed 'assistant' to 'model' to match strict Gemini API requirements
      role: (m.sender === "bot" || m.sender === "model") ? "model" : "user",
      content: m.text || m.content || ""
    }));

  const fallbackMessage = languageStyle === 'hinglish'
    ? "Sorry bhai, network issue lag raha hai. Kya aap wapas try kar sakte ho?"
    : "I'm having trouble connecting right now. Could you please try again?";

  try {
    const headers = { "Content-Type": "application/json" };
    if (activeToken) {
      headers["Authorization"] = `Bearer ${activeToken}`;
    }

    const response = await fetch(BACKEND_API_URL, {
      method: "POST",
      headers,
      credentials: "include",
      signal,
      body: JSON.stringify({
        message: userText,
        chatHistory,
        systemInstruction,
        contextOrder: contextData,
        userData: user,
        languageStyle
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    // 🔥 ROBUST PAYLOAD EXTRACTION: Handles all backend response variations safely
    return data?.message?.content || data?.reply || data?.text || data?.message || fallbackMessage;
    
  } catch (error) {
    if (error.name === 'AbortError') return null; // Silently handle cancellations
    console.error("Backend API Error:", error);
    return fallbackMessage;
  }
};

// ✅ BOT RESPONSE PARSER (UPGRADED & SYNTAX FIXED)
export const processBotResponse = (rawBotResponse = "") => {
  let finalBotText = typeof rawBotResponse === 'string' ? rawBotResponse.trim() : "";
  let triggerEscalation = false;
  let structuredData = null;

  // 1. 🔥 CRITICAL FIX: Use global regex to wipe hallucinated tags, but DON'T return early so JSON can still parse
  if (finalBotText.includes("[TRANSFER_TO_AGENT]")) {
    finalBotText = finalBotText.replace(/\[TRANSFER_TO_AGENT\]/g, "").trim() || "I have created a support ticket for you ✅ A live agent will connect with you shortly.";
    triggerEscalation = true;
  }

  // 2. Robust markdown JSON block regex supporting any spacing or formatting variations
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = finalBotText.match(jsonRegex);
  
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      structuredData = parsed;
      // Remove the JSON block from text, leave conversational part if any
      finalBotText = finalBotText.replace(jsonRegex, '').trim(); 
    } catch (e) {
      console.error("Failed to parse AI structured data:", e);
    }
  }

  // 3. Fallback for old simple action arrays
  if (!structuredData && finalBotText.startsWith("[") && finalBotText.endsWith("]")) {
    try {
      const actions = JSON.parse(finalBotText);
      const action = actions[0];
      if (action && action.action) {
        if (action.action === "UPDATE_PROFILE") finalBotText = "Done ✅ Profile updated successfully.";
        else if (action.action === "UPDATE_STATUS") finalBotText = "Done ✅ Order status updated.";
        else if (action.action === "SEND_EMAIL") finalBotText = "Email sent successfully 📩 Please check your inbox.";
      }
    } catch (e) {
      console.error("Action parsing failed", e);
    }
  }

  return { finalBotText, triggerEscalation, structuredData };
};