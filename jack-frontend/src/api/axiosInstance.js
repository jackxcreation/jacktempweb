import axios from 'axios';
import { API_URL } from '../config'; 
import { normalizeError, notifyUser, reportTelemetry } from '../utils/errorNormalizer';

const axiosInstance = axios.create({
  // 🔥 PHASE 1 FIX: Backend URL strictly uses API_URL. 
  // No localhost fallbacks here anymore, API_URL already has /api appended.
  baseURL: API_URL, 
  
  // Add timeout (10 seconds). Infinite loop se bachane ke liye.
  timeout: 10000, 

  // CRITICAL FOR COOKIES: Allow browser to send and receive HttpOnly cookies cross-origin/same-origin
  withCredentials: true,
});

// Helper function to safely retrieve token across subdomains and storage keys
const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || 
         localStorage.getItem('admin_token') || 
         localStorage.getItem('jack_token') ||
         document.cookie.replace(/(?:(?:^|.*;\s*)token\s*\=\s*([^;]*).*$)|^.*$/, "$1") ||
         document.cookie.replace(/(?:(?:^|.*;\s*)admin_token\s*\=\s*([^;]*).*$)|^.*$/, "$1");
};

// ==========================================
// 🔥 REQUEST INTERCEPTOR
// ==========================================
axiosInstance.interceptors.request.use(
  (config) => {
    // Backend still relies on Bearer token for strict authentication. 
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add correlation ID. Server logs mein debugging aasan karne ke liye
    config.headers['X-Request-ID'] = crypto.randomUUID 
      ? crypto.randomUUID() 
      : `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 🔥 ENTERPRISE IDEMPOTENCY: Automatically inject Idempotency-Key for POST/PUT/PATCH/DELETE requests
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
  (error) => {
    return Promise.reject(error);
  }
);

// ==========================================
// 🔥 RESPONSE INTERCEPTOR (401 Auto-Logout & Unified Error Normalizer Pipeline)
// ==========================================
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Normalize raw Axios error into standard enterprise error envelope
    const normalizedErr = normalizeError(error);

    // Report error to Telemetry / Logging sink
    reportTelemetry(normalizedErr);

    // Handle 401 / 403 Authentication Expiry
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("🚨 Session expired or Unauthorized. Forcing auto-logout.");
      
      localStorage.removeItem('jack_user');
      localStorage.removeItem('token'); 
      localStorage.removeItem('admin_token');

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

    return Promise.reject(normalizedErr);
  }
);

// ==========================================
// 🔥 CRM & EMAIL MARKETING API HELPER FUNCTIONS
// (Preserved completely without deleting anything)
// ==========================================

/**
 * Naya Email Campaign launch karne ke liye function
 * @param {Object} campaignConfig - { campaignId, segmentName, campaignType, customMessage, productData }
 */
export const launchEmailCampaign = async (campaignConfig) => {
  try {
    // Fixed endpoint path to prevent double /api/api/ prefix duplication
    const response = await axiosInstance.post('/crm/campaign', {
      action: 'LAUNCH',
      campaignConfig
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Email Open, Click ya Purchase (ROI) track karne ke liye function
 * @param {Object} eventData - { campaignId, userId, eventType, orderValue }
 */
export const trackCampaignEvent = async (eventData) => {
  try {
    // Fixed endpoint path to prevent double /api/api/ prefix duplication
    const response = await axiosInstance.post('/crm/campaign', {
      action: 'TRACK',
      eventData
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export default axiosInstance;