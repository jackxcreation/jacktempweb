require('dotenv').config();
const dns = require('dns');

// 🔥 THE FIX: Node.js ko strictly IPv4 use karne ke liye force karein
// Isse "fetch failed" error hamesha ke liye solve ho jayega
dns.setDefaultResultOrder('ipv4first');

// 1. PURANA FUNCTION (Preserved)
async function listGroqModels() {
    const apiKey = process.env.GROQ_API_KEY;
    if(!apiKey) return console.log("⚠️ Groq Key nahi mili! (.env check karein)");

    try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const data = await res.json();
        
        console.log("\n🔥 All Active Groq Models:");
        data.data.forEach(m => console.log("👉", m.id));
    } catch (error) {
        console.error("Groq Models fetch error:", error.message);
    }
}

// 2. NAYA FUNCTION (Fixed for Gemini with Native Fetch)
async function listGeminiModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if(!apiKey) return console.log("⚠️ Gemini Key nahi mili! (.env check karein)");

    console.log("⏳ Gemini API se available models fetch ho rahe hain...\n");

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
            headers: { "Content-Type": "application/json" }
        });
        
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const data = await res.json();
        
        console.log("🚀 All Active Gemini Models:");
        if (data.models && data.models.length > 0) {
            data.models.forEach(m => {
                // Remove 'models/' prefix for cleaner output
                const cleanName = m.name.replace('models/', '');
                console.log("👉", cleanName);
            });
        }
    } catch (error) {
        console.error("❌ Gemini Models fetch error:", error.message);
    }
}

// 3. MAIN EXECUTION
async function runAll() {
    console.log("Checking API Models...\n");
    await listGroqModels();
    await listGeminiModels();
}

runAll();