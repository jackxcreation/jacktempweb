// services/whatsappService.js
const axios = require('axios');
const { logInfo, logError } = require('../utils/logger'); // Ensure relative path matches your folder structure

const WHATSAPP_API_VERSION = 'v17.0';

const getBaseUrl = () => {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneId}/messages`;
};

/**
 * Generic function to send WhatsApp Template messages via Meta Cloud API
 */
const sendTemplateMessage = async ({ to, templateName, languageCode = 'en', components = [] }) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    logError('WhatsApp API configuration missing (WHATSAPP_TOKEN or WHATSAPP_PHONE_ID)');
    return { success: false, error: 'WhatsApp configuration missing' };
  }

  const cleanPhone = to.replace(/^\+91/, '').trim();
  const formattedPhone = `+91${cleanPhone}`;

  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    };

    const response = await axios.post(getBaseUrl(), payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    logInfo(`✅ WhatsApp template message '${templateName}' sent successfully to ${formattedPhone}`);
    return { success: true, data: response.data };
  } catch (error) {
    logError('❌ WhatsApp API Send Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

/**
 * Specialized wrapper for sending OTP via 'jack_essentials_otp' template
 */
const sendWhatsAppOtp = async (phone, otp) => {
  return sendTemplateMessage({
    to: phone,
    templateName: 'jack_essentials_otp',
    languageCode: 'en',
    components: [
      {
        type: 'body',
        parameters: [{ type: 'text', text: otp }]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: otp }]
      }
    ]
  });
};

module.exports = {
  sendTemplateMessage,
  sendWhatsAppOtp
};