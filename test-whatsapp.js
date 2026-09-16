// test-whatsapp.js
require('dotenv').config();

async function sendTestOTP() {
  // Dono tarike ke variable names handle kar lega taaki undefined na aaye
  const WA_ID = process.env.WHATSAPP_PHONE_ID || process.env.WA_PHONE_NUMBER_ID;
  const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WA_ACCESS_TOKEN;
  
  const RECIPIENT_PHONE = "917008559252"; // Apna phone number yahan daalein
  const OTP_CODE = "123456";

  console.log("Using Phone ID:", WA_ID ? `✅ Loaded (${WA_ID})` : "❌ UNDEFINED");

  if (!WA_ID || !WA_TOKEN) {
    console.error("❌ Error: WHATSAPP_PHONE_ID ya WHATSAPP_ACCESS_TOKEN missing hai .env file mein!");
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${WA_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: RECIPIENT_PHONE,
    type: "template",
    template: {
      name: "jack_essentials_otp",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: OTP_CODE }]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: OTP_CODE }]
        }
      ]
    }
  };

  try {
    console.log("Sending WhatsApp OTP...");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

sendTestOTP();