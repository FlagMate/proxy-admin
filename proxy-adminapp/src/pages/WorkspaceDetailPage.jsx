import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function WorkspaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: workspace,
    loading: wsLoading,
    error: wsError,
    reload: reloadWs,
  } = useApi(`/admin/workspaces/${id}`, [id]);

  const {
    data: rulesData,
    envelope: rulesEnvelope,
    loading: rulesLoading,
    error: rulesError,
    reload: reloadRules,
  } = useApi(`/admin/workspaces/${id}/rules`, [id]);

  const [filterQuery, setFilterQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, enabled, disabled, blocked, mocked
  const [selectedRule, setSelectedRule] = useState(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState(null);

  const rules = Array.isArray(rulesData) ? rulesData : [];
  const stats = rulesEnvelope?.stats || {
    total: rules.length,
    enabled: rules.filter(r => r.enabled).length,
    disabled: rules.filter(r => !r.enabled).length,
    blocked: rules.filter(r => r.block).length,
    mocked: rules.filter(r => r.response?.body?.enabled).length,
    rewritten: rules.filter(r => r.request?.redirectUrl || r.request?.urlRewrite).length,
  };

  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      // Query filter
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        const nameMatch = (rule.name || '').toLowerCase().includes(q);
        const patternMatch = (rule.match?.urlPattern || '').toLowerCase().includes(q);
        if (!nameMatch && !patternMatch) return false;
      }
      // Status filter
      if (activeFilter === 'enabled') return rule.enabled;
      if (activeFilter === 'disabled') return !rule.enabled;
      if (activeFilter === 'blocked') return rule.block;
      if (activeFilter === 'mocked') return rule.response?.body?.enabled;
      if (activeFilter === 'rewritten') return Boolean(rule.request?.redirectUrl || rule.request?.urlRewrite);
      return true;
    });
  }, [rules, filterQuery, activeFilter]);

  const handleToggleRule = async (ruleId) => {
    setTogglingRuleId(ruleId);
    try {
      await api.patch(`/admin/workspaces/${id}/rules/${ruleId}/toggle`);
      reloadRules();
    } catch (err) {
      alert(err.message || 'Failed to toggle rule');
    } finally {
      setTogglingRuleId(null);
    }
  };

  const handleDeleteRule = async (ruleId, ruleName) => {
    if (!confirm(`Are you sure you want to delete rule "${ruleName || ruleId}"?`)) return;
    try {
      await api.del(`/admin/workspaces/${id}/rules/${ruleId}`);
      reloadRules();
      if (selectedRule?.id === ruleId) {
        setInspectModalOpen(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  const handleInspect = (rule) => {
    setSelectedRule(rule);
    setInspectModalOpen(true);
  };

  if (wsLoading) return <LoadingState />;
  if (wsError || !workspace) return <ErrorState message={wsError || 'Workspace not found'} onRetry={reloadWs} />;

  const members = Array.isArray(workspace.members) ? workspace.members : [];

  return (
    <div>
      {/* Header and Breadcrumbs */}
      <div className="detail-header">
        <div className="detail-header__left">
          <button className="back-link" onClick={() => navigate('/workspaces')}>
            &larr; Back to Workspaces
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
              {workspace.name}
            </h1>
            <span className="badge badge--info">
              {workspace.memberCount} {workspace.memberCount === 1 ? 'member' : 'members'}
            </span>
            <span className="badge badge--success">
              {stats.total} {stats.total === 1 ? 'rule' : 'rules'}
            </span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
            Workspace ID: <code style={{ fontSize: '12px' }}>{workspace.id}</code> &bull; Owner:{' '}
            <Link
              to={`/users/${workspace.ownerId}`}
              style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
            >
              {workspace.ownerEmail} ({workspace.ownerName || 'User'})
            </Link>
          </span>
        </div>

        <div className="detail-header__actions">
          <Link to={`/users/${workspace.ownerId}`} className="btn btn--secondary btn--sm">
            View Owner Profile
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total Rules</div>
          <div className="stat-card__value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Active / Enabled Rules</div>
          <div className="stat-card__value" style={{ color: 'var(--color-success)' }}>
            {stats.enabled}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Mocked Responses</div>
          <div className="stat-card__value" style={{ color: 'var(--color-accent)' }}>
            {stats.mocked}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Blocked Endpoints</div>
          <div className="stat-card__value" style={{ color: stats.blocked > 0 ? 'var(--color-error)' : 'inherit' }}>
            {stats.blocked}
          </div>
        </div>
      </div>

      {/* Workspace Members / Team */}
      {members.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div className="card__header">
            <h2 className="card__title">Team Members & Collaborators ({members.length})</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Name</th>
                  <th>Workspace Role</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => (
                  <tr key={idx}>
                    <td>
                      <Link
                        to={`/users/${m.userId}`}
                        style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}
                      >
                        {m.userEmail}
                      </Link>
                    </td>
                    <td>{m.userName || '-'}</td>
                    <td>
                      <span className={`badge ${m.role === 'owner' ? 'badge--info' : 'badge--warning'}`}>
                        {m.role}
                      </span>
                    </td>
                    <td>
                      <Link to={`/users/${m.userId}`} className="btn btn--secondary btn--sm">
                        View User Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Rules Section */}
      <div className="card">
        <div className="card__header" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <div>
            <h2 className="card__title" style={{ fontSize: '18px' }}>
              All Rules in this Workspace ({rules.length})
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-gray-500)', marginTop: '2px' }}>
              Interception, mocking, rewriting, and blocking rules active for this workspace.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search rule name or pattern..."
              className="form-input"
              style={{ width: '220px', padding: '6px 12px', fontSize: '13px' }}
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`btn btn--sm ${activeFilter === 'all' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setActiveFilter('all')}
              >
                All ({rules.length})
              </button>
              <button
                className={`btn btn--sm ${activeFilter === 'enabled' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setActiveFilter('enabled')}
              >
                Enabled ({stats.enabled})
              </button>
              <button
                className={`btn btn--sm ${activeFilter === 'mocked' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setActiveFilter('mocked')}
              >
                Mocked ({stats.mocked})
              </button>
              <button
                className={`btn btn--sm ${activeFilter === 'blocked' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setActiveFilter('blocked')}
              >
                Blocked ({stats.blocked})
              </button>
            </div>
          </div>
        </div>

        {rulesLoading ? (
          <LoadingState />
        ) : rulesError ? (
          <ErrorState message={rulesError} onRetry={reloadRules} />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Priority</th>
                  <th>Rule Name</th>
                  <th>Status</th>
                  <th>Match URL & Methods</th>
                  <th>Interception Strategy</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map(rule => {
                  const methods = rule.match?.methods || ['*'];
                  const isBlocked = Boolean(rule.block);
                  const isMocked = Boolean(rule.response?.body?.enabled);
                  const isRewritten = Boolean(rule.request?.redirectUrl || rule.request?.urlRewrite);
                  const hasDelay = Boolean(rule.request?.delay);
                  const hasInject = Boolean(rule.injectScript?.enabled);

                  return (
                    <tr key={rule.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--color-gray-500)', fontSize: '12px' }}>
                          #{rule.priority ?? '-'}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{ fontWeight: 600, color: 'var(--color-gray-900)', cursor: 'pointer' }}
                          onClick={() => handleInspect(rule)}
                        >
                          {rule.name}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>
                          ID: {rule.id}
                        </span>
                        {rule.apiKey && (
                          <div style={{ marginTop: '2px' }}>
                            <span className="badge badge--warning" style={{ fontSize: '10px' }}>
                              Key: {rule.apiKey.name || rule.apiKey.keyPrefix || 'API Key'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn btn--sm ${rule.enabled ? 'btn--primary' : 'btn--secondary'}`}
                          style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            minWidth: '70px',
                          }}
                          disabled={togglingRuleId === rule.id}
                          onClick={() => handleToggleRule(rule.id)}
                          title="Click to toggle enabled/disabled"
                        >
                          {togglingRuleId === rule.id ? '...' : rule.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          {methods.map((m, i) => (
                            <span
                              key={i}
                              className={`method-tag method-tag--${m.toLowerCase() in { get: 1, post: 1, put: 1, delete: 1, patch: 1 } ? m.toLowerCase() : 'all'}`}
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                        <div className="url-pattern">
                          {rule.match?.urlPattern || '*'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {isBlocked && (
                            <span className="rule-chip" style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>
                              &#128721; Block
                            </span>
                          )}
                          {isMocked && (
                            <span className="rule-chip" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                              &#129528; Mock ({rule.response?.body?.statusCode || 200})
                            </span>
                          )}
                          {isRewritten && (
                            <span className="rule-chip" style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                              &#10140; Rewrite
                            </span>
                          )}
                          {hasDelay && (
                            <span className="rule-chip">
                              &#9201; {rule.request?.delay}ms
                            </span>
                          )}
                          {hasInject && (
                            <span className="rule-chip" style={{ backgroundColor: '#ede9fe', color: '#6b21a8', borderColor: '#ddd6fe' }}>
                              &lt;/&gt; Script
                            </span>
                          )}
                          {!isBlocked && !isMocked && !isRewritten && !hasDelay && !hasInject && (
                            <span className="rule-chip">
                              Pass-through / Headers
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--color-gray-600)' }}>
                          {rule.updatedAt ? new Date(rule.updatedAt).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => handleInspect(rule)}
                            title="Inspect full JSON rule configuration"
                          >
                            Inspect
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            title="Delete rule"
                          >
                            &times;
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredRules.length === 0 && (
              <EmptyState message="No rules match the current filter or search criteria in this workspace." />
            )}
          </div>
        )}
      </div>

      {/* Inspect Rule Modal */}
      {inspectModalOpen && selectedRule && (
        <div className="modal-overlay" onClick={() => setInspectModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '780px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Rule Configuration: {selectedRule.name}</h2>
                <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                  Rule ID: <code>{selectedRule.id}</code> &bull; Priority: #{selectedRule.priority ?? 'None'}
                </span>
              </div>
              <button className="modal__close" onClick={() => setInspectModalOpen(false)}>&times;</button>
            </div>

            <div className="modal__body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Match Card */}
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>1. Match Criteria</h3>
                <div style={{ background: 'var(--color-gray-50)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                  <div><strong>URL Pattern:</strong> <code>{selectedRule.match?.urlPattern || '*'}</code></div>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Methods:</strong> {selectedRule.match?.methods?.join(', ') || '*'}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Match Type:</strong> {selectedRule.match?.matchType || 'wildcard'}
                  </div>
                </div>
              </div>

              {/* Behavior Card */}
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>2. Interception & Mock Actions</h3>
                <div style={{ background: 'var(--color-gray-50)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                  <div><strong>Block Request:</strong> {selectedRule.block ? 'YES (Connection Aborted)' : 'No'}</div>
                  {selectedRule.request?.delay && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>Pre-Delay:</strong> {selectedRule.request.delay} ms
                    </div>
                  )}
                  {selectedRule.request?.redirectUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>Redirect / Rewrite URL:</strong> <code>{selectedRule.request.redirectUrl}</code>
                    </div>
                  )}
                  {selectedRule.response?.body?.enabled && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>Mock Response Status:</strong> {selectedRule.response.body.statusCode || 200}
                    </div>
                  )}
                  {selectedRule.response?.body?.mode && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>Body Mutation Mode:</strong> {selectedRule.response.body.mode}
                    </div>
                  )}
                </div>
              </div>

              {/* Raw JSON Config */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>3. Complete Rule JSON (Payload)</h3>
                <pre className="json-viewer">
                  {JSON.stringify(selectedRule, null, 2)}
                </pre>
              </div>
            </div>

            <div className="modal__footer" style={{ justifyContent: 'space-between' }}>
              <button
                className={`btn btn--sm ${selectedRule.enabled ? 'btn--secondary' : 'btn--primary'}`}
                onClick={async () => {
                  await handleToggleRule(selectedRule.id);
                  setSelectedRule(prev => ({ ...prev, enabled: !prev.enabled }));
                }}
              >
                {selectedRule.enabled ? 'Disable This Rule' : 'Enable This Rule'}
              </button>

              <button className="btn btn--secondary" onClick={() => setInspectModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceDetailPage;
