/**
 * ProxyCeptor Admin Server - Workspaces CRUD Routes
 */

const express = require('express');
const Workspace = require('../../models/Workspace');
const User = require('../../models/User');
const Rule = require('../../models/Rule');
const ApiKey = require('../../models/ApiKey');

const router = express.Router();

// Simple workspace name cache (5 min TTL)
const workspaceNameCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedWorkspaceName(workspaceId) {
  const cached = workspaceNameCache.get(workspaceId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.name;
  }
  return null;
}

function setCachedWorkspaceName(workspaceId, name) {
  workspaceNameCache.set(workspaceId, {
    name,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function invalidateWorkspaceCache(workspaceId) {
  workspaceNameCache.delete(workspaceId);
}

/**
 * GET /admin/workspaces
 * List all workspaces with pagination and rule counts
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [workspaces, total] = await Promise.all([
      Workspace.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'email name disabled')
        .lean(),
      Workspace.countDocuments(),
    ]);

    // Aggregate rule counts for this page of workspaces
    const wsIds = workspaces.map(w => w._id);
    const ruleCounts = wsIds.length > 0
      ? await Rule.aggregate([
          { $match: { workspace: { $in: wsIds } } },
          { $group: { _id: '$workspace', count: { $sum: 1 } } },
        ])
      : [];
    const ruleCountMap = Object.fromEntries(ruleCounts.map(r => [String(r._id), r.count]));
    
    res.json({
      success: true,
      data: workspaces.map(w => ({
        id: String(w._id),
        name: w.name,
        ownerId: String(w.owner?._id || w.owner),
        ownerEmail: w.owner?.email || 'Unknown',
        ownerName: w.owner?.name || '',
        ownerDisabled: w.owner?.disabled || false,
        memberCount: w.members?.length || 0,
        rulesCount: ruleCountMap[String(w._id)] || 0,
        activeProfileId: w.activeProfile ? String(w.activeProfile) : null,
        createdAt: w.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[workspaces] List error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /admin/workspaces/:id
 * Get single workspace with members and rule count
 */
router.get('/:id', async (req, res) => {
  try {
    const [workspace, rulesCount] = await Promise.all([
      Workspace.findById(req.params.id)
        .populate('owner', 'email name disabled role plan')
        .populate('members.user', 'email name disabled role plan')
        .lean(),
      Rule.countDocuments({ workspace: req.params.id }),
    ]);
    
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    res.json({
      success: true,
      data: {
        id: String(workspace._id),
        name: workspace.name,
        ownerId: String(workspace.owner?._id || workspace.owner),
        ownerEmail: workspace.owner?.email || 'Unknown',
        ownerName: workspace.owner?.name || '',
        ownerDisabled: workspace.owner?.disabled || false,
        ownerPlan: workspace.owner?.plan || 'free',
        members: (workspace.members || []).map(m => ({
          userId: String(m.user?._id || m.user),
          userEmail: m.user?.email || 'Unknown',
          userName: m.user?.name || '',
          userDisabled: m.user?.disabled || false,
          role: m.role,
        })),
        memberCount: workspace.members?.length || 0,
        rulesCount,
        activeProfileId: workspace.activeProfile ? String(workspace.activeProfile) : null,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (err) {
    console.error('[workspaces] Get error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /admin/workspaces/:id/rules
 * Get all rules belonging to this workspace
 */
router.get('/:id/rules', async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id).lean();
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }

    const rules = await Rule.find({ workspace: req.params.id })
      .populate('apiKey', 'name keyPrefix active')
      .sort({ priority: 1, createdAt: -1 })
      .lean();

    const formattedRules = rules.map(r => ({
      id: String(r._id),
      name: r.name,
      enabled: Boolean(r.enabled),
      priority: r.priority,
      workspace: String(r.workspace),
      apiKey: r.apiKey && typeof r.apiKey === 'object'
        ? { id: String(r.apiKey._id), name: r.apiKey.name, keyPrefix: r.apiKey.keyPrefix }
        : null,
      profile: r.profile ? String(r.profile) : null,
      match: r.match || {},
      request: r.request || {},
      response: r.response || {},
      block: Boolean(r.block),
      injectScript: r.injectScript || { enabled: false, code: '' },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json({
      success: true,
      data: formattedRules,
      stats: {
        total: formattedRules.length,
        enabled: formattedRules.filter(r => r.enabled).length,
        disabled: formattedRules.filter(r => !r.enabled).length,
        blocked: formattedRules.filter(r => r.block).length,
        mocked: formattedRules.filter(r => r.response?.body?.enabled).length,
        rewritten: formattedRules.filter(r => r.request?.redirectUrl || r.request?.urlRewrite).length,
      },
    });
  } catch (err) {
    console.error('[workspaces] Get rules error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /admin/workspaces/:id/rules/:ruleId
 * Get a single rule by ID
 */
router.get('/:id/rules/:ruleId', async (req, res) => {
  try {
    const rule = await Rule.findOne({
      _id: req.params.ruleId,
      workspace: req.params.id,
    })
      .populate('apiKey', 'name keyPrefix active')
      .lean();

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found in this workspace' });
    }

    res.json({
      success: true,
      data: {
        id: String(rule._id),
        name: rule.name,
        enabled: Boolean(rule.enabled),
        priority: rule.priority,
        workspace: String(rule.workspace),
        apiKey: rule.apiKey && typeof rule.apiKey === 'object'
          ? { id: String(rule.apiKey._id), name: rule.apiKey.name, keyPrefix: rule.apiKey.keyPrefix }
          : null,
        profile: rule.profile ? String(rule.profile) : null,
        match: rule.match || {},
        request: rule.request || {},
        response: rule.response || {},
        block: Boolean(rule.block),
        injectScript: rule.injectScript || { enabled: false, code: '' },
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      },
    });
  } catch (err) {
    console.error('[workspaces] Get single rule error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /admin/workspaces/:id/rules/:ruleId/toggle
 * Toggle enabled state of a rule
 */
router.patch('/:id/rules/:ruleId/toggle', async (req, res) => {
  try {
    const rule = await Rule.findOne({
      _id: req.params.ruleId,
      workspace: req.params.id,
    });

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    rule.enabled = !rule.enabled;
    await rule.save();

    res.json({
      success: true,
      data: {
        id: String(rule._id),
        enabled: rule.enabled,
      },
    });
  } catch (err) {
    console.error('[workspaces] Toggle rule error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/workspaces/:id/rules/:ruleId
 * Delete a rule from a workspace
 */
router.delete('/:id/rules/:ruleId', async (req, res) => {
  try {
    const deleted = await Rule.findOneAndDelete({
      _id: req.params.ruleId,
      workspace: req.params.id,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    res.json({
      success: true,
      data: { deleted: true, id: req.params.ruleId },
    });
  } catch (err) {
    console.error('[workspaces] Delete rule error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /admin/workspaces
 * Create workspace
 */
router.post('/', async (req, res) => {
  try {
    const { name, ownerId } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    if (name.length > 100) {
      return res.status(400).json({ success: false, error: 'Name must be 100 characters or less' });
    }
    
    if (!ownerId) {
      return res.status(400).json({ success: false, error: 'Owner is required' });
    }
    
    // Verify owner exists
    const owner = await User.findById(ownerId);
    if (!owner) {
      return res.status(400).json({ success: false, error: 'Owner not found' });
    }
    
    // Create workspace
    const workspace = await Workspace.create({
      name: name.trim(),
      owner: ownerId,
      members: [{ user: ownerId, role: 'owner' }],
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: String(workspace._id),
        name: workspace.name,
        ownerId: String(workspace.owner),
        memberCount: 1,
        rulesCount: 0,
        createdAt: workspace.createdAt,
      },
    });
  } catch (err) {
    console.error('[workspaces] Create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /admin/workspaces/:id
 * Update workspace
 */
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Name cannot be empty' });
      }
      if (name.length > 100) {
        return res.status(400).json({ success: false, error: 'Name must be 100 characters or less' });
      }
      workspace.name = name.trim();
      invalidateWorkspaceCache(req.params.id);
    }
    
    await workspace.save();
    
    res.json({
      success: true,
      data: {
        id: String(workspace._id),
        name: workspace.name,
        ownerId: String(workspace.owner),
        memberCount: workspace.members?.length || 0,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (err) {
    console.error('[workspaces] Update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /admin/workspaces/:id/transfer-ownership
 * Transfer workspace ownership
 */
router.post('/:id/transfer-ownership', async (req, res) => {
  try {
    const { newOwnerId } = req.body;
    
    if (!newOwnerId) {
      return res.status(400).json({ success: false, error: 'New owner ID is required' });
    }
    
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    // Verify new owner exists
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return res.status(400).json({ success: false, error: 'New owner not found' });
    }
    
    // Check if new owner is a member
    const isMember = workspace.members.some(m => String(m.user) === newOwnerId);
    if (!isMember) {
      return res.status(400).json({ success: false, error: 'New owner must be a workspace member' });
    }
    
    const oldOwnerId = String(workspace.owner);
    
    // Update members: old owner becomes member, new owner becomes owner
    workspace.members = workspace.members.map(m => {
      if (String(m.user) === oldOwnerId) {
        return { user: m.user, role: 'member' };
      }
      if (String(m.user) === newOwnerId) {
        return { user: m.user, role: 'owner' };
      }
      return m;
    });
    
    workspace.owner = newOwnerId;
    await workspace.save();
    
    invalidateWorkspaceCache(req.params.id);
    
    res.json({
      success: true,
      data: {
        id: String(workspace._id),
        name: workspace.name,
        ownerId: String(workspace.owner),
        memberCount: workspace.members?.length || 0,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (err) {
    console.error('[workspaces] Transfer error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/workspaces/:id
 * Delete workspace and clean up its rules
 */
router.delete('/:id', async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    // Check for associated API keys
    const apiKeyCount = await ApiKey.countDocuments({ workspace: req.params.id });
    if (apiKeyCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete workspace with associated API keys. Revoke or remove them first.' 
      });
    }
    
    // Cascade delete rules for this workspace
    await Rule.deleteMany({ workspace: req.params.id });
    
    await Workspace.findByIdAndDelete(req.params.id);
    invalidateWorkspaceCache(req.params.id);
    
    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (err) {
    console.error('[workspaces] Delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
