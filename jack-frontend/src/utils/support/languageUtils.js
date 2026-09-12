// jack-frontend/src/utils/support/languageUtils.js

/**
 * Detects basic language style from user input for UI formatting.
 */
export const detectLanguageStyle = (text = "") => {
  const lower = text.toLowerCase();
  
  const hinglishWords = [
    "bhai", "kya", "kaise", "mera", "mujhe", "kr", "kar", 
    "acha", "haan", "nahi", "kyu", "tum", "aap", "jaldi", 
    "order", "refund", "kab", "ayega", "kahan"
  ];

  const hasHinglish = hinglishWords.some(word => lower.includes(word));
  
  return hasHinglish ? "hinglish" : "english";
};