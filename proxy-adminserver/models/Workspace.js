/**
 * ProxyCeptor Admin Server - Workspace Model
 * Reuses the same schema as proxy-server
 */

const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [memberSchema], default: [] },
    activeProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: true }
);

workspaceSchema.methods.toJSONSafe = function toJSONSafe() {
  return {
    id: String(this._id),
    name: this.name,
    owner: String(this.owner),
    members: this.members.map((m) => {
      const u = m.user;
      const populated = u && typeof u === 'object' && u._id;
      return {
        user: String(populated ? u._id : u),
        role: m.role,
        email: populated ? u.email : undefined,
        name: populated ? u.name : undefined,
      };
    }),
    activeProfile: this.activeProfile ? String(this.activeProfile) : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Workspace', workspaceSchema);

