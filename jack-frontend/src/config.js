// jack-frontend/src/config.js
// 🔥 PHASE 1 FIX: Strictly use import.meta.env for Vite. No process.env allowed in browser.

// 1. Primary API Base URL with robust production fallback
export const API_URL = import.meta.env.VITE_API_URL || "https://ecom-project-lwt4.onrender.com/api";

// 🔥 Pro Feature: Automatically derive WebSocket Base URL from API_URL
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api$/, '');

// 🔥 Pro Feature: Global App Constants & Environment Helpers
export const APP_NAME = "Jack Essentials";
export const IS_DEV = typeof window !== 'undefined' && import.meta.env.DEV;
export const IS_PROD = typeof window !== 'undefined' && import.meta.env.PROD;