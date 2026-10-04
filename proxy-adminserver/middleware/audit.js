/**
 * ProxyCeptor Admin Server - Audit Logging Middleware
 * Logs all admin actions to auditLogs collection
 */

const AuditLog = require('../models/AuditLog');

/**
 * Redact sensitive fields from details object
 * @param {Object} details 
 * @returns {Object} Redacted details
 */
function redactDetails(details) {
  if (!details || typeof details !== 'object') return details;
  
  const redacted = { ...details };
  const sensitivePatterns = ['password', 'token', 'secret', 'key', 'apiKey', 'api_key'];
  
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitivePatterns.some(pattern => lowerKey.includes(pattern))) {
      redacted[key] = '[redacted]';
    }
  }
  
  return redacted;
}

/**
 * Log admin action middleware
 */
function logAction(req, res, next) {
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override json to capture response
  res.json = function(data) {
    // Only log successful mutations (POST, PUT, DELETE)
    if (req.method !== 'GET' && req.user && req.user.id) {
      // Determine action type from route
      let action = '';
      let targetId = null;
      let targetType = null;
      
      const path = req.path;
      const userId = req.user.id;
      
      // Extract action from request method and path
      if (path.startsWith('/users')) {
        targetType = 'user';
        if (req.params.id) targetId = req.params.id;
        if (req.method === 'POST') action = 'user.create';
        else if (req.method === 'PUT' || req.method === 'PATCH') action = 'user.update';
        else if (req.method === 'DELETE') action = 'user.delete';
      } else if (path.startsWith('/workspaces')) {
        targetType = 'workspace';
        if (req.params.id) targetId = req.params.id;
        if (path.includes('/rules')) {
          targetType = 'rule';
          if (req.params.ruleId) targetId = req.params.ruleId;
          if (req.method === 'PATCH' || req.method === 'PUT') action = 'rule.update';
          else if (req.method === 'DELETE') action = 'rule.delete';
          else if (req.method === 'POST') action = 'rule.create';
        } else if (req.method === 'POST') action = 'workspace.create';
        else if (req.method === 'PUT' || req.method === 'PATCH') action = 'workspace.update';
        else if (req.method === 'DELETE') action = 'workspace.delete';
      } else if (path.startsWith('/api-keys')) {
        targetType = 'api-key';
        if (req.params.id) targetId = req.params.id;
        if (req.method === 'POST') action = 'api-key.create';
        else if (req.method === 'PUT' || req.method === 'PATCH') action = 'api-key.update';
        else if (req.method === 'DELETE') action = 'api-key.delete';
      } else if (path.includes('/revoke')) {
        action = 'api-key.revoke';
      } else if (path.includes('/activate')) {
        action = 'api-key.activate';
      } else if (path.includes('/transfer-ownership')) {
        action = 'workspace.transfer';
      }
      
      // Create audit log entry (fail-open)
      if (action && data && data.success) {
        const details = redactDetails(req.body);
        
        AuditLog.create({
          userId,
          action,
          targetId,
          targetType,
          details: {
            ...details,
            method: req.method,
            path: req.path,
          },
          timestamp: new Date(),
        }).catch(err => {
          console.error('[audit] Failed to create audit log:', err.message);
        });
      }
    }
    
    return originalJson(data);
  };
  
  next();
}

module.exports = { logAction, redactDetails };

