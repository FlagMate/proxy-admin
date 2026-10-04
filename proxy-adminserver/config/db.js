/**
 * ProxyCeptor Admin Server - MongoDB Connection
 * Reuses the same MongoDB connection as proxy-server
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/proxyceptor';

let connection = null;

/**
 * Connect to MongoDB with retry logic
 * @returns {Promise<typeof mongoose>}
 */
async function connect() {
  if (connection) {
    return connection;
  }
  
  try {
    connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.error('[admin-server] Connected to MongoDB');
    return connection;
  } catch (err) {
    console.error('[admin-server] MongoDB connection error:', err.message);
    throw err;
  }
}

/**
 * Get the mongoose connection instance
 * @returns {typeof mongoose.connection}
 */
function getConnection() {
  return mongoose.connection;
}

/**
 * Close the MongoDB connection
 */
async function close() {
  if (connection) {
    await mongoose.connection.close();
    connection = null;
    console.error('[admin-server] MongoDB connection closed');
  }
}

module.exports = {
  connect,
  getConnection,
  close,
  mongoose,
};

