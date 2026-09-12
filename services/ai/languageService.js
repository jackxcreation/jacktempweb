/**
 * Detects the language and style of the input text
 */
const detectLanguage = (text) => {
  if (!text || typeof text !== 'string') {
    return { language: 'en', script: 'latin', style: 'english', confidence: 1.0 };
  }

  const lowerText = text.toLowerCase();
  
  // Basic Devanagari script detection
  const devanagariRegex = /[\u0900-\u097F]/;
  if (devanagariRegex.test(lowerText)) {
    return { language: 'hi-IN', script: 'devanagari', style: 'hindi', confidence: 0.99 };
  }

  // Common Hinglish intent/stop words
  const hinglishWords = [
    'mera', 'mujhe', 'kya', 'kaise', 'bhai', 'kab', 'ayega', 'kahan', 
    'hai', 'nahi', 'karo', 'kar', 'acha', 'kyu', 'order', 'refund'
  ];

  const words = lowerText.split(/\s+/);
  const hinglishMatchCount = words.filter(word => hinglishWords.includes(word)).length;

  if (hinglishMatchCount >= 1) {
    return { language: 'hi-IN', script: 'latin', style: 'hinglish', confidence: 0.95 };
  }

  // Default to English
  return { language: 'en-US', script: 'latin', style: 'english', confidence: 0.90 };
};

module.exports = { detectLanguage };