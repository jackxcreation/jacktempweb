// services/analyticsQueue.js
const { Queue } = require('bullmq');
const Redis = require('ioredis');

// 🔥 CRITICAL FIX: Removed hardcoded TLS. ioredis auto-detects TLS for 'rediss://' (Upstash) and disables it for 'redis://' (Render Internal)
const connection = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    })
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    };

// 🔥 Prevent unhandled Redis error crashes
if (connection instanceof Redis) {
  connection.on('error', (err) => {
    console.error('Redis Analytics Queue Connection Error:', err.message);
  });
}

const analyticsQueue = new Queue('analytics-queue', { connection });

// Handle queue-level errors gracefully
analyticsQueue.on('error', (err) => {
  console.error('Analytics Queue Error:', err.message);
});

const trackEvent = async (type, data) => {
  try {
    if (!analyticsQueue) return;
    await analyticsQueue.add(type, { type, data }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 1000
    });
  } catch (err) {
    console.error("Failed to add analytics event to queue:", err);
  }
};

module.exports = { trackEvent, analyticsQueue };