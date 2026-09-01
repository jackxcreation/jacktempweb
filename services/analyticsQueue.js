// services/analyticsQueue.js
const { Queue } = require('bullmq');
const Redis = require('ioredis');

// 🔥 Robust Upstash / Cloud Redis connection config using REDIS_URL and TLS
const connection = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      tls: {
        rejectUnauthorized: false
      },
      maxRetriesPerRequest: null
    })
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null
    };

const analyticsQueue = new Queue('analytics-queue', { connection });

const trackEvent = async (type, data) => {
  try {
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

module.exports = { trackEvent };