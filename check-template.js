// check-template.js
require('dotenv').config({ path: '.env' });

async function getTemplates() {
  const WA_ID = process.env.WA_PHONE_NUMBER_ID;
  const WA_TOKEN = process.env.WA_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v20.0/${WA_ID}/message_templates`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${WA_TOKEN}`,
      },
    });

    const data = await response.json();
    console.log("Templates List:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error fetching templates:", error);
  }
}

getTemplates();