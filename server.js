const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http'); 
const { Server } = require("socket.io"); 
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const helmet = require('helmet'); 
const rateLimit = require('express-rate-limit'); 
const jwt = require('jsonwebtoken');
const cron = require('node-cron'); // 🔥 Cron for scheduled tasks
const winston = require('winston'); // 🔥 Production Structured Logger
const cookieParser = require('cookie-parser'); // 🔥 CRITICAL FIX: Added cookie-parser

// 🔥 SINGLE SOURCE OF TRUTH: Import Models cleanly
const { User, Ticket, Warehouse, Order, Product, Review, Question, PriceAlert, StockAlert } = require('./models');

// 🔥 IMPORT YOUR SECURE MIDDLEWARES
const { protect, admin } = require('./middleware/authMiddleware');

// 🔥 IMPORT UNIFIED ERROR MIDDLEWARE
const { errorHandler } = require('./middleware/errorMiddleware');

// 🔥 IMPORT ABANDONED CART SCHEDULER & WORKER
require('./workers/abandonedCartWorker');
const { queueAbandonedCarts } = require('./services/cartScheduler');

// 🔥 IMPORT ASYNCHRONOUS ANALYTICS WORKER (BOOT ON STARTUP)
require('./workers/analyticsWorker');

// 🔥 IMPORT SMART PRICE DROP & RECOMMENDATION SERVICE
const { processSmartPriceDropRecommendations } = require('./services/smartAlertService');

const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();
console.log("JWT configuration loaded");

// ==========================================
// 📊 WINSTON STRUCTURED LOGGER & CORRELATION SETUP
// ==========================================
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const requestLoggerMiddleware = (req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || req.headers['X-Request-ID'] || Math.random().toString(36).substring(2, 15);
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId); 

  res.on('finish', () => {
    const latency = Date.now() - start;
    const userId = req.user?._id || req.user?.id || 'anonymous';
    
    logger.info({
      message: 'HTTP Request Completed',
      requestId,
      userId,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      latency: `${latency}ms`
    });
  });

  next();
};

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
// 🔥 TRUSTED PROXY & SECURE HEADERS
// ==========================================
app.set('trust proxy', 1); 

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://checkout.razorpay.com"],
      connectSrc: ["'self'", "https://api.razorpay.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
})); 

// 🔥 CRITICAL FIX: Initialize cookie-parser before rate limiters and routes
app.use(cookieParser());

// ==========================================
// 🌐 COMPREHENSIVE CORS ALLOWLIST & PREFLIGHT SUPPORT
// ==========================================
const allowedOrigins = [
  "https://thejackessentials.com", 
  "https://www.thejackessentials.com",
  "https://admin.thejackessentials.com",
  "https://www.admin.thejackessentials.com",
  "https://ecom-project-lyart-sigma.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://192.168.31.240:5173",
  process.env.ADMIN_ORIGIN,
  process.env.STORE_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Idempotency-Key"],
  credentials: true // 🔥 REQUIRED FOR COOKIES & HEADERS TO WORK ACROSS ORIGINS
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));// 🔥 Explicit preflight handling for cross-domain stability

// ==========================================
// 🛡️ GRANULAR ENDPOINT-SPECIFIC RATE LIMITERS
// ==========================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: { message: "Too many requests from this IP, please try again later." }
});
app.use(globalLimiter);

const productsLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 120,
  message: { message: "Too many product requests, please slow down." }
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 10,
  message: { message: "Too many payment requests. Please try again shortly." }
});

const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many AI chat requests, please try again later." }
});

const catalogGenLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5,
  message: { error: "Catalog generation rate limit exceeded. Please wait a minute." }
});

const ordersLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 30, 
  message: { message: "Too many order placement requests. Please slow down." }
});

app.use(requestLoggerMiddleware);

// ==========================================
// 🔥 STRICT PAYLOAD LIMITS
// ==========================================
app.use('/api/generate-catalog', catalogGenLimiter, express.json({ limit: '50mb' }));
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// ==========================================
// 🔥 WEBHOOK & PAYMENT ROUTES MOUNTED AFTER CORS
// ==========================================
app.use('/api', require('./routes/payment')); 

// ==========================================
// 🏥 HEALTH CHECK & READINESS ENDPOINTS
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health/ready', (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    return res.status(200).json({ status: 'READY', dbState: 'Connected' });
  }
  return res.status(503).json({ status: 'NOT_READY', dbState: 'Disconnected' });
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

// ==========================================
// 🔥 SECURED SOCKET.IO WITH COMPREHENSIVE CORS ALLOWLIST
// ==========================================
const io = new Server(server, { 
  cors: { 
    origin: allowedOrigins, 
    methods: ["GET", "POST"],
    credentials: true 
  } 
});

// 🔥 ROBUST UPSTASH / REDIS SECURE CLIENT INITIALIZATION WITH TLS
const pubClient = createClient({ 
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss://'),
    rejectUnauthorized: false
  }
});

pubClient.on('error', (err) => {
  console.warn('⚠️ Redis Client Warning / Offline:', err.message);
});

const subClient = pubClient.duplicate();
subClient.on('error', (err) => {
  // Suppress secondary client spam
});

async function initRedis() {
  try {
    if (!pubClient.isOpen) await pubClient.connect();
    if (!subClient.isOpen) await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("✅ Socket.IO Redis Adapter Connected Successfully via Upstash / REDIS_URL!");
  } catch (err) {
    console.warn("⚠️ Redis connection failed using REDIS_URL (Running in standalone mode):", err.message);
  }
}
initRedis();

app.set("io", io);

// ==========================================
// 🗄️ MONGODB CONNECTION & NATIVE SLOW QUERY MONITORING
// ==========================================
mongoose.connect(process.env.MONGO_URI, { 
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 50,
  minPoolSize: 10,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 30000
})
  .then(() => {
    console.log('✅ Jack Essentials Production Database Connected with Pool Tuning!');
    
    // 🔥 ROBUST SLOW QUERY MONITORING VIA NATIVE DRIVER COMMAND MONITORING (>300ms)
    const client = mongoose.connection.getClient();
    if (client && client.on) {
      client.on('commandSucceeded', (event) => {
        if (event.duration > 300) {
          logger.warn({
            message: 'SLOW QUERY DETECTED',
            command: event.commandName,
            database: event.databaseName,
            durationMs: event.duration
          });
        }
      });
    }

    cron.schedule('*/30 * * * *', () => {
      console.info("⏰ Running scheduled abandoned cart queue job...");
      queueAbandonedCarts();
    });

    cron.schedule('0 */6 * * *', () => {
      const ioInstance = app.get('io');
      processSmartPriceDropRecommendations(ioInstance);
    });
  })
  .catch((err) => {
    logger.error({ message: 'Database Connection Failed', error: err.message, stack: err.stack });
    process.exit(1);
  });

// ==========================================
// 🚀 MOUNTED ROUTES 
// ==========================================
app.use('/', productsLimiter, require('./routes/products'));
app.use('/', require('./routes/users'));
app.use('/', checkAccountStatus, require('./routes/orders')); 
app.use('/', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));
app.use('/', require('./routes/warehouse'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api', require('./routes/deliveryCheck'));
app.use('/', require('./routes/tracking'));
app.use('/', require('./routes/content'));
app.use('/', require('./routes/googleMerchantFeed'));
app.use('/', require('./routes/subscribers'));
app.use('/', require('./routes/ssrProduct'));

// 🔥 MOUNTED: Updated AI Assistant & Failover Routes (Includes chat, catalog parse, and copilot analysis)
app.use('/', aiChatLimiter, require('./routes/aiAssistant'));

app.use('/', require('./routes/reviews'));
app.use('/', require('./routes/questions'));
app.use('/', require('./routes/wishlist'));
app.use('/', require('./routes/priceAlerts').router);
app.use('/', require('./routes/stockAlerts').router);

// ==========================================
// 🔥 SECURED: AI CATALOG GENERATOR (ADMIN ONLY) 
// ==========================================
app.post('/api/generate-catalog', protect, admin, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) return res.status(500).json({ error: "No Gemini API Keys Configured" });
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: "Image data missing" });

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    
    // 🔥 Strict prompt to ensure valid JSON response from Gemini
    const prompt = `You are an expert E-commerce SEO specialist. Analyze this product image and return ONLY a valid JSON object with these exact keys: title, description, category, brand, price, mrp, sku, color, size, material, searchKeywords. Do not include any markdown formatting or extra text outside the JSON.`;

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
    console.log("🤖 Raw Gemini Catalog Response:", responseText); // 🔥 Debug log

    let finalJson;
    try {
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      finalJson = JSON.parse(cleanedText);
    } catch (parseError) { 
      console.error("❌ JSON Parse Failed for AI Response:", parseError.message);
      finalJson = { error: "Failed to parse AI response", raw: responseText }; 
    }

    return res.status(200).json(finalJson);
  } catch (error) { 
    console.error("Catalog Generation Route Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' }); 
  }
});

// ==========================================
// 🔥 SECURED: HARDENED AI CHAT ROUTE
// ==========================================
app.post('/api/chat', protect, aiChatLimiter, async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: 'AI Service configuration missing' });

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message exceeds maximum allowed length of 1000 characters' });
    }

    const serverSystemInstruction = "You are an official, helpful, and polite customer support assistant for Jack Essentials. Assist customers with store products, orders, and policies safely and accurately.";

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [ 
        { role: "system", content: serverSystemInstruction }, 
        ...(Array.isArray(chatHistory) ? chatHistory.slice(-10) : []), 
        { role: "user", content: message } 
      ],
      temperature: 0.7
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'AI Service Error', details: data });

    res.json({ reply: data.choices[0].message.content.trim() });
  } catch (error) { 
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: 'Server code crash' }); 
  }
});

// ==========================================
// 🎟️ SECURED: SOCKET.IO AUTHENTICATION & SMART CHANNELS
// ==========================================
io.use(async (socket, next) => {
  try {
    let token = socket.handshake.auth.token;
    
    if (socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        acc[name] = value;
        return acc;
      }, {});
      
      token = cookies.admin_token || cookies.token || token;
    }

    if (!token) return next(new Error('Authentication Error: No token provided'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || user.isLocked) return next(new Error('Authentication Error: User not found or locked'));
    
    socket.user = user; 
    next();
  } catch (err) {
    next(new Error('Authentication Error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔒 Secure Connection: ${socket.user.email} (${socket.id})`);

  if (socket.user.role === 'admin') {
    socket.join('admin_room');
  }

  socket.on('subscribe_admin_channels', (data) => {
    if (socket.user.role !== 'admin') return;
    
    socket.join('orders');
    socket.join('inventory');
    socket.join('support');
    socket.join('payments');
    socket.join('warehouse');
    
    console.log(`📡 Admin ${socket.user.email} subscribed to all operational channels (orders, inventory, support, payments, warehouse)`);
  });

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
          messages: (data.history || []).map(msg => ({ sender: msg.sender, text: msg.text }))
        });
      } else {
          (data.history || []).forEach(msg => { ticket.messages.push({ sender: msg.sender, text: msg.text }); });
      }
      await ticket.save();
      
      io.to('admin_room').to('support').emit('ticket.created', ticket);
      io.to('admin_room').emit('new_ticket_alert', ticket);
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

  socket.on('join_product_page', async (data) => {
    try {
      const visitorPayload = JSON.stringify({
        socketId: socket.id,
        productId: data.productId,
        productName: data.productName,
        user: socket.user.name || 'Anonymous Visitor',
        device: data.device || 'Desktop',
        joinedAt: Date.now()
      });

      if (pubClient.isOpen) {
        await pubClient.hSet('live_visitors', socket.id, visitorPayload);
        const allVisitorsObj = await pubClient.hGetAll('live_visitors');
        const visitorsArray = Object.values(allVisitorsObj).map(v => JSON.parse(v));
        
        io.to('admin_room').emit('customer.live', visitorsArray);
        io.to('admin_room').emit('live_traffic_update', visitorsArray);
      }
    } catch (err) { console.error("Redis join page error:", err); }
  });

  socket.on('leave_product_page', async () => {
    try {
      if (pubClient.isOpen) {
        await pubClient.hDel('live_visitors', socket.id);
        const allVisitorsObj = await pubClient.hGetAll('live_visitors');
        const visitorsArray = Object.values(allVisitorsObj).map(v => JSON.parse(v));
        
        io.to('admin_room').emit('customer.live', visitorsArray);
        io.to('admin_room').emit('live_traffic_update', visitorsArray);
      }
    } catch (err) { console.error("Redis leave page error:", err); }
  });

  socket.on('disconnect', async () => {
    try {
      if (pubClient.isOpen) {
        await pubClient.hDel('live_visitors', socket.id);
        const allVisitorsObj = await pubClient.hGetAll('live_visitors');
        const visitorsArray = Object.values(allVisitorsObj).map(v => JSON.parse(v));
        
        io.to('admin_room').emit('customer.live', visitorsArray);
        io.to('admin_room').emit('live_traffic_update', visitorsArray);
      }
    } catch (err) { console.error("Redis disconnect error:", err); }
  });
});

// ==========================================
// 🔥 UNIFIED ENTERPRISE ERROR HANDLER MOUNT
// ==========================================
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// ==========================================
// 🔥 GRACEFUL SHUTDOWN HANDLER (FIXED FOR REDIS & MONGOOSE)
// ==========================================
const shutdownHandler = async () => {
  console.log('🔄 Received kill signal, shutting down gracefully...');
  server.close(async () => {
    console.log('🛑 HTTP server closed.');
    try {
      if (pubClient && pubClient.isOpen) {
        await pubClient.quit();
      }
      if (subClient && subClient.isOpen) {
        await subClient.quit();
      }
      console.log('🛑 Redis connections closed safely.');

      await mongoose.connection.close(false);
      console.log('🛑 MongoDB connection closed safely.');
      process.exit(0);
    } catch (err) {
      console.error('Error during safe shutdown closure:', err);
      process.exit(1);
    }
  });

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

module.exports = app;