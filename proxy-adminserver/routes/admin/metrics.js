/**
 * ProxyCeptor Admin Server - Metrics Routes
 */

const express = require('express');
const { getMetrics, resetMetrics } = require('../../lib/metrics');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * GET /admin/metrics
 * Get current metrics
 */
router.get('/', (req, res) => {
  const metricsData = getMetrics();
  
  // Add database connection pool info
  let dbConnectionPoolSize = null;
  try {
    if (mongoose.connection.pool) {
      dbConnectionPoolSize = mongoose.connection.pool.size;
    }
  } catch (e) {
    // Ignore
  }
  
  res.json({
    success: true,
    data: {
      ...metricsData,
      activeConnections: 1, // Simplified for Express
      dbConnectionPoolSize,
    },
  });
});

/**
 * POST /admin/metrics/reset
 * Reset metrics
 */
router.post('/reset', (req, res) => {
  resetMetrics();
  
  res.json({
    success: true,
    data: {
      resetAt: Date.now(),
    },
  });
});

module.exports = router;

