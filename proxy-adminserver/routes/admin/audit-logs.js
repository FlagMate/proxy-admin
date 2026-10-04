/**
 * ProxyCeptor Admin Server - Audit Logs Routes
 */

const express = require('express');
const AuditLog = require('../../models/AuditLog');

const router = express.Router();

/**
 * GET /admin/audit-logs
 * List audit logs with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    if (req.query.userId) {
      query.userId = req.query.userId;
    }
    
    if (req.query.action) {
      query.action = req.query.action;
    }
    
    if (req.query.startDate || req.query.endDate) {
      query.timestamp = {};
      if (req.query.startDate) {
        query.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.timestamp.$lte = new Date(req.query.endDate);
      }
    }
    
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email'),
      AuditLog.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /admin/audit-logs/:id
 * Get single audit log by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).populate('userId', 'name email');
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Audit log not found' });
    }
    
    res.json({ success: true, data: log });
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /admin/audit-logs/stats/summary
 * Get audit log statistics summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalLogs, todayLogs, byAction] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ timestamp: { $gte: today } }),
      AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        totalLogs,
        todayLogs,
        byAction
      }
    });
  } catch (err) {
    console.error('Error fetching audit stats:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit stats' });
  }
});

module.exports = router;