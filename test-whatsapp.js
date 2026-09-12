// test-script.js
require('dotenv').config({ path: '.env' });

async function sendTestOTP() {
  const WA_ID = process.env.WA_PHONE_NUMBER_ID;
  const WA_TOKEN = process.env.WA_ACCESS_TOKEN;
  
  const RECIPIENT_PHONE = "917008559252"; // Apna phone number yahan daalein
  const OTP_CODE = "123456";

  console.log("Using Phone ID:", WA_ID);

  const url = `https://graph.facebook.com/v20.0/${WA_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: RECIPIENT_PHONE,
    type: "template",
    template: {
      name: "jack_essentials_otp",
      language: { code: "en_GB" },
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