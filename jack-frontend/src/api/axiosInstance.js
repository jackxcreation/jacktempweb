import axios from 'axios';
import { API_URL } from '../config'; 
import { normalizeError, notifyUser, reportTelemetry } from '../utils/errorNormalizer';

const axiosInstance = axios.create({
  // Backend URL strictly uses API_URL (should already include /api)
  baseURL: API_URL, 
  // 10 seconds timeout to prevent infinite hanging requests
  timeout: 10000, 
  // Allow browser to send/receive HttpOnly cookies cross-origin/same-origin
  withCredentials: true,
});

// ==========================================
// 🔥 REQUEST INTERCEPTOR
// ==========================================
axiosInstance.interceptors.request.use(
  (config) => {
    // 🔥 PRODUCTION SECURITY FIX: Manual Authorization header injection removed.
    // Authentication tokens are now securely transmitted via HttpOnly cookies using withCredentials: true.

    // Add correlation ID for easier server-side debugging
    config.headers['X-Request-ID'] = crypto.randomUUID 
      ? crypto.randomUUID() 
      : `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ENTERPRISE IDEMPOTENCY: Safely inject Idempotency-Key for mutating requests
    const method = config.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      if (!config.headers['Idempotency-Key']) {
        config.headers['Idempotency-Key'] = crypto.randomUUID 
          ? crypto.randomUUID() 
          : `idemp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================
// 🔥 RESPONSE INTERCEPTOR
// ==========================================
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalize raw Axios error into standard enterprise error envelope
    const normalizedErr = normalizeError(error);

    // Report error to Telemetry / Logging sink
    reportTelemetry(normalizedErr);

    // Handle 401 / 403 Authentication Expiry
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("🚨 Session expired or Unauthorized. Forcing auto-logout.");
      
      // Clear non-sensitive user metadata from localStorage (Tokens are in HttpOnly cookies)
      localStorage.removeItem('jack_user');
      localStorage.removeItem('jack_remembered_identifier');

      window.dispatchEvent(new Event('jack_auth_change'));

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else {
      // Trigger unified UI Toast notification for normalized user-facing errors
      notifyUser(normalizedErr);
    }

    if (error.code === 'ECONNABORTED') {
      console.error(`⚠️ Request timeout for ${error.config?.url}. Server might be slow.`);
    }

    // ALWAYS reject with the normalized error so UI components receive clean data
    return Promise.reject(normalizedErr);
  }
);

// ==========================================
// 🔥 CRM & EMAIL MARKETING API HELPER FUNCTIONS
// ==========================================

export const launchEmailCampaign = async (campaignConfig) => {
  const response = await axiosInstance.post('/crm/campaign', {
    action: 'LAUNCH',
    campaignConfig
  });
  return response.data;
};

export const trackCampaignEvent = async (eventData) => {
  const response = await axiosInstance.post('/crm/campaign', {
    action: 'TRACK',
    eventData
  });
  return response.data;
};

// ==========================================
// 🔥 SUPPORT & CHAT HELPER FUNCTIONS
// ==========================================

export const fetchSupportHistory = async (conversationId) => {
  const response = await axiosInstance.get(`/support/history/${conversationId}`);
  return response.data;
};

export const createSupportTicket = async (ticketData) => {
  const response = await axiosInstance.post('/support/tickets', ticketData);
  return response.data;
};

export const submitSupportFeedback = async (feedbackData) => {
  const response = await axiosInstance.post('/support/feedback', feedbackData);
  return response.data;
};

// ==========================================
// 🔥 WHATSAPP AUTHENTICATION & OTP HELPERS (NEWLY ADDED)
// ==========================================

export const sendWhatsAppOtp = async (phone) => {
  const response = await axiosInstance.post('/whatsapp/send-otp', { phone });
  return response.data;
};

export const verifyWhatsAppOtp = async (phone, otp, name = '') => {
  const response = await axiosInstance.post('/whatsapp/verify-otp', { phone, otp, name });
  return response.data;
};

export default axiosInstance;