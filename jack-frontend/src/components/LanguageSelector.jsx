import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiGlobe } from 'react-icons/fi';

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (e) => {
    const selectedLang = e.target.value;
    i18n.changeLanguage(selectedLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('jack_lang', selectedLang);
    }
  };

  // 🔥 UPGRADE: Normalize language code (e.g., 'en-US' -> 'en') to ensure dropdown select matches correctly
  const currentLang = i18n.language ? i18n.language.split('-')[0] : 'en';

  return (
    <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer border border-slate-200 relative">
      <FiGlobe className="text-slate-600 flex-shrink-0" size={14} />
      <select 
        value={currentLang} 
        onChange={changeLanguage}
        aria-label="Select Language"
        className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer uppercase tracking-wider"
      >
        <option value="en">English</option>
        <option value="hi">हिंदी (Hindi)</option>
        <option value="hinglish">Hinglish</option>
        {/* Future Expansion Options */}
        <option value="ta" disabled>தமிழ் (Coming Soon)</option>
        <option value="te" disabled>తెలుగు (Coming Soon)</option>
        <option value="bn" disabled>বাংলা (Coming Soon)</option>
        <option value="mr" disabled>मराठी (Coming Soon)</option>
        <option value="gu" disabled>ગુજરાતી (Coming Soon)</option>
        <option value="kn" disabled>ಕನ್ನಡ (Coming Soon)</option>
        <option value="ml" disabled>മലയാളം (Coming Soon)</option>
        <option value="pa" disabled>ਪੰਜਾਬੀ (Coming Soon)</option>
      </select>
    </div>
  );
};

export default LanguageSelector;