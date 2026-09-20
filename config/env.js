// config/env.js
/**
 * 🔥 TASK #72: Fail-Fast Startup Configuration Validation
 * Validates that critical environment variables exist before starting the server.
 */
const validateEnv = () => {
  const requiredEnvs = ['MONGO_URI', 'JWT_SECRET'];
  const missing = requiredEnvs.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error(`❌ CRITICAL: Missing required environment variables in .env: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  console.log('✅ Environment configuration validated successfully.');
};

module.exports = {
  validateEnv
};