import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  // 🔥 Ekdum sahi API key
  apiKey: "AIzaSyA2z4jTYOGkshlnaCkiDmV0aKuVnzEo-YM",
  authDomain: "jack-essentials.firebaseapp.com",
  projectId: "jack-essentials",
  storageBucket: "jack-essentials.firebasestorage.app",
  messagingSenderId: "486613236039",
  appId: "1:486613236039:web:da6329f8d57a53f4103462"
};

const app = initializeApp(firebaseConfig);

// Initialize Authentication exports
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();