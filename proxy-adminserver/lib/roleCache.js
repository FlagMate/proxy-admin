/**
 * ProxyCeptor Admin Server - Role Cache
 * LRU cache for user roles with 5-minute TTL
 */

// Simple in-memory cache with TTL
const roleCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get role from cache if not expired
 * @param {string} userId 
 * @returns {string|null} Role or null if not cached/expired
 */
function getRoleFromCache(userId) {
  const cached = roleCache.get(userId);
  if (!cached) return null;
  
  if (Date.now() > cached.expiresAt) {
    roleCache.delete(userId);
    return null;
  }
  
  return cached.role;
}

/**
 * Set role in cache with 5-minute TTL
 * @param {string} userId 
 * @param {string} role 
 */
function setRoleInCache(userId, role) {
  roleCache.set(userId, {
    role,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Invalidate role cache for a user
 * @param {string} userId 
 */
function invalidateRoleCache(userId) {
  roleCache.delete(userId);
}

/**
 * Clear all role caches
 */
function clearAllRoleCaches() {
  roleCache.clear();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  let valid = 0;
  let expired = 0;
  const now = Date.now();
  
  for (const [userId, cached] of roleCache) {
    if (now > cached.expiresAt) {
      expired++;
      roleCache.delete(userId);
    } else {
      valid++;
    }
  }
  
  return { size: roleCache.size, valid, expired };
}

module.exports = {
  getRoleFromCache,
  setRoleInCache,
  invalidateRoleCache,
  clearAllRoleCaches,
  getCacheStats,
  CACHE_TTL_MS,
};

