// src/middleware/idempotencyMiddleware.js
const NodeCache = require('node-cache');
// Store idempotent responses for 10 minutes (TTL = 600 seconds)
const idempotencyCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const requireIdempotency = (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  // Agar critical mutation route hai, toh key mandatory kar sakte hain ya optional rakh sakte hain
  if (!idempotencyKey) {
    return next(); // Agar key nahi di toh request proceed hone do (optional strictness ke liye)
  }

  const cachedResponse = idempotencyCache.get(idempotencyKey);
  if (cachedResponse) {
    console.log(`🛡️ Idempotency Triggered: Replaying cached response for key: ${idempotencyKey}`);
    
    // 🔥 Pro Feature: Set audit header for replayed requests
    res.setHeader('X-Idempotent-Replayed', 'true');

    // Handle concurrent duplicate requests currently processing
    if (cachedResponse.pending) {
      return res.status(409).json({
        success: false,
        message: 'A request with this idempotency key is currently being processed.',
        replayed: true
      });
    }

    return res.status(cachedResponse.status).json({
      ...cachedResponse.body,
      replayed: true
    });
  }

  // 🔥 Pro Feature: Set a pending lock in cache to prevent race conditions
  idempotencyCache.set(idempotencyKey, { pending: true });

  // Intercept res.json to cache the outgoing response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyCache.set(idempotencyKey, {
        status: res.statusCode,
        body: body,
        pending: false
      });
    } else {
      // If request failed, remove lock so client can safely retry
      idempotencyCache.del(idempotencyKey);
    }
    return originalJson(body);
  };

  // 🔥 Also intercept res.send for format safety
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      let parsedBody = body;
      try {
        if (typeof body === 'string') parsedBody = JSON.parse(body);
      } catch (e) {
        // Keep as string if not JSON
      }
      idempotencyCache.set(idempotencyKey, {
        status: res.statusCode,
        body: parsedBody,
        pending: false
      });
    } else {
      idempotencyCache.del(idempotencyKey);
    }
    return originalSend(body);
  };

  next();
};

module.exports = { requireIdempotency };