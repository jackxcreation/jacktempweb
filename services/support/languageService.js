// services/support/languageService.js

/**
 * Enterprise Multi-Language Auto-Detection & Response Matching Service (Task #37)
 * Detects customer language (Hindi, Hinglish, English, Odia, Bengali)
 * and generates corresponding system prompt instructions for the LLM.
 */

const detectLanguage = (text = '') => {
  if (!text || typeof text !== 'string') return 'english';
  
  const trimmed = text.trim();

  // Unicode ranges for native scripts
  const odiaRegex = /[\u0B00-\u0B7F]/;
  const bengaliRegex = /[\u0980-\u09FF]/;
  const devanagariRegex = /[\u0900-\u097F]/; // Hindi script

  if (odiaRegex.test(trimmed)) {
    return 'odia';
  }
  if (bengaliRegex.test(trimmed)) {
    return 'bengali';
  }
  if (devanagariRegex.test(trimmed)) {
    return 'hindi';
  }

  // Check for Hinglish common conversational words in Latin script
  const hinglishKeywords = ['kya', 'hai', 'kaise', 'mera', 'order', 'kab', 'nahi', 'hain', 'aap', 'mujhe', 'bhai', 'yeh', 'woh', 'batao', 'karo', 'mein', 'ko'];
  const words = trimmed.toLowerCase().split(/\s+/);
  const isHinglish = words.some(word => hinglishKeywords.includes(word));

  if (isHinglish) {
    return 'hinglish';
  }

  return 'english';
};

const getLanguageInstruction = (lang) => {
  switch (lang) {
    case 'hindi':
      return "Response strictly in pure Hindi (Devanagari script), maintaining a polite, helpful, and professional customer support tone.";
    case 'hinglish':
      return "Response in friendly Hinglish (Latin script, e.g., 'Bhai, aapka order...'), matching the customer's casual yet professional support tone.";
    case 'odia':
      return "Response strictly in Odia language (Odia script), maintaining a polite and helpful customer support tone.";
    case 'bengali':
      return "Response strictly in Bengali language (Bengali script), maintaining a polite and helpful customer support tone.";
    case 'english':
    default:
      return "Response in clear, professional, and helpful English.";
  }
};

module.exports = {
  detectLanguage,
  getLanguageInstruction
};