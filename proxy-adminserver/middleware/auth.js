/**
 * ProxyCeptor Admin Server - Authentication Middleware
 * Verifies JWT tokens from proxy-server auth endpoints
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getRoleFromCache, setRoleInCache } = require('../lib/roleCache');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

/**
 * Extract and verify JWT token from Authorization header
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify JWT signature
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded.sub) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    // Get user from database
    let user = await User.findById(decoded.sub).lean();
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    if (user.disabled) {
      return res.status(401).json({ success: false, error: 'Account disabled' });
    }
    
    // Get role from cache or database
    let role = getRoleFromCache(user._id.toString());
    
    if (!role) {
      role = user.role || 'viewer';
      if (user.isAdmin) role = 'admin';
      setRoleInCache(user._id.toString(), role);
    }
    
    // Attach user to request
    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: role,
    };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
    console.error('[auth] Token verification failed:', err.message);
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

module.exports = { verifyToken };

