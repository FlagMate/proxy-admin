/**
 * ProxyCeptor Admin Server - Audit Log Model
 * New collection for admin activity tracking
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, index: true },
    targetType: { type: String, enum: ['user', 'workspace', 'api-key', 'rule', 'config'], default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for efficient querying
auditLogSchema.index({ timestamp: -1, userId: 1 });

// TTL index: auto-delete after 365 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

auditLogSchema.methods.toJSON = function toJSON() {
  return {
    id: String(this._id),
    userId: String(this.userId),
    action: this.action,
    targetId: this.targetId ? String(this.targetId) : null,
    targetType: this.targetType,
    details: this.details,
    timestamp: this.timestamp,
  };
};

module.exports = mongoose.model('AuditLog', auditLogSchema);

