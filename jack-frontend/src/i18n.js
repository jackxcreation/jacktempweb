import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 🔥 Multi-Lingual Dictionaries (English, Hindi, Hinglish)
const resources = {
  en: {
    translation: {
      home: "Home",
      shop: "Shop",
      cart: "Cart",
      wishlist: "Wishlist",
      trackOrder: "Track Order",
      login: "Login",
      logout: "Logout",
      addToCart: "Add to Bag",
      buyNow: "Buy It Now",
      searchPlaceholder: "Search for products, brands and more...",
      freeDelivery: "Free Delivery",
      secureCheckout: "100% Secure Checkout"
    }
  },
  hi: {
    translation: {
      home: "होम",
      shop: "शॉप",
      cart: "कार्ट",
      wishlist: "विशलिस्ट",
      trackOrder: "ऑर्डर ट्रैक करें",
      login: "लॉगिन",
      logout: "लॉगआउट",
      addToCart: "बैग में डालें",
      buyNow: "अभी खरीदें",
      searchPlaceholder: "उत्पाद, ब्रांड और बहुत कुछ खोजें...",
      freeDelivery: "मुफ्त डिलीवरी",
      secureCheckout: "100% सुरक्षित चेकआउट"
    }
  },
  hinglish: {
    translation: {
      home: "Home",
      shop: "Shop",
      cart: "Cart",
      wishlist: "Wishlist",
      trackOrder: "Order Track Karo",
      login: "Login Karo",
      logout: "Logout",
      addToCart: "Bag Mein Daalo",
      buyNow: "Abhi Kharido",
      searchPlaceholder: "Products, brands aur bahut kuch search karo...",
      freeDelivery: "Free Delivery",
      secureCheckout: "100% Secure Checkout"
    }
  }
  // 🚀 Future Expansion Hooks (Tamil, Telugu, Bengali, etc. can be appended here easily):
  // ta: { translation: { home: "முகப்பு", ... } },
  // te: { translation: { home: "హోమ్", ... } }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false // React already protects from xss
    }
  });

export default i18n;