/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 🔥 1. Jack Essentials PREMIUM BRAND COLORS 🔥
      colors: {
        jack: {
          orange: '#FF4500',   // Primary Brand Color
          red: '#E8004C',      // Gradient Secondary Color
          dark: '#0B0F19',     // Deep Space Dark (Backgrounds)
          gray: '#F8F9FA',     // Off-white background
        }
      },
      
      // 🔥 2. CUSTOM ELITE FONTS 🔥
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },

      // 🔥 3. D2C PREMIUM BOX SHADOWS 🔥
      boxShadow: {
        'glow': '0 0 20px rgba(255, 69, 0, 0.25)', // Orange glow for buttons
        'glow-hover': '0 0 30px rgba(255, 69, 0, 0.4)',
        'premium': '0 10px 40px -10px rgba(0, 0, 0, 0.08)', // Soft product card shadow
        'glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)', // Glassmorphism effect
      },

      // 🔥 4. CUSTOM SMOOTH ANIMATIONS 🔥
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      // 🔥 5. ANIMATION KEYFRAMES (Logic) 🔥
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}