import axios from 'axios';
import { API_URL } from '../config'; 

const axiosInstance = axios.create({
  // 🔥 PHASE 1 FIX: Backend URL strictly uses API_URL. 
  // No localhost fallbacks here anymore, API_URL already has /api appended.
  baseURL: API_URL, 
  
  // Add timeout (10 seconds). Infinite loop se bachane ke liye.
  timeout: 10000, 

  // CRITICAL FOR COOKIES: Allow browser to send and receive HttpOnly cookies cross-origin/same-origin
  withCredentials: true,
});

// ==========================================
// 🔥 REQUEST INTERCEPTOR
// ==========================================
axiosInstance.interceptors.request.use(
  (config) => {
    // Backend still relies on Bearer token for strict authentication. 
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add correlation ID. Server logs mein debugging aasan karne ke liye
    config.headers['X-Request-ID'] = crypto.randomUUID 
      ? crypto.randomUUID() 
      : `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==========================================
// 🔥 RESPONSE INTERCEPTOR (401 Auto-Logout & Errors)
// ==========================================
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("🚨 Session expired or Unauthorized. Forcing auto-logout.");
      
      // LocalStorage data delete karo 
      localStorage.removeItem('jack_user');
      localStorage.removeItem('token'); 

      // Doosre React Contexts ko notify karne ke liye event fire karo
      window.dispatchEvent(new Event('jack_auth_change'));

      // User ko login page par redirect karo
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    if (error.code === 'ECONNABORTED') {
      console.error(`⚠️ Request timeout for ${error.config?.url}. Server might be slow.`);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;