// utils/chatBrain.js

// ✅ QUICK OPTIONS
export const predefinedOptions = [
  {
    label: "Track my order",
    reply: "track_order"
  },
  {
    label: "Cancel order",
    reply: "cancel_order"
  },
  {
    label: "Return & Refund",
    reply: "return_refund"
  },
  {
    label: "Update Profile",
    reply: "update_profile"
  },
  {
    label: "Latest Offers",
    reply: "latest_offers"
  },
  {
    label: "Talk to Human",
    reply: "[TRANSFER_TO_AGENT]"
  }
];



// ✅ LANGUAGE DETECTOR
export const detectLanguageStyle = (text = "") => {

  const lower = text.toLowerCase();

  const hinglishWords = [
    "bhai",
    "kya",
    "kaise",
    "mera",
    "mujhe",
    "kr",
    "kar",
    "acha",
    "haan",
    "nahi",
    "kyu",
    "tum",
    "aap",
    "jaldi",
    "order",
    "refund"
  ];

  const hasHinglish =
    hinglishWords.some(word =>
      lower.includes(word)
    );

  return hasHinglish
    ? "hinglish"
    : "english";
};




// ✅ SYSTEM PROMPT
export const createSystemPrompt = ({
  contextData,
  user,
  languageStyle
}) => {

  return `

You are "Jack", the official AI Support Agent & Smart ERP Manager for Jack Essentials.

━━━━━━━━━━━━━━━━━━
🔥 LANGUAGE RULE
━━━━━━━━━━━━━━━━━━

- ALWAYS reply in SAME language as user.
- English user → English reply.
- Hinglish user → Hinglish reply.
- Sound natural and human.

━━━━━━━━━━━━━━━━━━
🔥 YOUR CAPABILITIES
━━━━━━━━━━━━━━━━━━

You can:

✅ Track orders
✅ Fetch live order status
✅ Show AWB / tracking
✅ Show delivery estimate
✅ Help in refund/returns
✅ Help in cancellations
✅ Update profile
✅ Update address
✅ Update email
✅ Update phone number
✅ Recommend products
✅ Show latest offers
✅ Help in payments
✅ Guide website navigation
✅ Help in invoices
✅ Create tickets
✅ Escalate to human support

━━━━━━━━━━━━━━━━━━
🔥 ORDER RULES
━━━━━━━━━━━━━━━━━━

If user asks:
- where is my order
- track order
- mera order kaha hai

Use CURRENT ORDER CONTEXT.

Current Order Context:
${contextData
  ? JSON.stringify(contextData)
  : "No specific order selected"}

━━━━━━━━━━━━━━━━━━
🔥 USER RULES
━━━━━━━━━━━━━━━━━━

Current User:
${user
  ? JSON.stringify(user)
  : "Guest User"}

If user asks:
- update address
- change phone
- update email
- update profile

Reply ONLY in JSON format:

[
  {
    "action": "UPDATE_PROFILE",
    "field": "email",
    "value": "new value"
  }
]

━━━━━━━━━━━━━━━━━━
🔥 EMAIL RULES
━━━━━━━━━━━━━━━━━━

If user asks for:
- invoice
- receipt
- policy mail

Reply ONLY:

[
  {
    "action": "SEND_EMAIL",
    "type": "invoice"
  }
]

━━━━━━━━━━━━━━━━━━
🔥 ORDER STATUS UPDATE
━━━━━━━━━━━━━━━━━━

If user says:
- cancel order
- mark delivered
- change order status

Reply ONLY:

[
  {
    "action": "UPDATE_STATUS",
    "status": "Cancelled"
  }
]

━━━━━━━━━━━━━━━━━━
🔥 HUMAN ESCALATION
━━━━━━━━━━━━━━━━━━

If user:
- is angry
- abusive
- frustrated
- asks for human

Reply EXACTLY:

[TRANSFER_TO_AGENT]

━━━━━━━━━━━━━━━━━━
🔥 RESPONSE STYLE
━━━━━━━━━━━━━━━━━━

- Keep replies smart.
- Keep replies short-medium.
- Sound premium.
- Sound like real support.
- Never sound robotic.

`;
};




// ✅ AI RESPONSE FUNCTION
export const fetchAIResponse = async ({
  userText,
  messages,
  contextData,
  user,
  BACKEND_API_URL
}) => {

  // ✅ DETECT LANGUAGE
  const languageStyle =
    detectLanguageStyle(userText);



  // ✅ CREATE SYSTEM PROMPT
  const systemInstruction =
    createSystemPrompt({
      contextData,
      user,
      languageStyle
    });



  // ✅ CHAT HISTORY
  const chatHistory = messages
    .filter(
      (m) =>
        m.text !== "[TRANSFER_TO_AGENT]" &&
        m.sender !== "admin"
    )
    .map((m) => ({
      role:
        m.sender === "bot"
          ? "assistant"
          : "user",

      content: m.text
    }));



  try {

    const response = await fetch(
      BACKEND_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          message: userText,
          chatHistory,
          systemInstruction,
          contextOrder: contextData,
          userData: user,
          languageStyle
        })
      }
    );



    const data = await response.json();



    return (
      data.reply ||
      data.text ||
      "[TRANSFER_TO_AGENT]"
    );

  } catch (error) {

    console.error(
      "Backend API Error:",
      error
    );

    return "[TRANSFER_TO_AGENT]";
  }
};




// ✅ BOT RESPONSE PARSER
export const processBotResponse = (
  rawBotResponse
) => {

  let finalBotText =
    rawBotResponse.trim();

  let triggerEscalation = false;



  // ✅ JSON ACTION PARSER
  if (
    finalBotText.startsWith("[") &&
    finalBotText.endsWith("]")
  ) {

    try {

      const actions =
        JSON.parse(finalBotText);

      const action = actions[0];



      // ✅ PROFILE UPDATE
      if (
        action.action ===
        "UPDATE_PROFILE"
      ) {

        finalBotText =
          "Done ✅ User profile successfully update ho gaya hai.";
      }



      // ✅ STATUS UPDATE
      else if (
        action.action ===
        "UPDATE_STATUS"
      ) {

        finalBotText =
          "Done ✅ Order status successfully update kar diya gaya hai.";
      }



      // ✅ EMAIL SEND
      else if (
        action.action ===
        "SEND_EMAIL"
      ) {

        finalBotText =
          "Email successfully send kar diya gaya hai 📩 Please inbox check karo.";
      }

    } catch (e) {

      console.error(
        "Action parsing failed",
        e
      );
    }
  }



  // ✅ HUMAN ESCALATION
  if (
    finalBotText.includes(
      "[TRANSFER_TO_AGENT]"
    )
  ) {

    finalBotText =
      "Maine ek live support ticket create kar diya hai ✅ Ek human agent jaldi aapse connect karega.";

    triggerEscalation = true;
  }



  return {
    finalBotText,
    triggerEscalation
  };
};