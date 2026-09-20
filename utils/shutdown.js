// utils/shutdown.js
const mongoose = require('mongoose');
const { logger } = require('./logger');

/**
 * 🔥 TASK #74: Graceful Shutdown Utility
 * Ensures MongoDB, Redis, Socket.io, and HTTP server connections properly close 
 * before exiting the application process upon receiving termination signals.
 * 
 * @param {Object} server - Node.js HTTP server instance
 * @param {Object} [io] - Socket.io server instance
 * @param {Object} [redisClient] - Redis client instance (optional if Redis is used)
 */
const setupGracefulShutdown = (server, io = null, redisClient = null) => {
  const shutdown = async (signal) => {
    console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown sequence...`);
    logger.info({ message: `Received ${signal}. Closing HTTP server, WebSockets, Redis, and Database sessions gracefully.` });

    // 1. Close Socket.io connections cleanly
    if (io && typeof io.close === 'function') {
      try {
        io.close(() => {
          console.log('🔌 Socket.io connections closed.');
        });
      } catch (socketErr) {
        console.error('❌ Error closing Socket.io:', socketErr.message);
      }
    }

    // 2. Close Redis client connection if configured
    if (redisClient) {
      try {
        if (typeof redisClient.quit === 'function') {
          await redisClient.quit();
          console.log('📦 Redis connection closed via quit().');
        } else if (typeof redisClient.disconnect === 'function') {
          redisClient.disconnect();
          console.log('📦 Redis connection disconnected.');
        }
      } catch (redisErr) {
        console.error('❌ Error closing Redis connection:', redisErr.message);
      }
    }

    // 3. Stop accepting new HTTP requests and close server
    server.close(async () => {
      console.log('🌐 HTTP server closed.');

      try {
        // 4. Close Mongoose / MongoDB database connection gracefully
        await mongoose.connection.close(false);
        console.log('📦 MongoDB connection closed gracefully.');
        
        console.log('✅ Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (dbCloseErr) {
        console.error('❌ Error during MongoDB disconnection:', dbCloseErr);
        process.exit(1);
      }
    });

    // 5. Forceful shutdown safeguard timeout (10 seconds fallback if cleanup hangs)
    setTimeout(() => {
      console.error('❌ Forced shutdown triggered: Cleanup operation timed out after 10 seconds.');
      process.exit(1);
    }, 10000);
  };

  // Register OS termination listeners
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

module.exports = { 
  setupGracefulShutdown 
};