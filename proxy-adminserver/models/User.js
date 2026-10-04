/**
 * ProxyCeptor Admin Server - User Model
 * Reuses the same schema as proxy-server
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },
    googleId: { type: String, default: '', index: true },
    githubId: { type: String, default: '', index: true },
    authProviders: { type: [String], default: ['email'] },
    hasPassword: { type: Boolean, default: false },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'viewer', index: true },
    isAdmin: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false, index: true },
    plan: { type: String, default: 'free', trim: true },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
  this.hasPassword = true;
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: String(this._id),
    email: this.email,
    name: this.name,
    role: this.role,
    plan: this.plan || 'free',
    authProviders: this.authProviders || ['email'],
    hasPassword: Boolean(this.hasPassword),
    disabled: Boolean(this.disabled),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);

