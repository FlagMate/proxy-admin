/**
 * ProxyCeptor Admin Server - Users CRUD Routes
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Workspace = require('../../models/Workspace');
const Rule = require('../../models/Rule');
const { invalidateRoleCache } = require('../../lib/roleCache');

const router = express.Router();

function getPlanDetails(planKey) {
  const normalized = (planKey || 'free').toLowerCase().trim();
  switch (normalized) {
    case 'enterprise':
      return {
        tier: 'enterprise',
        name: 'Enterprise',
        badgeColor: 'badge--info',
        status: 'active',
        maxWorkspaces: 'Unlimited',
        maxRulesPerWorkspace: 'Unlimited',
        features: [
          'Full Cloud & Extension Interception',
          'Unlimited Workspaces & Teams',
          'Dedicated MITM & High-Concurrency Engine',
          'Enterprise RBAC & Audit Compliance',
          '24/7 Dedicated Support'
        ],
      };
    case 'team':
      return {
        tier: 'team',
        name: 'Team',
        badgeColor: 'badge--warning',
        status: 'active',
        maxWorkspaces: 15,
        maxRulesPerWorkspace: 'Unlimited',
        features: [
          'Full Cloud & Extension Interception',
          'Multi-user Team Workspaces',
          'Shared Rule Sets & Synchronized Profiles',
          'Traffic Inspection & Replay Collaboration',
          'Priority Support'
        ],
      };
    case 'pro':
      return {
        tier: 'pro',
        name: 'Pro',
        badgeColor: 'badge--primary',
        status: 'active',
        maxWorkspaces: 5,
        maxRulesPerWorkspace: 'Unlimited',
        features: [
          'Full Cloud & Extension Interception',
          'Up to 5 Private Workspaces',
          'Unlimited Rules & Profiles',
          'Advanced Request & Response Rewriting',
          'Standard Support'
        ],
      };
    case 'free':
    default:
      return {
        tier: 'free',
        name: 'Free',
        badgeColor: 'badge--success',
        status: 'active',
        maxWorkspaces: 1,
        maxRulesPerWorkspace: 10,
        features: [
          'Local Extension Interception',
          '1 Cloud Workspace',
          'Up to 10 Cloud Rules',
          'Standard Community Support'
        ],
      };
  }
}

/**
 * GET /admin/users
 * List all users with pagination
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);
    
    res.json({
      success: true,
      data: users.map(u => ({
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: u.role || 'viewer',
        plan: u.plan || 'free',
        authProviders: u.authProviders || ['email'],
        hasPassword: Boolean(u.hasPassword),
        disabled: Boolean(u.disabled),
        createdAt: u.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[users] List error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /admin/users/:id
 * Get single user with his Teams, Plans, and Workspaces
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Find all workspaces where user is owner or member
    const workspaces = await Workspace.find({
      $or: [
        { owner: user._id },
        { 'members.user': user._id },
      ],
    })
      .populate('owner', 'email name disabled')
      .populate('members.user', 'email name')
      .sort({ createdAt: -1 })
      .lean();

    // Collect workspace IDs to fetch rule counts in a single query
    const wsIds = workspaces.map(w => w._id);
    const ruleCounts = wsIds.length > 0
      ? await Rule.aggregate([
          { $match: { workspace: { $in: wsIds } } },
          { $group: { _id: '$workspace', count: { $sum: 1 } } },
        ])
      : [];

    const ruleCountMap = {};
    for (const item of ruleCounts) {
      ruleCountMap[String(item._id)] = item.count;
    }

    // Format workspaces and identify teams
    const formattedWorkspaces = workspaces.map(w => {
      const ownerId = String(w.owner?._id || w.owner);
      const isOwner = ownerId === String(user._id);
      const myMembership = (w.members || []).find(m => String(m.user?._id || m.user) === String(user._id));
      const roleInWorkspace = isOwner ? 'owner' : (myMembership?.role || 'member');
      const rulesCount = ruleCountMap[String(w._id)] || 0;

      return {
        id: String(w._id),
        name: w.name,
        isOwner,
        role: roleInWorkspace,
        ownerId,
        ownerEmail: w.owner?.email || 'Unknown',
        ownerName: w.owner?.name || '',
        memberCount: w.members?.length || 0,
        members: (w.members || []).map(m => ({
          userId: String(m.user?._id || m.user),
          userEmail: m.user?.email || 'Unknown',
          userName: m.user?.name || '',
          role: m.role,
        })),
        rulesCount,
        activeProfileId: w.activeProfile ? String(w.activeProfile) : null,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      };
    });

    // Teams: Workspaces with more than 1 member or where the user is a team member/collaborator
    const teams = formattedWorkspaces.filter(w => w.memberCount > 1 || !w.isOwner);

    const planDetails = getPlanDetails(user.plan);

    const totalRules = formattedWorkspaces.reduce((acc, w) => acc + w.rulesCount, 0);
    const ownedCount = formattedWorkspaces.filter(w => w.isOwner).length;

    res.json({
      success: true,
      data: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role || 'viewer',
        plan: user.plan || 'free',
        planDetails,
        authProviders: user.authProviders || ['email'],
        hasPassword: Boolean(user.hasPassword),
        disabled: Boolean(user.disabled),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        workspaces: formattedWorkspaces,
        teams,
        stats: {
          totalWorkspaces: formattedWorkspaces.length,
          ownedWorkspaces: ownedCount,
          teamWorkspaces: teams.length,
          totalRules,
        },
      },
    });
  } catch (err) {
    console.error('[users] Get error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /admin/users
 * Create new user
 */
router.post('/', async (req, res) => {
  try {
    const { email, name, role, password, plan } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    
    // Validate role
    const validRoles = ['admin', 'editor', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    // Validate plan
    const validPlans = ['free', 'pro', 'team', 'enterprise'];
    const chosenPlan = plan ? String(plan).toLowerCase().trim() : 'free';
    if (plan && !validPlans.includes(chosenPlan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan. Allowed: free, pro, team, enterprise' });
    }
    
    // Validate password if provided
    if (password) {
      if (password.length < 12) {
        return res.status(400).json({ success: false, error: 'Password must be at least 12 characters' });
      }
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must contain uppercase letter' });
      }
      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must contain lowercase letter' });
      }
      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must contain a number' });
      }
    }
    
    // Check if user exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }
    
    // Hash password if provided
    let passwordHash = '';
    let hasPassword = false;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
      hasPassword = true;
    }
    
    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      name: name || '',
      role: role || 'viewer',
      plan: chosenPlan,
      authProviders: ['local'],
      hasPassword,
      passwordHash: passwordHash || 'none',
      disabled: false,
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        hasPassword: user.hasPassword,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('[users] Create error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /admin/users/:id
 * Update user
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, role, password, disabled, plan } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update fields
    if (name !== undefined) user.name = name;
    if (role !== undefined) {
      const validRoles = ['admin', 'editor', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
      }
      user.role = role;
      // Invalidate role cache
      invalidateRoleCache(req.params.id);
    }
    if (plan !== undefined) {
      const validPlans = ['free', 'pro', 'team', 'enterprise'];
      const chosenPlan = String(plan).toLowerCase().trim();
      if (!validPlans.includes(chosenPlan)) {
        return res.status(400).json({ success: false, error: 'Invalid plan. Allowed: free, pro, team, enterprise' });
      }
      user.plan = chosenPlan;
    }
    if (disabled !== undefined) user.disabled = disabled;
    
    // Update password if provided
    if (password) {
      if (password.length < 12) {
        return res.status(400).json({ success: false, error: 'Password must be at least 12 characters' });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must contain uppercase, lowercase, and number' });
      }
      user.passwordHash = await bcrypt.hash(password, 10);
      user.hasPassword = true;
    }
    
    await user.save();
    
    res.json({
      success: true,
      data: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan || 'free',
        hasPassword: user.hasPassword,
        disabled: user.disabled,
      },
    });
  } catch (err) {
    console.error('[users] Update error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /admin/users/:id
 * Delete (soft) user
 */
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Check if user owns any workspaces
    const workspaceCount = await Workspace.countDocuments({ owner: req.params.id });
    if (workspaceCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete user who owns workspaces. Transfer ownership first.' 
      });
    }
    
    // Soft delete
    user.disabled = true;
    await user.save();
    
    // Invalidate role cache
    invalidateRoleCache(req.params.id);
    
    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (err) {
    console.error('[users] Delete error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
