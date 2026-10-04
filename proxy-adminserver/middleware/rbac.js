/**
 * ProxyCeptor Admin Server - RBAC Middleware
 * Role-based access control guards
 */

/**
 * Require at least viewer role
 */
function requireViewer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  const validRoles = ['admin', 'editor', 'viewer'];
  if (!validRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  
  next();
}

/**
 * Require editor or admin role
 */
function requireEditor(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  const validRoles = ['admin', 'editor'];
  if (!validRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  
  next();
}

/**
 * Require admin role only
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  
  next();
}

module.exports = {
  requireViewer,
  requireEditor,
  requireAdmin,
};

