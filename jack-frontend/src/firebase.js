import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// 🔥 PRODUCTION SECURITY: Using Environment Variables with fallback to avoid crashes
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA2z4jTYOGkshlnaCkiDmV0aKuVnzEo-YM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "jack-essentials.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "jack-essentials",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "jack-essentials.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "486613236039",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:486613236039:web:da6329f8d57a53f4103462"
};

const app = initializeApp(firebaseConfig);

// Initialize Authentication exports
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();