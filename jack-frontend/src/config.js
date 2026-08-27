// src/config.js
// 🔥 PHASE 1 FIX: Strictly use import.meta.env for Vite. No process.env allowed in browser.
export const API_URL = import.meta.env.VITE_API_URL || "https://ecom-project-lwt4.onrender.com/api";