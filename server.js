// server.js
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
const cron = require('node-cron'); 
const cookieParser = require('cookie-parser'); 

// 🔥 DATA PROTECTION: Import Sanitized Structured Logger
const { logger, requestLoggerMiddleware, logInfo, logError, logWarn } = require('./utils/logger');

// 🔥 SINGLE SOURCE OF TRUTH: Import Models cleanly
const { User, Ticket, Warehouse, Order, Product, Review, Question, PriceAlert, StockAlert } = require('./models');

// 🔥 IMPORT NEW PREMIUM SUPPORT MODELS
const SupportTicket = require('./models/SupportTicket');
const SupportConversation = require('./models/SupportConversation');
const SupportAgent = require('./models/SupportAgent');

// 🔥 IMPORT NEW PREMIUM SUPPORT SERVICES
const escalationService = require('./services/support/escalationService');
const conversationService = require('./services/support/conversationService');

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

// 🔥 IMPORT WHATSAPP ROUTES (OTP & WEBHOOK)
const whatsappRoutes = require('./routes/whatsapp');

const { GoogleGenAI } = require('@google/genai'); // 🔥 MODERN SDK IMPORT

dotenv.config();

// 🔥 SECURED LOGGING FIX: Avoid printing raw secrets in production logs
console.log("JWT configured:", Boolean(process.env.JWT_SECRET));

// ==========================================
// 🔥 ANTI-CRASH SYSTEM: PREVENT SERVER DEATH FROM REDIS SOCKET DROPS
// ==========================================
process.on('uncaughtException', (err) => {
  logError('🚨 [ANTI-CRASH] Uncaught Exception caught:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('🚨 [ANTI-CRASH] Unhandled Rejection caught:', reason instanceof Error ? reason : new Error(String(reason)));
});

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
// 🌐 COMPREHENSIVE STRICT CORS ALLOWLIST & PREFLIGHT SUPPORT
// ==========================================
const baseAllowedOrigins = [
  "https://thejackessentials.com", 
  "https://www.thejackessentials.com",
  "https://admin.thejackessentials.com",
  "https://www.admin.thejackessentials.com",
  "https://ecom-project-lyart-sigma.vercel.app",
  process.env.ADMIN_ORIGIN,
  process.env.STORE_ORIGIN
].filter(Boolean);

// 🔥 LOCALHOST & LOCAL IPs ONLY FOR NON-PRODUCTION ENVIRONMENTS
const developmentOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "http://192.168.31.240:5173"
];

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? baseAllowedOrigins 
  : [...baseAllowedOrigins, ...developmentOrigins];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by strict CORS policy: Origin not trusted'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Idempotency-Key", "x-idempotency-key"],
  credentials: true 
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions)); 

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
  windowMs: 5 * 60 * 1000,
  max: 100,
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

// 🔥 MOUNT WHATSAPP ROUTES (OTP & WEBHOOK)
app.use('/api/whatsapp', whatsappRoutes);

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

// ==========================================
// 🔥 REDIS CLIENT 
// ==========================================
const pubClient = createClient({ 
  url: process.env.REDIS_URL
});

pubClient.on('error', (err) => {
  logWarn('⚠️ Redis Client Warning / Offline:', { error: err.message });
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
    logInfo("✅ Socket.IO Redis Adapter Connected Successfully!");
  } catch (err) {
    logWarn("⚠️ Redis connection failed (Running in standalone mode):", { error: err.message });
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
    logInfo('✅ Jack Essentials Production Database Connected with Pool Tuning!');
    
    const client = mongoose.connection.getClient();
    if (client && client.on) {
      client.on('commandSucceeded', (event) => {
        if (event.duration > 300) {
          logWarn('SLOW QUERY DETECTED', {
            command: event.commandName,
            database: event.databaseName,
            durationMs: event.duration
          });
        }
      });
    }

    cron.schedule('*/30 * * * *', () => {
      logInfo("⏰ Running scheduled abandoned cart queue job...");
      queueAbandonedCarts();
    });

    cron.schedule('0 */6 * * *', () => {
      const ioInstance = app.get('io');
      processSmartPriceDropRecommendations(ioInstance);
    });
  })
  .catch((err) => {
    logError('Database Connection Failed', err);
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

// 🔥 LEGACY AI CHAT ROUTE
app.use('/', aiChatLimiter, require('./routes/aiAssistant'));

// 🔥 NEW PREMIUM SUPPORT ARCHITECTURE ROUTES
app.use('/api/support', aiChatLimiter, require('./routes/support'));
app.use('/api/support/agents', require('./routes/supportAgent'));
app.use('/api/support/conversations', require('./routes/supportConversation'));
app.use('/api/support/knowledge', require('./routes/supportKnowledge'));
app.use('/api/support/tickets', require('./routes/supportTickets'));
app.use('/api/support/webhooks', require('./routes/supportWebhooks'));

app.use('/', require('./routes/reviews'));
app.use('/', require('./routes/questions'));
app.use('/', require('./routes/wishlist'));
app.use('/', require('./routes/priceAlerts').router);
app.use('/', require('./routes/stockAlerts').router);

// ==========================================
// 🔥 SECURED: AI CATALOG GENERATOR (ADMIN ONLY - USING @google/genai) 
// ==========================================
app.post('/api/generate-catalog', protect, admin, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) return res.status(500).json({ error: "No Gemini API Keys Configured" });
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: "Image data missing" });

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    
    const prompt = `You are an expert E-commerce SEO specialist. Analyze this product image and return ONLY a valid JSON object with these exact keys: title, description, category, brand, price, mrp, sku, color, size, material, searchKeywords. Do not include any markdown formatting or extra text outside the JSON.`;

    let result = null;
    let lastError = null;

    for (const currentKey of apiKeys) {
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: 'user', parts: [{ text: prompt }, { inlineData: { data: cleanBase64, mimeType: mimeType } }] }
          ],
          config: { maxOutputTokens: 2048 }
        });
        result = response;
        break;
      } catch (err) { lastError = err; }
    }

    if (!result) throw lastError || new Error("All Gemini API Keys Failed");

    const responseText = (result.text || "").trim();
    logInfo("🤖 Raw Gemini Catalog Response received");

    let finalJson;
    try {
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      finalJson = JSON.parse(cleanedText);
    } catch (parseError) { 
      logError("❌ JSON Parse Failed for AI Response:", parseError);
      finalJson = { error: "Failed to parse AI response", raw: responseText }; 
    }

    return res.status(200).json(finalJson);
  } catch (error) { 
    logError("Catalog Generation Route Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' }); 
  }
});

// ==========================================
// 🔥 SECURED: HARDENED AI CHAT ROUTE (WITH @google/genai & ABUSE PROTECTIONS)
// ==========================================
app.post('/api/chat', aiChatLimiter, async (req, res) => {
  try {
    const { message, chatHistory, languageStyle } = req.body;
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) return res.status(500).json({ error: 'Gemini AI Service configuration missing' });

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message exceeds maximum allowed length of 1000 characters' });
    }

    const safeHistory = Array.isArray(chatHistory) ? chatHistory.slice(-10) : [];
    const serverSystemInstruction = "You are an official, helpful, and polite customer support assistant for Jack Essentials. Assist customers with store products, orders, and policies safely and accurately.";

    const formattedContents = [];
    safeHistory.forEach(msg => {
      formattedContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof msg.content === 'string' ? msg.content : (msg.text || "") }]
      });
    });
    formattedContents.push({ role: 'user', parts: [{ text: message }] });

    let result = null;
    let lastError = null;

    for (const currentKey of apiKeys) {
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI Request timed out')), 12000)
        );
        
        const response = await Promise.race([
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: formattedContents,
            config: {
              systemInstruction: serverSystemInstruction,
              temperature: 0.7,
              maxOutputTokens: 1024
            }
          }),
          timeoutPromise
        ]);

        result = response;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!result) throw lastError || new Error("All Gemini API Keys Failed");

    const replyText = (result.text || "").trim();
    res.json({ reply: replyText });
    
  } catch (error) { 
    logError("AI Chat Error (Gemini):", error);
    res.status(500).json({ 
      error: 'Server code crash',
      reply: req.body?.languageStyle === 'hinglish' 
        ? "Bhai, abhi thoda technical issue aa raha hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
        : "I'm experiencing a minor glitch. Let me connect you with a human agent. [TRANSFER_TO_AGENT]"
    }); 
  }
});

// ==========================================
// 🎟️ SECURED: SOCKET.IO AUTHENTICATION (Distinct Session Namespaces)
// ==========================================
io.use(async (socket, next) => {
  try {
    let token = socket.handshake.auth.token;

    if (!token && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
        const eqIndex = cookie.indexOf('=');
        if (eqIndex > -1) {
          const name = cookie.substring(0, eqIndex).trim();
          const value = cookie.substring(eqIndex + 1).trim();
          acc[name] = value;
        }
        return acc;
      }, {});
      
      token = cookies.admin_session || cookies.customer_session || cookies.admin_token || cookies.token || cookies.jwt || token;
    }

    if (!token) {
      socket.user = { role: 'guest', _id: `guest_${socket.id}`, id: `guest_${socket.id}`, name: 'Guest User', isGuest: true };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded._id;
    const user = await User.findById(userId).select('-password');
    
    if (!user || user.isLocked) {
      socket.user = { role: 'guest', _id: `guest_${socket.id}`, id: `guest_${socket.id}`, name: 'Guest User', isGuest: true };
      return next();
    }
    
    socket.user = user; 
    next();
  } catch (err) {
    socket.user = { role: 'guest', _id: `guest_${socket.id}`, id: `guest_${socket.id}`, name: 'Guest User', isGuest: true };
    next();
  }
});

io.on('connection', (socket) => {
  const identifier = socket.user.email || socket.user.name || socket.id;
  logInfo(`🔒 Secure Connection established`);

  const privilegedRoles = [
    'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
    'warehouse_manager', 'customer_support', 'finance_manager', 
    'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
    'manager', 'catalog', 'support'
  ];

  if (privilegedRoles.includes(socket.user.role)) {
    socket.join('admin_room');
  }

  socket.on('subscribe_admin_channels', (data) => {
    if (!privilegedRoles.includes(socket.user.role)) return;
    
    socket.join('orders');
    socket.join('inventory');
    socket.join('support');
    socket.join('payments');
    socket.join('warehouse');
    socket.join('support_queue');
  });

  socket.on('lock_user_session', (userId) => {
    if (!privilegedRoles.includes(socket.user.role)) return; 
    io.to(userId).emit('force_logout');
  });

  socket.on('escalate_to_human', async (data) => {
    try {
      const secureUserId = socket.user._id ? socket.user._id.toString() : socket.user.id;
      const conversationId = data.conversationId || `conv-${secureUserId}`;

      const conversation = await conversationService.getOrCreateConversation(conversationId, secureUserId, socket.id);
      await escalationService.triggerEscalation(conversation, 'EXPLICIT_REQUEST', io);

      let legacyTicket = await Ticket.findOne({ userId: secureUserId, status: "open" });
      if (!legacyTicket) {
        legacyTicket = new Ticket({
          userId: secureUserId, 
          userName: socket.user.name || 'Guest', 
          orderId: data.orderId,
          messages: (data.history || []).map(msg => ({ sender: msg.sender, text: msg.text }))
        });
      } else {
        (data.history || []).forEach(msg => { legacyTicket.messages.push({ sender: msg.sender, text: msg.text }); });
      }
      await legacyTicket.save();
      
      io.to('admin_room').to('support').emit('ticket.created', legacyTicket);
      io.to('admin_room').emit('new_ticket_alert', legacyTicket);
      
    } catch (err) { logError("Ticket escalation error", err); }
  });

  socket.on('admin_reply', async (data) => {
    try {
      if (!privilegedRoles.includes(socket.user.role)) return; 

      const supportTicket = data.ticketId ? await SupportTicket.findById(data.ticketId) : null;
      const conversationId = data.conversationId || supportTicket?.conversationId;
      const targetRoom = data.userId || supportTicket?.customerId?.toString() || conversationId;
      
      if (conversationId && data.text) {
        const messagePayload = {
          id: `admin-${Date.now()}`,
          messageId: `msg-${Date.now()}`,
          senderType: 'ADMIN',
          senderId: socket.user._id || socket.user.id,
          content: data.text,
          contentType: 'text',
          createdAt: new Date(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        io.to(conversationId).emit('receive_admin_reply', messagePayload);
        if (targetRoom && targetRoom !== conversationId) {
          io.to(targetRoom).emit('receive_admin_reply', messagePayload);
        }
        
        await SupportConversation.findOneAndUpdate(
          { conversationId: conversationId },
          { lastMessageAt: Date.now() }
        );
      }

      if (data.ticketId) {
        const legacyTicket = await Ticket.findById(data.ticketId);
        if (legacyTicket) {
          legacyTicket.messages.push({ sender: 'admin', text: data.text });
          await legacyTicket.save();
          io.to(legacyTicket.userId).emit('receive_admin_reply', { 
            sender: 'admin', 
            text: data.text, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          });
        }
      }
    } catch (err) { logError("Admin Reply Error:", err); }
  });

  socket.on('support:agent_joined', async (data) => {
    try {
      if (!privilegedRoles.includes(socket.user.role) || !data || !data.conversationId) return;
      io.to(data.conversationId).emit('agent_joined', {
        agent: {
          id: socket.user._id || socket.user.id,
          name: socket.user.name,
          department: 'Support'
        }
      });
    } catch (err) { logError("Support Socket Agent Join Error:", err); }
  });

  socket.on('support:typing', (data) => {
    if (data && data.room) {
      socket.to(data.room).emit('support:typing', { 
        sender: socket.user.role, 
        isTyping: Boolean(data.isTyping) 
      });
    }
  });

  socket.on('join_user_room', (userId) => {
    const currentUserId = socket.user._id ? socket.user._id.toString() : socket.user.id;
    if (
      currentUserId === String(userId) ||
      privilegedRoles.includes(socket.user.role)
    ) {
      return socket.join(String(userId));
    }
    return;
  });

  socket.on('join_conversation', async (conversationId) => {
    try {
      if (!conversationId) return;

      if (privilegedRoles.includes(socket.user.role) || ['admin', 'super_admin', 'support', 'customer_support'].includes(socket.user.role)) {
        return socket.join(conversationId);
      }

      const currentUserId = socket.user._id ? socket.user._id.toString() : socket.user.id;

      const conversation = await SupportConversation.findOne({ conversationId });
      if (conversation) {
        const isOwner = (conversation.customerId && conversation.customerId.toString() === currentUserId) ||
                        (conversation.guestId && conversation.guestId.toString() === currentUserId);
        if (isOwner) {
          return socket.join(conversationId);
        }
      }

      const legacyTicket = await Ticket.findOne({ conversationId, userId: currentUserId });
      if (legacyTicket) {
        return socket.join(conversationId);
      }

      logWarn(`⚠️ Unauthorized socket join attempt to conversation ${conversationId}`);
    } catch (err) {
      logError("Join conversation security check error:", err);
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
    } catch (err) { logError("Redis join page error:", err); }
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
    } catch (err) { logError("Redis leave page error:", err); }
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
    } catch (err) { logError("Redis disconnect error:", err); }
  });
});

// ==========================================
// 🔥 UNIFIED ENTERPRISE ERROR HANDLER MOUNT
// ==========================================
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// ==========================================
// 🔥 GRACEFUL SHUTDOWN HANDLER
// ==========================================
const shutdownHandler = async () => {
  logInfo('🔄 Received kill signal, shutting down gracefully...');
  server.close(async () => {
    logInfo('🛑 HTTP server closed.');
    try {
      if (pubClient && pubClient.isOpen) {
        await pubClient.quit();
      }
      if (subClient && subClient.isOpen) {
        await subClient.quit();
      }
      logInfo('🛑 Redis connections closed safely.');

      await mongoose.connection.close(false);
      logInfo('🛑 MongoDB connection closed safely.');
      process.exit(0);
    } catch (err) {
      logError('Error during safe shutdown closure:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logError('🚨 Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdownHandler);
process.on('SIGINT', shutdownHandler);

server.listen(PORT, '0.0.0.0', () => {
  logInfo(`🚀 Jack Essentials Backend running smoothly on port ${PORT}`);
});

module.exports = app;