/**
 * ProxyCeptor Admin Server - Metrics Tracking
 * Circular buffer for request metrics
 */

const VERSION = require('../package.json').version;

// In-memory metrics storage
const metrics = {
  requestsTotal: 0,
  requestsByStatus: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  requestsByEndpoint: {},
  responseTimes: [],
  maxResponseTimes: 10000,
  startTime: Date.now(),
};

// Circular buffer for response times
let responseTimeIndex = 0;

/**
 * Track incoming request
 */
function trackRequest(req, res, next) {
  const start = Date.now();
  
  // Track response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusCategory = getStatusCategory(statusCode);
    const endpoint = req.method + ' ' + getEndpointKey(req.path);
    
    // Update counters
    metrics.requestsTotal++;
    metrics.requestsByStatus[statusCategory]++;
    metrics.requestsByEndpoint[endpoint] = (metrics.requestsByEndpoint[endpoint] || 0) + 1;
    
    // Add to circular buffer
    if (metrics.responseTimes.length < metrics.maxResponseTimes) {
      metrics.responseTimes.push(duration);
    } else {
      metrics.responseTimes[responseTimeIndex] = duration;
      responseTimeIndex = (responseTimeIndex + 1) % metrics.maxResponseTimes;
    }
  });
  
  next();
}

/**
 * Get status category
 */
function getStatusCategory(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  return '5xx';
}

/**
 * Normalize endpoint path
 */
function getEndpointKey(path) {
  // Normalize IDs in path
  return path.replace(/\/[a-f0-9]{24}/g, '/:id');
}

/**
 * Calculate average response time
 */
function calculateAvgResponseTime() {
  if (metrics.responseTimes.length === 0) return 0;
  const sum = metrics.responseTimes.reduce((a, b) => a + b, 0);
  return Math.round(sum / metrics.responseTimes.length);
}

/**
 * Calculate p95 response time using linear interpolation
 */
function calculateP95ResponseTime() {
  if (metrics.responseTimes.length === 0) return 0;
  
  const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const fractional = (sorted.length * 0.95) - p95Index;
  
  if (p95Index >= sorted.length - 1) {
    return sorted[sorted.length - 1];
  }
  
  // Linear interpolation
  const p95 = sorted[p95Index] + fractional * (sorted[p95Index + 1] - sorted[p95Index]);
  return Math.round(p95);
}

/**
 * Get current metrics
 */
function getMetrics() {
  return {
    requestsTotal: metrics.requestsTotal,
    requestsByStatus: { ...metrics.requestsByStatus },
    requestsByEndpoint: { ...metrics.requestsByEndpoint },
    avgResponseTimeMs: calculateAvgResponseTime(),
    p95ResponseTimeMs: calculateP95ResponseTime(),
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
  };
}

/**
 * Reset metrics
 */
function resetMetrics() {
  metrics.requestsTotal = 0;
  metrics.requestsByStatus = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  metrics.requestsByEndpoint = {};
  metrics.responseTimes = [];
  responseTimeIndex = 0;
  metrics.startTime = Date.now();
}

module.exports = {
  trackRequest,
  getMetrics,
  resetMetrics,
  metrics,
};

