// jack-frontend/src/utils/support/languageUtils.js

/**
 * Detects basic language style from user input for UI formatting.
 * 🔥 UPGRADE: Uses Regex Word Boundaries (\b) to prevent false positives 
 * (e.g., prevents "hair" from matching "hai").
 */
export const detectLanguageStyle = (text = "") => {
  const cleanText = String(text || "");
  
  const hinglishWords = [
    "bhai", "kya", "kaise", "mera", "mujhe", "kr", "kar", 
    "acha", "haan", "nahi", "kyu", "tum", "aap", "jaldi", 
    "kab", "ayega", "kahan", "hoga", "hai", "hain", "karna", 
    "karo", "paisa", "payment", "chal", "chahiye", "wala", 
    "bhejo", "dekh", "kaha", "mat"
  ];

  // Uses \b to ensure we only match exact whole words, not substrings
  const hasHinglish = hinglishWords.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(cleanText);
  });
  
  return hasHinglish ? "hinglish" : "english";
};

/**
 * Returns localized support greetings based on detected language style.
 */
export const getLocalizedGreeting = (languageStyle = "english") => {
  if (languageStyle === "hinglish") {
    return "Namaste bhai! Jack Essentials support mein aapka swagat hai. Main aapki kya madad kar sakta hoon? 🙏";
  }
  return "Hello! Welcome to Jack Essentials Support. How can I help you today? 👋";
};

/**
 * Returns localized network error fallback messages.
 */
export const getLocalizedFallback = (languageStyle = "english") => {
  if (languageStyle === "hinglish") {
    return "Sorry bhai, network issue lag raha hai. Kya aap wapas try kar sakte ho?";
  }
  return "I'm having trouble connecting right now. Could you please try again?";
};