/**
 * ProxyCeptor Admin Server - API Key Model
 * Reuses the same schema as proxy-server
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: { type: String, default: 'Default Key', trim: true },
    label: { type: String, default: 'Default key', trim: true },
    prefix: { type: String, required: true },
    keyHash: { type: String, required: true, index: true },
    key: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastUsedAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.statics.hashKey = function hashKey(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
};

apiKeySchema.statics.generateKey = function generateKey() {
  const random = crypto.randomBytes(24).toString('hex');
  const plain = sdm_live_;
  const prefix = plain.slice(0, 16);
  const keyHash = this.hashKey(plain);
  return { plain, prefix, keyHash };
};

apiKeySchema.methods.toSafeJSON = function toSafeJSON() {
  const displayName = this.name || this.label || 'Default Key';
  return {
    id: String(this._id),
    workspace: String(this.workspace),
    name: displayName,
    label: displayName,
    prefix: this.prefix,
    revoked: this.revoked,
    revokedAt: this.revokedAt,
    lastUsedAt: this.lastUsedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('ApiKey', apiKeySchema);

