const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http'); 
const { Server } = require("socket.io"); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 

// 🔥 TERE PURANE CODE KA SDK IMPORT
const { GoogleGenerativeAI } = require('@google/generative-ai');

const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Warehouse = require('./models/Warehouse'); 


dotenv.config();

function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim()) {
      keys.push(key);
    }
  }
  return [...new Set(keys)];
}

const app = express();

app.use(helmet()); 

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500, 
  message: { message: "Too many requests from this IP, please try again later." }
});
app.use(apiLimiter);

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
  origin: [
    "https://thejackessentials.com", 
    "https://www.thejackessentials.com",
    "https://ecom-project-lyart-sigma.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    'https://admin.thejackessentials.com',
    'https://www.admin.thejackessentials.com',
    'http://192.168.31.240:5173'

  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

const checkAccountStatus = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.query.userId;
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.isLocked) {
        return res.status(403).json({ message: "Account is Locked! Access Denied." });
      }
    }
    next();
  } catch (err) {
    next(); 
  }
};

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// 🔥 SABSE BADA FIX: Socket ko Express app ke sath link kar diya 🔥
// Iske bina tera order route io ko dhundte dhundte crash ho raha tha
app.set("io", io);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Jack Essentials Database Connected!'))
  .catch((err) => console.log('❌ Database Connection Failed:', err));

app.use('/', require('./routes/products'));
app.use('/', require('./routes/users'));
app.use('/', checkAccountStatus, require('./routes/orders')); 
app.use('/', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));
app.use('/', require('./routes/warehouse'));
app.use('/api', require('./routes/deliveryCheck'));

console.log("Checking for Payment Route file...");
try {
  require('./routes/payment');
  console.log("✅ Payment route loaded successfully!");
} catch (e) {
  console.error("❌ ERROR: Payment route NOT FOUND:", e.message);
}
app.use('/api', require('./routes/payment')); 

// ==========================================
// 🔥 SUPER-PROMPT AI CATALOG GENERATOR 🔥
// ==========================================
app.post('/api/generate-catalog', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) {
      console.error("No Gemini API Keys Found");
      return res.status(500).json({ error: "No Gemini API Keys Configured" });
    }

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: "Image data missing" });
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt = `
      You are an expert E-commerce SEO specialist & Data Entry Bot. Analyze this product image for a store called "Jack Essentials".
      Generate highly SEO-optimized details to rank #1 on Google Search.
      
      CRITICAL INSTRUCTION: You MUST fill EVERY SINGLE FIELD in the JSON. DO NOT leave any field blank, null, or empty string. Make realistic, professional guesses for missing technical specs based on visual analysis.

      Return ONLY a RAW JSON object with these EXACT keys:
      {
        "detectedType": "electronics (if uses power) OR tools (hardware) OR generic (others)",
        "title": "Highly SEO-optimized title with top search keywords",
        "description": "Detailed, persuasive, SEO-boosted product description",
        "searchKeywords": "comma, separated, high, volume, seo, keywords, trending",
        "category": "Main Category (e.g., Home & Living, Fashion, Electronics)",
        "subCategory": "Sub Category",
        "brand": "Jack Premium",
        "color": "Dominant color of the product",
        "packOf": "1",
        "variant": "Standard",
        "mrp": "Estimated original price in INR (number only, e.g., 1499)",
        "price": "Discounted selling price INR (number only, e.g., 999)",
        "inventory": "50",
        "stock": "50",
        "minimumOrderQty": "1",
        "weight": "Estimated weight in grams (number only, e.g., 450)",
        "length": "Estimated length cm (number)",
        "breadth": "Estimated breadth cm (number)",
        "height": "Estimated height cm (number)",
        "hsnCode": "Provide a realistic 6 or 8 digit HSN code. DO NOT leave blank.",
        "tax": "Realistic tax % (e.g., 18 or 12). Number only.",
        "countryOfOrigin": "India",
        "modelNo": "Generate a random professional model number (e.g., JCK-PRO-9021)",
        "itemsIncluded": "Guess what is inside the box",
        "sku": "Generate a random professional SKU (e.g., SKU-JCK-4829)",
        "listingStatus": "Active"
      }
    `;

    let result = null;
    let lastError = null;

    for (const currentKey of apiKeys) {
      try {
        console.log("🔄 Trying Gemini API Key...");
        const genAI = new GoogleGenerativeAI(currentKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        result = await model.generateContent([
          prompt,
          { inlineData: { data: cleanBase64, mimeType: mimeType } }
        ]);

        console.log("✅ Gemini Success");
        break;
      } catch (err) {
        lastError = err;
        console.error("❌ Key Failed, switching...", err.message);
      }
    }

    if (!result) throw lastError || new Error("All Gemini API Keys Failed");

    const responseText = result.response.text().trim();
    let finalJson;
    try {
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      finalJson = JSON.parse(cleanedText);
      if (Array.isArray(finalJson) && finalJson.length > 0) finalJson = finalJson[0];
    } catch (parseError) {
      console.error("Failed to parse JSON from Gemini:", responseText);
      finalJson = {}; 
    }

    console.log("✅ Advanced SEO Catalog generated!");
    return res.status(200).json(finalJson);

  } catch (error) {
    console.error("API Crash Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// ==========================================
// 🔥 GROQ API CHAT ROUTE 🔥
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory, systemInstruction } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("🚨 Groq API Key missing in backend!");
      return res.status(500).json({ error: 'Groq API Key missing' });
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemInstruction },
        ...(chatHistory || []),
        { role: "user", content: message }
      ],
      temperature: 0.7
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("🚨 Groq API Error:", data);
      return res.status(response.status).json({ error: 'Groq API Error', details: data });
    }

    const replyText = data.choices[0].message.content.trim();
    res.json({ reply: replyText });

  } catch (error) {
    console.error("🚨 Chat Server Crash:", error);
    res.status(500).json({ error: 'Server code crash', details: error.message });
  }
});

// ==========================================
// 🎟️ SOCKET.IO LOGIC & LIVE TRAFFIC
// ==========================================
const activeVisitors = new Map();

io.on('connection', (socket) => {
  console.log('A user/admin connected: ', socket.id);

  socket.on('lock_user_session', (userId) => {
    io.to(userId).emit('force_logout');
  });

  socket.on('escalate_to_human', async (data) => {
    try {
      let ticket = await Ticket.findOne({ userId: data.userId, status: "open" });
      if (!ticket) {
        ticket = new Ticket({
          userId: data.userId, userName: data.userName || 'Guest', orderId: data.orderId,
          messages: data.history.map(msg => ({ sender: msg.sender, text: msg.text }))
        });
      } else {
          data.history.forEach(msg => { ticket.messages.push({ sender: msg.sender, text: msg.text }); });
      }
      await ticket.save();
      io.emit('new_ticket_alert', ticket);
    } catch (err) { console.error("Ticket escalation error", err); }
  });

  socket.on('admin_reply', async (data) => {
    try {
      const ticket = await Ticket.findById(data.ticketId);
      if (ticket) {
        ticket.messages.push({ sender: 'admin', text: data.text });
        await ticket.save();
        io.to(ticket.userId).emit('receive_admin_reply', { sender: 'admin', text: data.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      }
    } catch (err) { console.error(err); }
  });

  socket.on('join_user_room', (userId) => {
    socket.join(userId);
  });

  socket.on('join_product_page', (data) => {
    activeVisitors.set(socket.id, {
      socketId: socket.id,
      productId: data.productId,
      productName: data.productName,
      user: data.user || 'Anonymous',
      device: data.device || 'Desktop',
      joinedAt: Date.now()
    });
    io.emit('live_traffic_update', Array.from(activeVisitors.values()));
  });

  socket.on('leave_product_page', () => {
    activeVisitors.delete(socket.id);
    io.emit('live_traffic_update', Array.from(activeVisitors.values()));
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Socket Disconnected: ${socket.id}`);
    if (activeVisitors.has(socket.id)) {
      activeVisitors.delete(socket.id);
      io.emit('live_traffic_update', Array.from(activeVisitors.values()));
    }
  });
});

// 🔥 BULLETPROOFING: Global Error Handler
app.use((err, req, res, next) => {
  console.error("🚨 FATAL SERVER ERROR:", err.stack);
  res.status(500).json({ message: "Something went wrong on the server!" });
});

const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // IPv4 aur internal (localhost) na ho
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// 🔥 MOBILE FIX: Network Binding (0.0.0.0) 🔥
const PORT = process.env.PORT || 5000;
const ip = getLocalIp();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Jack Essentials Backend running smoothly on port ${PORT}`);
  console.log(`👉 Local: http://localhost:${PORT}`);
  console.log(`👉 Network (Use this for mobile): http://${ip}:${PORT}`);
  console.log(`📱 Access on network ready for mobile testing!`);
});