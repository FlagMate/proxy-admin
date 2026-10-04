/**
 * ProxyCeptor Admin Server - Rule Model
 * Mirrors the schema in proxy-server/src/models/Rule.js (collection: rules)
 */

const mongoose = require('mongoose');

const headerOpSchema = new mongoose.Schema(
  {
    op: { type: String, default: 'set' }, // set | remove
    name: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    urlPattern: { type: String, default: '*', trim: true },
    matchType: { type: String, default: 'wildcard' }, // wildcard | regex
    methods: { type: [String], default: ['*'] },
    resourceTypes: { type: [String], default: ['*'] },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    redirectUrl: { type: String, default: null },
    urlRewrite: { type: mongoose.Schema.Types.Mixed, default: null },
    headers: { type: [headerOpSchema], default: [] },
    body: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, default: 'replace' },
      value: { type: String, default: '' },
      mergeValue: { type: String, default: '' },
    },
    delay: { type: Number, default: null },
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    headers: { type: [headerOpSchema], default: [] },
    body: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, default: 'merge-json' }, // replace | merge-json | js-transform
      value: { type: String, default: '' },
      mergeValue: { type: String, default: '' },
      jsTransform: { type: String, default: '' },
      contentType: { type: String, default: 'application/json' },
      statusCode: { type: Number, default: 200 },
    },
  },
  { _id: false }
);

const ruleSchema = new mongoose.Schema(
  {
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: false,
      index: true,
    },
    apiKey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApiKey',
      index: true,
      default: null,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: null },
    match: { type: matchSchema, default: () => ({}) },
    request: { type: requestSchema, default: () => ({}) },
    response: { type: responseSchema, default: () => ({}) },
    block: { type: Boolean, default: false },
    injectScript: {
      enabled: { type: Boolean, default: false },
      code: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

ruleSchema.methods.toJSONSafe = function toJSONSafe() {
  return {
    id: String(this._id),
    name: this.name,
    enabled: Boolean(this.enabled),
    priority: this.priority,
    workspace: String(this.workspace),
    apiKey: this.apiKey ? String(this.apiKey) : null,
    profile: this.profile ? String(this.profile) : null,
    match: this.match || {},
    request: this.request || {},
    response: this.response || {},
    block: Boolean(this.block),
    injectScript: this.injectScript || { enabled: false, code: '' },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Rule', ruleSchema);
