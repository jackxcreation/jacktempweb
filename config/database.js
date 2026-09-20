// config/database.js
const mongoose = require('mongoose');
const { logger } = require('../utils/logger'); // 🔥 Fixed relative path from config/ to utils/

/**
 * 🔥 TASK #75: Fail-Fast Database Connection Startup
 * In production/staging environments, if the required MongoDB dependency fails to connect,
 * the application must immediately fail-fast (process.exit(1)) rather than silently running degraded.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30000
    });

    console.log(`📦 MongoDB Connected Successfully: ${conn.connection.host}`);
    if (typeof logger !== 'undefined' && logger.info) {
      logger.info({ message: `Database connected successfully to host: ${conn.connection.host}` });
    }
    return conn;
  } catch (error) {
    console.error(`❌ CRITICAL: Database Connection Failed (Fail-Fast Triggered): ${error.message}`);
    if (typeof logger !== 'undefined' && logger.error) {
      logger.error({ 
        message: 'Database connection startup failure - Failing fast', 
        error: error.message, 
        stack: error.stack 
      });
    }
    // Fail-fast process exit so container orchestrators mark container unhealthy
    process.exit(1);
  }
};

module.exports = connectDB;