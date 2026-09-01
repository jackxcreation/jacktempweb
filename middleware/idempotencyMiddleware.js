// middleware/idempotencyMiddleware.js
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
    return res.status(cachedResponse.status).json({
      ...cachedResponse.body,
      replayed: true
    });
  }

  // Intercept res.json to cache the outgoing response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyCache.set(idempotencyKey, {
        status: res.statusCode,
        body: body
      });
    }
    return originalJson(body);
  };

  next();
};

module.exports = { requireIdempotency };