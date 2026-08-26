import axios from 'axios';
import { API_URL } from '../config'; // 🔥 PHASE 8: Never ship production frontend with localhost URL

const axiosInstance = axios.create({
  // Backend URL environment/config se aayega
  baseURL: API_URL || 'http://localhost:5000/api', 
  
  // 🔥 PHASE 8: Add timeout (10 seconds). Infinite loop se bachane ke liye.
  timeout: 10000, 

  // 🔥 CRITICAL FOR COOKIES: Allow browser to send and receive HttpOnly cookies cross-origin/same-origin
  withCredentials: true,
});

// ==========================================
// 🔥 REQUEST INTERCEPTOR
// ==========================================
axiosInstance.interceptors.request.use(
  (config) => {
    // 🔥 FIX: Re-added Token Injection! 
    // Backend still relies on Bearer token for strict authentication. 
    // Yeh line har request ke sath tera login proof (token) bhejegi.
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 🔥 PHASE 8: Add correlation ID. Server logs mein debugging aasan karne ke liye
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
    // Agar sab theek hai, toh response wapas bhej do
    return response;
  },
  (error) => {
    // 🔥 PHASE 8: Add 401 logout behavior
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("🚨 Session expired or Unauthorized. Forcing auto-logout.");
      
      // LocalStorage data delete karo (Jack user state)
      localStorage.removeItem('jack_user');
      localStorage.removeItem('token'); // 🔥 FIX: Token ko bhi clear karo taaki purana token stuck na ho

      // Doosre React Contexts ko notify karne ke liye event fire karo
      window.dispatchEvent(new Event('jack_auth_change'));

      // User ko login page par redirect karo (agar wo already wahan nahi hai)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Timeout alert
    if (error.code === 'ECONNABORTED') {
      console.error(`⚠️ Request timeout for ${error.config?.url}. Server might be slow.`);
    }

    // Avoid retrying non-idempotent POST automatically (Axios default is to NOT retry, which is perfect)
    
    return Promise.reject(error);
  }
);

export default axiosInstance;