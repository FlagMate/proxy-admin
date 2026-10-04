/**
 * ProxyCeptor Admin Server - API Keys CRUD Routes
 */

const express = require('express');
const ApiKey = require('../../models/ApiKey');
const Workspace = require('../../models/Workspace');

const router = express.Router();

// Workspace name cache
const workspaceNameCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedWorkspaceName(workspaceId) {
  const cached = workspaceNameCache.get(workspaceId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.name;
  }
  return null;
}

async function getWorkspaceName(workspaceId) {
  let name = getCachedWorkspaceName(workspaceId);
  if (name) return name;
  
  const workspace = await Workspace.findById(workspaceId).lean();
  name = workspace?.name || 'Deleted workspace';
  workspaceNameCache.set(workspaceId, { name, expiresAt: Date.now() + CACHE_TTL_MS });
  return name;
}

/**
 * GET /admin/api-keys
 * List all API keys with pagination
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [apiKeys, total] = await Promise.all([
      ApiKey.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ApiKey.countDocuments(),
    ]);
    
    // Get workspace names
    const keysWithWorkspace = await Promise.all(
      apiKeys.map(async (key) => {
        const workspaceName = await getWorkspaceName(key.workspace);
        return {
          id: String(key._id),
          keyPrefix: key.prefix,
          workspaceId: String(key.workspace),
          workspaceName,
          revoked: key.revoked,
          revokedAt: key.revokedAt,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
        };
      })
    );
    
    res.json({
      success: true,
      data: keysWithWorkspace,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[api-keys] List error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /admin/api-keys/:id
 * Get single API key
 */
router.get('/:id', async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id).lean();
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    const workspaceName = await getWorkspaceName(apiKey.workspace);
    
    res.json({
      success: true,
      data: {
        id: String(apiKey._id),
        keyPrefix: apiKey.prefix,
        workspaceId: String(apiKey.workspace),
        workspaceName,
        name: apiKey.name,
        label: apiKey.label,
        revoked: apiKey.revoked,
        revokedAt: apiKey.revokedAt,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt,
      },
    });
  } catch (err) {
    console.error('[api-keys] Get error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /admin/api-keys
 * Create new API key
 */
router.post('/', async (req, res) => {
  try {
    const { workspaceId, name } = req.body;
    
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Workspace ID is required' });
    }
    
    // Verify workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(400).json({ success: false, error: 'Workspace not found' });
    }
    
    // Generate key
    const { plain, prefix, keyHash } = ApiKey.generateKey();
    
    // Create API key
    const apiKey = await ApiKey.create({
      workspace: workspaceId,
      name: name || 'Default Key',
      label: name || 'Default key',
      prefix,
      keyHash,
      key: plain,
      revoked: false,
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: String(apiKey._id),
        key: plain,
        keyPrefix: apiKey.prefix,
        workspaceId: String(apiKey.workspace),
        workspaceName: workspace.name,
        name: apiKey.name,
        revoked: false,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (err) {
    console.error('[api-keys] Create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /admin/api-keys/:id/revoke
 * Revoke API key
 */
router.put('/:id/revoke', async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    apiKey.revoked = true;
    apiKey.revokedAt = new Date();
    apiKey.lastUsedAt = null;
    await apiKey.save();
    
    const workspaceName = await getWorkspaceName(apiKey.workspace);
    
    res.json({
      success: true,
      data: {
        id: String(apiKey._id),
        keyPrefix: apiKey.prefix,
        workspaceId: String(apiKey.workspace),
        workspaceName,
        revoked: apiKey.revoked,
        revokedAt: apiKey.revokedAt,
      },
    });
  } catch (err) {
    console.error('[api-keys] Revoke error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /admin/api-keys/:id/activate
 * Activate/reinstate API key
 */
router.put('/:id/activate', async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    apiKey.revoked = false;
    apiKey.revokedAt = null;
    await apiKey.save();
    
    const workspaceName = await getWorkspaceName(apiKey.workspace);
    
    res.json({
      success: true,
      data: {
        id: String(apiKey._id),
        keyPrefix: apiKey.prefix,
        workspaceId: String(apiKey.workspace),
        workspaceName,
        revoked: apiKey.revoked,
        revokedAt: apiKey.revokedAt,
      },
    });
  } catch (err) {
    console.error('[api-keys] Activate error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /admin/api-keys/:id/reveal
 * Reveal full API key (admin only)
 */
router.get('/:id/reveal', async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id).lean();
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    const workspaceName = await getWorkspaceName(apiKey.workspace);
    
    res.json({
      success: true,
      data: {
        id: String(apiKey._id),
        key: apiKey.key,
        keyPrefix: apiKey.prefix,
        name: apiKey.name,
        workspaceName,
        revoked: apiKey.revoked,
      },
    });
  } catch (err) {
    console.error('[api-keys] Reveal error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/api-keys/:id
 * Delete API key
 */
router.delete('/:id', async (req, res) => {
  try {
    const apiKey = await ApiKey.findByIdAndDelete(req.params.id);
    
    if (!apiKey) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }
    
    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (err) {
    console.error('[api-keys] Delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

