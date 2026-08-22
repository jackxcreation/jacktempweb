export default {
  plugins: {
    // 1. Tailwind CSS Engine
    '@tailwindcss/postcss': {},
    
    // 🔥 PRO FEATURE: Autoprefixer 🔥
    // Ye apne aap tere CSS rules ke aage vendor prefixes (-webkit-, -moz-) 
    // laga dega. Is se tera design purane mobile browsers aur Safari 
    // par phatega nahi. India mein e-commerce ke liye ye bohot zaroori hai!
    autoprefixer: {},
  },
}