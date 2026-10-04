/**
 * ProxyCeptor Admin Server - Auth Routes
 * Login endpoint with rate limiting
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

// Simple in-memory rate limiter (5 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

/**
 * Check rate limit
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

/**
 * POST /admin/auth/login
 */
router.post('/login', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }
  
  try {
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    if (user.disabled) {
      return res.status(401).json({ success: false, error: 'Account disabled' });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Determine role
    let role = user.role || 'viewer';
    if (user.isAdmin) role = 'admin';
    
    // Generate JWT
    const token = jwt.sign(
      { sub: String(user._id), email: user.email, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role,
        },
      },
    });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

