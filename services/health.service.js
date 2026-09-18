// services/health.service.js
const mongoose = require('mongoose');

/**
 * Enterprise System Health & Diagnostics Service
 * Verifies database connectivity, memory usage, uptime, and system metrics.
 */
const getSystemHealth = async () => {
  const dbState = mongoose.connection.readyState;
  const dbStatesMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };

  const isDbHealthy = dbState === 1;

  // Memory usage metrics conversion to Megabytes (MB)
  const memoryUsage = process.memoryUsage();
  const formatMB = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

  const memoryStats = {
    rss: `${formatMB(memoryUsage.rss)} MB`,
    heapTotal: `${formatMB(memoryUsage.heapTotal)} MB`,
    heapUsed: `${formatMB(memoryUsage.heapUsed)} MB`,
    external: `${formatMB(memoryUsage.external)} MB`
  };

  return {
    status: isDbHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: isDbHealthy ? 'UP' : 'DOWN',
      state: dbStatesMap[dbState] || 'unknown',
      host: mongoose.connection.host || 'unknown'
    },
    memory: memoryStats,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  };
};

module.exports = {
  getSystemHealth
};