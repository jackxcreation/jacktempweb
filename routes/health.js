// routes/health.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * @route   GET /api/health
 * @desc    Basic liveness probe for load balancers and uptime monitors
 * @access  Public
 */
router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'UP',
    service: 'Jack Essentials API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    requestId: req.requestId || 'N/A'
  });
});

/**
 * @route   GET /api/health/ready
 * @desc    Readiness probe verifying database and external dependency health
 * @access  Public
 */
router.get('/ready', async (req, res) => {
  try {
    // Check MongoDB connection state (1 = connected)
    const dbState = mongoose.connection.readyState;
    const isDbConnected = dbState === 1;

    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };

    const healthStatus = {
      status: isDbConnected ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'N/A',
      checks: {
        database: {
          status: isDbConnected ? 'UP' : 'DOWN',
          state: dbStates[dbState] || 'unknown',
          host: mongoose.connection.host || 'unknown'
        }
      }
    };

    if (!isDbConnected) {
      return res.status(503).json({
        success: false,
        message: 'Service Unavailable: Database connection is not established.',
        ...healthStatus
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Service is healthy and ready to accept traffic.',
      ...healthStatus
    });
  } catch (error) {
    console.error('❌ Health Check Readiness Error:', error.message);
    return res.status(503).json({
      success: false,
      status: 'ERROR',
      message: error.message || 'Readiness probe failed',
      requestId: req.requestId || 'N/A'
    });
  }
});

module.exports = router;