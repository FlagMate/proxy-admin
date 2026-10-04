/**
 * ProxyCeptor Admin Server
 * Express + MongoDB backend for enterprise admin platform
 * Port: 3010 (or ADMIN_SERVER_PORT)
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { createApp } = require('./app');

const PORT = process.env.ADMIN_SERVER_PORT || 3010;
const VERSION = require('./package.json').version;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/proxyceptor-admin';

let server;
let db;

// Connect to MongoDB with retry logic
async function connectDB() {
  const maxRetries = 10;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log(`[proxy-admin v${VERSION}] Connected to MongoDB`);
      return mongoose.connection;
    } catch (err) {
      retries++;
      console.log(`[proxy-admin v${VERSION}] MongoDB connection failed (attempt ${retries}/${maxRetries}): ${err.message}`);
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }
  
  throw new Error('Failed to connect to MongoDB after max retries');
}

// Seed admin user on first startup
async function seedAdminUser() {
  const User = require('./models/User');
  const ADMIN_EMAIL = 'proxyceptor@gmail.com';

  try {
    const bcrypt = require('bcryptjs');
    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      // Ensure the admin-panel login account can authenticate and has admin role.
      let changed = false;
      if (existing.role !== 'admin') { existing.role = 'admin'; changed = true; }
      if (existing.isAdmin !== true) { existing.isAdmin = true; changed = true; }
      if (!existing.hasPassword || !existing.passwordHash || existing.passwordHash === 'none') {
        existing.passwordHash = await bcrypt.hash('PROXY@navin2026', 10);
        existing.hasPassword = true;
        changed = true;
      }
      if (existing.disabled) { existing.disabled = false; changed = true; }
      if (changed) {
        await existing.save();
        console.log(`[proxy-admin v${VERSION}] Existing user ${ADMIN_EMAIL} promoted to admin-panel login`);
      } else {
        console.log(`[proxy-admin v${VERSION}] Admin login account already configured, skipping seed`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash('PROXY@navin2026', 10);
    await User.create({
      email: ADMIN_EMAIL,
      name: 'System Administrator',
      role: 'admin',
      isAdmin: true,
      authProviders: ['local'],
      hasPassword: true,
      passwordHash,
      disabled: false,
    });
    console.log(`[proxy-admin v${VERSION}] Seed admin user created: ${ADMIN_EMAIL} / PROXY@navin2026`);
  } catch (err) {
    // Never let seeding crash startup; the panel can still serve existing data.
    console.error(`[proxy-admin v${VERSION}] Admin seed skipped: ${err.message}`);
  }
}

// Graceful shutdown
async function shutdown(signal) {
  console.log(`[proxy-admin v${VERSION}] Received ${signal}, shutting down gracefully...`);
  
  if (server) {
    server.close(() => {
      console.log(`[proxy-admin v${VERSION}] HTTP server closed`);
    });
  }
  
  if (db) {
    await mongoose.connection.close();
    console.log(`[proxy-admin v${VERSION}] MongoDB connection closed`);
  }
  
  process.exit(0);
}

// Start server
async function start() {
  try {
    // Connect to MongoDB
    db = await connectDB();
    
    // Seed admin user
    await seedAdminUser();
    
    // Create and start Express app
    const app = createApp();
    server = app.listen(PORT, () => {
      console.log(`[proxy-admin v${VERSION}] Server listening on http://localhost:${PORT}`);
    });
    
    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (err) {
    console.error(`[proxy-admin v${VERSION}] Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// Export for testing
module.exports = { start, createApp };

// Run if called directly
if (require.main === module) {
  start();
}