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
const jwt = require('jsonwebtoken');
const cron = require('node-cron'); 
const cookieParser = require('cookie-parser'); 
const rateLimit = require('express-rate-limit');

// 🔥 DATA PROTECTION: Import Sanitized Structured Logger & Request Context (Tasks #45 & #50)
const { logger, requestLoggerMiddleware, logInfo, logError, logWarn } = require('./utils/logger');
const { requestContextMiddleware } = require('./middleware/requestContext');

// 🔥 TASK #72 & #75: Import Startup Environment Validation & Fail-Fast DB
const { validateEnv } = require('./config/env');
const connectDB = require('./config/database');

// 🔥 TASK #74: Import Graceful Shutdown Utility
const { setupGracefulShutdown } = require('./utils/shutdown');

// 🔥 TASK #47: Import Granular API-Specific Rate Limiters
const { 
  loginLimiter, 
  otpLimiter, 
  registerLimiter, 
  chatLimiter, 
  paymentLimiter, 
  searchLimiter, 
  newsletterLimiter 
} = require('./middleware/rateLimit');

// 🔥 SINGLE SOURCE OF TRUTH: Import Models cleanly
const { User, Ticket, Warehouse, Order, Product, Review, Question, PriceAlert, StockAlert } = require('./models');

// 🔥 IMPORT NEW PREMIUM SUPPORT MODELS
const SupportTicket = require('./models/SupportTicket');
const SupportConversation = require('./models/SupportConversation');
const SupportAgent = require('./models/SupportAgent');

// 🔥 IMPORT NEW PREMIUM SUPPORT SERVICES
const escalationService = require('./services/support/escalationService');
const conversationService = require('./services/support/conversationService');
const { verifyTicketAccess } = require('./services/support/ticketService'); // 🔥 TASK #33: Ticket access verification service
const socketRoomService = require('./services/socketRoomService'); // 🔥 TASK #34: Targeted room broadcast service

// 🔥 IMPORT YOUR SECURE MIDDLEWARES
const { protect, admin } = require('./middleware/authMiddleware');
const socketAuthMiddleware = require('./middleware/socketAuth'); // 🔥 TASK #31 & #32 & #33: Socket Auth Middleware

// 🔥 TASK #19: SAFE IMPORT RAW BODY MIDDLEWARE
let rawBodyMiddleware;
try {
  const rawBodyModule = require('./middleware/rawBody');
  rawBodyMiddleware = rawBodyModule.rawBodyMiddleware || rawBodyModule;
} catch (e) {
  rawBodyMiddleware = express.json({
    verify: (req, res, buf) => {
      if (buf && buf.length) req.rawBody = buf.toString('utf8');
    }
  });
}

// 🔥 TASK #49: IMPORT UNIFIED STANDARDIZED ERROR MIDDLEWARE
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

// 🔥 TASK #73: IMPORT HEALTH & READINESS ROUTES
const healthRoutes = require('./routes/health');

const { GoogleGenAI } = require('@google/genai'); // 🔥 MODERN SDK IMPORT

dotenv.config();

// 🔥 TASK #72: Strict Startup Configuration Validation (Fail-Fast)
validateEnv();

console.log("JWT configured:", Boolean(process.env.JWT_SECRET));

// ==========================================
// 🔥 ANTI-CRASH SYSTEM
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

app.use(cookieParser());

// ==========================================
// 🌐 CORS ALLOWLIST
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
// 🛡️ RATE LIMITERS (TASK #47)
// ==========================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: { success: false, code: 'RATE_LIMIT_EXCEEDED', message: "Too many requests from this IP, please try again later." }
});
app.use(globalLimiter);

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/otp', otpLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/chat', chatLimiter);
app.use('/api/payments', paymentLimiter);
app.use('/api/search', searchLimiter);
app.use('/api/newsletter', newsletterLimiter);

app.use(requestContextMiddleware);
app.use(requestLoggerMiddleware);

if (typeof rawBodyMiddleware === 'function') {
  app.use('/api/payment/webhook', rawBodyMiddleware);
}

app.use('/api/generate-catalog', express.json({ limit: '5mb' })); 
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// ==========================================
// 🛡️ SAFE ROUTE MOUNTING HELPER (Prevents app.use crashes)
// ==========================================
const safeMount = (path, routeModule) => {
  try {
    const router = routeModule.router || routeModule;
    if (typeof router === 'function') {
      app.use(path, router);
    } else {
      logWarn(`⚠️ Route module at '${path}' is not a valid router function.`);
    }
  } catch (err) {
    logWarn(`⚠️ Failed to mount route '${path}': ${err.message}`);
  }
};

// Mount payment routes safely
try {
  const paymentRoutes = require('./routes/payment');
  safeMount('/api', paymentRoutes);
} catch (e) {
  logWarn('⚠️ Payment routes mount warning:', e.message);
}

// Mount whatsapp routes safely using safeMount
safeMount('/api/whatsapp', whatsappRoutes);

app.use('/', healthRoutes);
app.use('/api', healthRoutes);

const checkAccountStatus = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.query.userId;
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.isLocked) {
        return res.status(403).json({ success: false, code: 'ACCOUNT_LOCKED', message: "Account is Locked! Access Denied.", requestId: req.requestId });
      }
    }
    next();
  } catch (err) { next(); }
};

// ==========================================
// 🚀 MOUNTED REST ROUTES (Safely Wrapped)
// ==========================================
safeMount('/', require('./routes/products'));
safeMount('/', require('./routes/users'));
app.use('/', checkAccountStatus);
safeMount('/', require('./routes/orders')); 
safeMount('/', require('./routes/admin'));
safeMount('/api/auth', require('./routes/auth'));
safeMount('/', require('./routes/warehouse'));
safeMount('/api/settings', require('./routes/settings'));
safeMount('/api', require('./routes/deliveryCheck'));
safeMount('/', require('./routes/tracking'));
safeMount('/', require('./routes/content'));
safeMount('/', require('./routes/googleMerchantFeed'));
safeMount('/', require('./routes/subscribers'));
safeMount('/', require('./routes/ssrProduct'));
safeMount('/', require('./routes/aiAssistant'));

safeMount('/api/support', require('./routes/support'));
safeMount('/api/support/agents', require('./routes/supportAgent'));
safeMount('/api/support/conversations', require('./routes/supportConversation'));
safeMount('/api/support/knowledge', require('./routes/supportKnowledge'));
safeMount('/api/support/tickets', require('./routes/supportTickets'));
safeMount('/api/support/webhooks', require('./routes/supportWebhooks'));
safeMount('/', require('./routes/ticket')); 

safeMount('/', require('./routes/reviews'));
safeMount('/', require('./routes/questions'));
safeMount('/', require('./routes/wishlist'));

try {
  const priceAlerts = require('./routes/priceAlerts');
  if (priceAlerts && priceAlerts.router) app.use('/', priceAlerts.router);
} catch (e) {}

try {
  const stockAlerts = require('./routes/stockAlerts');
  if (stockAlerts && stockAlerts.router) app.use('/', stockAlerts.router);
} catch (e) {}

// ==========================================
// 🔥 SECURED: AI CATALOG GENERATOR
// ==========================================
app.post('/api/generate-catalog', protect, admin, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) return res.status(500).json({ success: false, code: 'AI_CONFIG_MISSING', message: "No Gemini API Keys Configured", requestId: req.requestId });
    if (!imageBase64 || !mimeType) return res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: "Image data missing", requestId: req.requestId });

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
    let finalJson;
    try {
      const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      finalJson = JSON.parse(cleanedText);
    } catch (parseError) { 
      finalJson = { error: "Failed to parse AI response", raw: responseText }; 
    }

    return res.status(200).json({ success: true, data: finalJson, requestId: req.requestId });
  } catch (error) { 
    return res.status(500).json({ success: false, code: 'CATALOG_GEN_FAILED', message: error.message || 'Internal Server Error', requestId: req.requestId }); 
  }
});

// ==========================================
// 🔥 SECURED: HARDENED AI CHAT ROUTE
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, chatHistory, languageStyle } = req.body;
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) return res.status(500).json({ success: false, code: 'AI_CONFIG_MISSING', message: 'Gemini AI Service configuration missing', requestId: req.requestId });
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, code: 'EMPTY_MESSAGE', message: 'Message cannot be empty', requestId: req.requestId });
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
    res.json({ success: true, reply: replyText, requestId: req.requestId });
    
  } catch (error) { 
    res.status(500).json({ 
      success: false,
      code: 'AI_CHAT_FAILED',
      message: 'Server code crash',
      reply: req.body?.languageStyle === 'hinglish' 
        ? "Bhai, abhi thoda technical issue aa raha hai. Main aapko human agent se connect kar raha hoon. [TRANSFER_TO_AGENT]" 
        : "I'm experiencing a minor glitch. Let me connect you with a human agent. [TRANSFER_TO_AGENT]",
      requestId: req.requestId
    }); 
  }
});

// ==========================================
// 🔥 SOCKET.IO CONNECTION & SERVER STARTUP
// ==========================================
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { 
    origin: allowedOrigins, 
    methods: ["GET", "POST"],
    credentials: true 
  } 
});

socketRoomService.setIO(io);

const pubClient = createClient({ 
  url: process.env.REDIS_URL
});

pubClient.on('error', (err) => {
  logWarn('⚠️ Redis Client Warning / Offline:', { error: err.message });
});

const subClient = pubClient.duplicate();
subClient.on('error', (err) => {});

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

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const identifier = socket.user.email || socket.user.name || socket.id;
  logInfo(`🔒 Secure Connection established for [${socket.user.role}]`);

  const privilegedRoles = [
    'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
    'warehouse_manager', 'customer_support', 'finance_manager', 
    'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
    'manager', 'catalog', 'support'
  ];

  if (socket.user.isPrivileged || privilegedRoles.includes(socket.user.role)) {
    socket.join('admin_room');
  }

  socket.on('subscribe_admin_channels', (data) => {
    if (!socket.user.isPrivileged && !privilegedRoles.includes(socket.user.role)) return;
    socket.join('orders');
    socket.join('inventory');
    socket.join('support');
    socket.join('payments');
    socket.join('warehouse');
    socket.join('support_queue');
  });

  socket.on('lock_user_session', (userId) => {
    if (!socket.user || !socket.user.isPrivileged) return; 
    socketRoomService.emitToUser(userId, 'force_logout');
  });

  socket.on('escalate_to_human', async (data) => {
    try {
      const secureUserId = socket.user._id ? socket.user._id.toString() : socket.user.id;
      const conversationId = data.conversationId || `conv-${secureUserId}`;

      const conversation = await conversationService.getOrCreateConversation(conversationId, secureUserId, socket.id);
      await escalationService.triggerEscalation(conversation, 'EXPLICIT_REQUEST', io);

      let legacyTicket = await Ticket.findOne({ conversationId }) || await Ticket.findOne({ userId: secureUserId, status: "OPEN" });
      if (!legacyTicket) {
        legacyTicket = new Ticket({
          userId: secureUserId, 
          customerId: secureUserId,
          conversationId,
          userName: socket.user.name || 'Guest', 
          orderId: data.orderId,
          priority: 'MEDIUM',
          status: 'OPEN',
          slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastCustomerMessageAt: new Date(),
          messages: (data.history || []).map(msg => ({ 
            sender: (msg.sender || 'USER').toUpperCase(), 
            text: msg.text,
            timestamp: msg.timestamp || new Date()
          }))
        });
      } else {
        (data.history || []).forEach(msg => { 
          legacyTicket.messages.push({ 
            sender: (msg.sender || 'USER').toUpperCase(), 
            text: msg.text,
            timestamp: msg.timestamp || new Date()
          }); 
        });
        legacyTicket.lastCustomerMessageAt = new Date();
      }
      await legacyTicket.save();

      conversation.ticketId = legacyTicket._id;
      conversation.mode = 'HUMAN_ACTIVE';
      conversation.status = 'ESCALATED';
      await conversation.save();
      
      socketRoomService.emitSupportQueueEvent('ticket.created', legacyTicket);
      socketRoomService.emitSupportQueueEvent('new_ticket_alert', legacyTicket);
      socketRoomService.emitToConversation(conversationId, 'ticketUpdated', legacyTicket);
    } catch (err) { logError("Ticket escalation error", err); }
  });

  socket.on('admin_reply', async (data) => {
    try {
      if (!socket.user || !socket.user.isPrivileged) return; 

      const accessCheck = await verifyTicketAccess(data.ticketId, data.conversationId, socket.user);
      if (!accessCheck.success) return;

      const supportTicket = accessCheck.ticket;
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

        socketRoomService.emitToConversation(conversationId, 'receive_admin_reply', messagePayload);
        if (targetRoom && targetRoom !== conversationId) {
          socketRoomService.emitToUser(targetRoom, 'receive_admin_reply', messagePayload);
        }
        
        await SupportConversation.findOneAndUpdate(
          { conversationId: conversationId },
          { lastMessageAt: Date.now() }
        );
      }

      if (data.ticketId) {
        const legacyTicket = await Ticket.findById(data.ticketId);
        if (legacyTicket) {
          legacyTicket.messages.push({ sender: 'ADMIN', text: data.text, timestamp: new Date() });
          await legacyTicket.save();
          socketRoomService.emitToUser(legacyTicket.userId, 'receive_admin_reply', { 
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
      if (!socket.user.isPrivileged || !data || !data.conversationId) return;
      socketRoomService.emitToConversation(data.conversationId, 'agent_joined', {
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
    if (socket.user.isGuest) return;
    const currentUserId = socket.user._id ? socket.user._id.toString() : socket.user.id;
    if (
      currentUserId === String(userId) ||
      socket.user.isPrivileged ||
      privilegedRoles.includes(socket.user.role)
    ) {
      return socket.join(String(userId));
    }
  });

  socket.on('join_conversation', async (conversationId) => {
    try {
      if (!conversationId) return;
      if (socket.user.isPrivileged || privilegedRoles.includes(socket.user.role)) {
        return socket.join(conversationId);
      }
      if (socket.user.isGuest) return;

      const currentUserId = socket.user._id ? socket.user._id.toString() : socket.user.id;
      const conversation = await SupportConversation.findOne({ conversationId });
      if (conversation) {
        const isOwner = (conversation.customerId && conversation.customerId.toString() === currentUserId) ||
                        (conversation.guestId && conversation.guestId.toString() === currentUserId);
        if (isOwner) return socket.join(conversationId);
      }

      const legacyTicket = await Ticket.findOne({ conversationId, userId: currentUserId });
      if (legacyTicket) return socket.join(conversationId);
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
        socketRoomService.emitLiveTraffic(visitorsArray);
      }
    } catch (err) { logError("Redis join page error:", err); }
  });

  socket.on('leave_product_page', async () => {
    try {
      if (pubClient.isOpen) {
        await pubClient.hDel('live_visitors', socket.id);
        const allVisitorsObj = await pubClient.hGetAll('live_visitors');
        const visitorsArray = Object.values(allVisitorsObj).map(v => JSON.parse(v));
        socketRoomService.emitLiveTraffic(visitorsArray);
      }
    } catch (err) { logError("Redis leave page error:", err); }
  });

  socket.on('disconnect', async () => {
    try {
      if (pubClient.isOpen) {
        await pubClient.hDel('live_visitors', socket.id);
        const allVisitorsObj = await pubClient.hGetAll('live_visitors');
        const visitorsArray = Object.values(allVisitorsObj).map(v => JSON.parse(v));
        socketRoomService.emitLiveTraffic(visitorsArray);
      }
    } catch (err) { logError("Redis disconnect error:", err); }
  });
});

app.use(errorHandler);

setupGracefulShutdown(server, io, pubClient);

// 🔥 FIX: Ensure DB connects FIRST, then start taking HTTP traffic
connectDB().then(() => {
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

  // 🚀 Start accepting traffic ONLY after DB is ready
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    logInfo(`🚀 Jack Essentials Backend running smoothly on port ${PORT}`);
  });

}).catch((err) => {
  logError('Database Connection Failed (Fail-Fast)', err);
  process.exit(1);
});

module.exports = app;