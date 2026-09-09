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

// ✅ LANGUAGE DETECTOR PRESERVED
export const detectLanguageStyle = (text = "") => {
  const lower = text.toLowerCase();
  const hinglishWords = ["bhai", "kya", "kaise", "mera", "mujhe", "kr", "kar", "acha", "haan", "nahi", "kyu", "tum", "aap", "jaldi", "order", "refund"];
  const hasHinglish = hinglishWords.some(word => lower.includes(word));
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

// ✅ AI RESPONSE FUNCTION PRESERVED
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
      ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || localStorage.getItem('jack_token')) 
      : null
  );

  const languageStyle = detectLanguageStyle(userText);
  const systemInstruction = createSystemPrompt({ contextData, user, languageStyle });

  const chatHistory = messages
    .filter((m) => m.text !== "[TRANSFER_TO_AGENT]" && m.sender !== "admin" && m.type !== "system")
    .map((m) => ({
      role: m.sender === "bot" ? "assistant" : "user",
      content: m.text || ""
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
    return data.reply || data.text || fallbackMessage;
  } catch (error) {
    if (error.name === 'AbortError') return null; // Silently handle cancellations
    console.error("Backend API Error:", error);
    return fallbackMessage;
  }
};

// ✅ BOT RESPONSE PARSER (UPGRADED FOR RICH CARDS)
export const processBotResponse = (rawBotResponse = "") => {
  let finalBotText = typeof rawBotResponse === 'string' ? rawBotResponse.trim() : "";
  let triggerEscalation = false;
  let structuredData = null;

  // 1. Check for strict escalation tag
  if (finalBotText.includes("[TRANSFER_TO_AGENT]")) {
    finalBotText = "I have created a support ticket for you ✅ A live agent will connect with you shortly.";
    triggerEscalation = true;
    return { finalBotText, triggerEscalation, structuredData };
  }

  // 2. Parse AI structured JSON blocks (```json ... ```)
  const jsonRegex = /```json\n([\s\S]*?)\n```/;
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