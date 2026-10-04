/**
 * ProxyCeptor Admin Server - Health Check Routes
 */

const express = require('express');
const mongoose = require('mongoose');
const os = require('os');

const router = express.Router();
const VERSION = require('../../package.json').version;
const { metrics } = require('../../lib/metrics');

/**
 * GET /admin/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  let memoryUsageMB = null;
  let cpuUsagePercent = null;
  
  try {
    const memUsage = process.memoryUsage();
    memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024 * 10) / 10;
  } catch (e) {
    // Ignore
  }
  
  try {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    cpuUsagePercent = Math.round((1 - totalIdle / totalTick) * 100 * 10) / 10;
  } catch (e) {
    // Ignore
  }
  
  const dbState = mongoose.connection.readyState;
  let database = 'disconnected';
  if (dbState === 1) database = 'connected';
  else if (dbState === 2) database = 'connecting';
  
  res.json({
    success: true,
    data: {
      status: database === 'connected' ? 'ok' : 'degraded',
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
      database,
      memoryUsageMB,
      cpuUsagePercent,
    },
  });
});

module.exports = router;

