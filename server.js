const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http'); 
const { Server } = require("socket.io"); 
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 
const jwt = require('jsonwebtoken');

// 🔥 IMPORT YOUR SECURE MIDDLEWARES
const { protect, admin } = require('./middleware/authMiddleware');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Warehouse = require('./models/Warehouse'); 

dotenv.config();

function getGeminiKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim()) keys.push(key);
  }
  return [...new Set(keys)];
}

const app = express();

// ==========================================
// 🔥 PHASE 9: TRUSTED PROXY & SECURE HEADERS
// ==========================================
app.set('trust proxy', 1); // For Vercel/Heroku/Nginx IPs

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://checkout.razorpay.com"],
      connectSrc: ["'self'", "https://api.razorpay.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
})); 

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500, 
  message: { message: "Too many requests from this IP, please try again later." }
});
app.use(apiLimiter);

// ==========================================
// 🔥 PHASE 9: STRICT PAYLOAD LIMITS
// ==========================================
// 1. Separate High Limit for AI/Upload Endpoint ONLY
app.use('/api/generate-catalog', express.json({ limit: '50mb' }));

// 2. Global Strict 1MB Limit for all other normal endpoints
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ limit: '1mb', extended: true }));

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

// ==========================================
// 🏥 HEALTH CHECK & MONITORING (Liveness/Readiness)
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

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
  } catch (err) { next(); }
};

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

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

// Webhook bypass handled in your payment route natively
app.use('/api', require('./routes/payment')); 

// ==========================================
// 🔥 SECURED: AI CATALOG GENERATOR (ADMIN ONLY) 🔥
// ==========================================
app.post('/api/generate-catalog', protect, admin, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) return res.status(500).json({ error: "No Gemini API Keys Configured" });
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: "Image data missing" });

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt = `You are an expert E-commerce SEO specialist... (Prompt truncated for brevity)`;

    let result = null;
    let lastError = null;

    for (const currentKey of apiKeys) {
      try {
        const genAI = new GoogleGenerativeAI(currentKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        result = await model.generateContent([ prompt, { inlineData: { data: cleanBase64, mimeType: mimeType } } ]);
        break;
      } catch (err) { lastError = err; }
    }

    if (!result) throw lastError || new Error("All Gemini API Keys Failed");

    const responseText = result.response.text().trim();
    let finalJson;
    try {
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      finalJson = JSON.parse(cleanedText);
    } catch (parseError) { finalJson = {}; }

    return res.status(200).json(finalJson);
  } catch (error) { return res.status(500).json({ error: error.message || 'Internal Server Error' }); }
});

// ==========================================
// 🔥 SECURED: GROQ API CHAT ROUTE (PROTECTED) 🔥
// ==========================================
app.post('/api/chat', protect, async (req, res) => {
  try {
    const { message, chatHistory, systemInstruction } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) return res.status(500).json({ error: 'Groq API Key missing' });

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [ { role: "system", content: systemInstruction }, ...(chatHistory || []), { role: "user", content: message } ],
      temperature: 0.7
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'Groq API Error', details: data });

    res.json({ reply: data.choices[0].message.content.trim() });
  } catch (error) { res.status(500).json({ error: 'Server code crash' }); }
});

// ==========================================
// 🎟️ SECURED: SOCKET.IO AUTHENTICATION & LOGIC
// ==========================================
const activeVisitors = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication Error: No token provided'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) return next(new Error('Authentication Error: User not found'));
    
    socket.user = user; 
    next();
  } catch (err) {
    next(new Error('Authentication Error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔒 Secure Connection: ${socket.user.email} (${socket.id})`);

  socket.on('lock_user_session', (userId) => {
    if (socket.user.role !== 'admin') return; 
    io.to(userId).emit('force_logout');
  });

  socket.on('escalate_to_human', async (data) => {
    try {
      const secureUserId = socket.user._id.toString();
      
      let ticket = await Ticket.findOne({ userId: secureUserId, status: "open" });
      if (!ticket) {
        ticket = new Ticket({
          userId: secureUserId, userName: socket.user.name || 'Guest', orderId: data.orderId,
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
      if (socket.user.role !== 'admin') return; 

      const ticket = await Ticket.findById(data.ticketId);
      if (ticket) {
        ticket.messages.push({ sender: 'admin', text: data.text });
        await ticket.save();
        io.to(ticket.userId).emit('receive_admin_reply', { sender: 'admin', text: data.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      }
    } catch (err) { console.error(err); }
  });

  socket.on('join_user_room', (userId) => {
    if (socket.user._id.toString() === userId || socket.user.role === 'admin') {
      socket.join(userId);
    }
  });

  socket.on('join_product_page', (data) => {
    activeVisitors.set(socket.id, {
      socketId: socket.id,
      productId: data.productId,
      productName: data.productName,
      user: socket.user.name || 'Anonymous', 
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
    if (activeVisitors.has(socket.id)) {
      activeVisitors.delete(socket.id);
      io.emit('live_traffic_update', Array.from(activeVisitors.values()));
    }
  });
});

// ==========================================
// 🔥 PHASE 9: GLOBAL ERROR HANDLER (No raw messages in Prod)
// ==========================================
app.use((err, req, res, next) => {
  console.error("🚨 FATAL SERVER ERROR:", err.stack);
  res.status(500).json({ 
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? "Internal Server Error" 
      : err.message || "Something went wrong on the server!" 
  });
});

const os = require('os');
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 5000;
const ip = getLocalIp();

// ==========================================
// 🔥 PHASE 9: GRACEFUL SHUTDOWN (Zero Downtime Deployments)
// ==========================================
const shutdownHandler = () => {
  console.log('🔄 Received kill signal, shutting down gracefully...');
  server.close(() => {
    console.log('🛑 HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('🛑 MongoDB connection closed safely.');
      process.exit(0);
    });
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    console.error('🚨 Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdownHandler);
process.on('SIGINT', shutdownHandler);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Jack Essentials Backend running smoothly on port ${PORT}`);
});