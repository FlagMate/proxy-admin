/**
 * ProxyCeptor Admin Server - Express App Factory
 * Creates and configures the Express application
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const VERSION = require('./package.json').version;

// Import middleware
const authMiddleware = require('./middleware/auth');
const rbacMiddleware = require('./middleware/rbac');
const auditMiddleware = require('./middleware/audit');
const metricsMiddleware = require('./lib/metrics');

// Import routes
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/admin/health');
const usersRoutes = require('./routes/admin/users');
const workspacesRoutes = require('./routes/admin/workspaces');
const apiKeysRoutes = require('./routes/admin/api-keys');
const auditLogsRoutes = require('./routes/admin/audit-logs');

function createApp() {
  const app = express();
  
  // === Middleware Stack ===
  
  // 1. PNA Headers
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Private-Network', 'true');
    next();
  });
  
  // 2. CORS Configuration
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5180',
      'https://app.proxyceptor.com',
      'https://proxyceptor.com',
    ],
    credentials: true,
  }));
  
  // 3. JSON Body Parsing (5MB limit)
  app.use(express.json({ limit: '5mb' }));
  
  // 4. Request Logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[proxy-admin v${VERSION}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });
  
  // 5. Metrics Tracking
  app.use(metricsMiddleware.trackRequest);
  
  // 6. Health endpoint (no auth required)
  app.use('/admin', healthRoutes);
  
  // 7. Auth routes (login, rate limited)
  app.use('/admin/auth', authRoutes);
  
  // 8. Authentication middleware for protected routes
  app.use('/admin', authMiddleware.verifyToken);
  
  // 9. Audit logging middleware
  app.use('/admin', auditMiddleware.logAction);
  
  // 10. RBAC - require at least viewer role
  app.use('/admin', rbacMiddleware.requireViewer);
  
  // === Protected Routes ===
  
  // Users CRUD
  app.use('/admin/users', usersRoutes);
  
  // Workspaces CRUD
  app.use('/admin/workspaces', workspacesRoutes);
  
  // API Keys CRUD
  app.use('/admin/api-keys', apiKeysRoutes);
  
  // Audit Logs
  app.use('/admin/audit-logs', auditLogsRoutes);
  
  // Metrics (requires editor or admin)
  app.use('/admin/metrics', rbacMiddleware.requireEditor, require('./routes/admin/metrics'));
  
  // === Error Handling ===
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });
  
  // Global error handler
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = status >= 500 ? 'Internal server error' : err.message;
    
    console.error(`[proxy-admin v${VERSION}] Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    
    res.status(status).json({ success: false, error: message });
  });
  
  // Add version header to all responses
  app.use((req, res, next) => {
    res.set('X-Admin-Version', VERSION);
    res.set('X-Proxyceptor-Integration', 'admin');
    next();
  });
  
  return app;
}

module.exports = { createApp };