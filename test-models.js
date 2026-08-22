require('dotenv').config();

async function listGroqModels() {
    const apiKey = process.env.GROQ_API_KEY;
    if(!apiKey) return console.log("Groq Key nahi mili!");

    const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const data = await res.json();
    
    console.log("🔥 All Active Groq Models:");
    data.data.forEach(m => console.log("👉", m.id));
}

listGroqModels();