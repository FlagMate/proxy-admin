import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { envelope, data, loading, error, reload } = useApi(`/admin/users/${id}`, [id]);

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'owned' | 'teams'
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState('');

  const user = data?.user || (data?.email ? data : null);
  const plan = data?.planDetails || {
    tier: user?.plan || 'free',
    name: (user?.plan || 'Free').toUpperCase(),
    status: 'active',
    features: ['Local Extension Interception', '1 Cloud Workspace', 'Up to 10 Cloud Rules'],
  };
  const workspaces = Array.isArray(data?.workspaces) ? data.workspaces : [];
  const teams = Array.isArray(data?.teams) ? data.teams : [];
  const stats = data?.stats || {
    totalWorkspaces: workspaces.length,
    ownedWorkspaces: workspaces.filter(w => w.isOwner).length,
    teamWorkspaces: teams.length,
    totalRules: workspaces.reduce((acc, w) => acc + (w.rulesCount || 0), 0),
  };

  const handleOpenPlanModal = () => {
    setSelectedPlan(user?.plan || 'free');
    setPlanError('');
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    setSavingPlan(true);
    setPlanError('');
    try {
      await api.put(`/admin/users/${id}`, { plan: selectedPlan });
      setShowPlanModal(false);
      reload();
    } catch (err) {
      setPlanError(err.message || 'Failed to update plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = !user.disabled;
    const confirmMsg = newStatus
      ? 'Are you sure you want to disable this user?'
      : 'Are you sure you want to enable this user?';
    if (!confirm(confirmMsg)) return;

    try {
      await api.put(`/admin/users/${id}`, { disabled: newStatus });
      reload();
    } catch (err) {
      alert(err.message || 'Failed to update user status');
    }
  };

  if (loading) return <LoadingState />;
  if (error || !user) return <ErrorState message={error || 'User not found'} onRetry={reload} />;

  const displayedWorkspaces = activeTab === 'owned'
    ? workspaces.filter(w => w.isOwner)
    : activeTab === 'teams'
    ? workspaces.filter(w => !w.isOwner || w.memberCount > 1)
    : workspaces;

  return (
    <div>
      <div className="detail-header">
        <div className="detail-header__left">
          <button className="back-link" onClick={() => navigate('/users')}>
            &larr; Back to Users
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
              {user.name || user.email}
            </h1>
            <span className={`badge ${user.role === 'admin' ? 'badge--info' : user.role === 'editor' ? 'badge--warning' : 'badge--success'}`}>
              {user.role}
            </span>
            <span className={`badge ${user.disabled ? 'badge--error' : 'badge--success'}`}>
              {user.disabled ? 'Disabled' : 'Active'}
            </span>
            <span className="badge badge--purple" style={{ textTransform: 'capitalize' }}>
              Plan: {user.plan || 'Free'}
            </span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--color-gray-500)' }}>
            User ID: <code style={{ fontSize: '12px' }}>{user.id || id}</code> &bull; Email: {user.email}
          </span>
        </div>

        <div className="detail-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={handleOpenPlanModal}>
            Change Plan
          </button>
          <button
            className={`btn btn--sm ${user.disabled ? 'btn--primary' : 'btn--danger'}`}
            onClick={handleToggleStatus}
          >
            {user.disabled ? 'Enable Account' : 'Disable Account'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total Workspaces</div>
          <div className="stat-card__value">{stats.totalWorkspaces}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Owned Workspaces</div>
          <div className="stat-card__value">{stats.ownedWorkspaces}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Team Workspaces</div>
          <div className="stat-card__value">{stats.teamWorkspaces}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Total Rules Configured</div>
          <div className="stat-card__value" style={{ color: 'var(--color-accent)' }}>
            {stats.totalRules}
          </div>
        </div>
      </div>

      {/* Plan Card */}
      <div className="plan-card">
        <div className="plan-card__header">
          <div>
            <div className="plan-card__title">Current Subscription Plan</div>
            <div className="plan-card__tier">
              {plan.name || 'Free Tier'}
              <span className="badge badge--success" style={{ fontSize: '12px', background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                {plan.status || 'Active'}
              </span>
            </div>
          </div>
          <button
            className="btn btn--sm"
            style={{ backgroundColor: '#ffffff', color: 'var(--color-primary)', fontWeight: 600 }}
            onClick={handleOpenPlanModal}
          >
            Upgrade / Change
          </button>
        </div>

        <div className="plan-card__grid">
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Workspace Limit</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{plan.maxWorkspaces || 'Unlimited'}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Rules / Workspace</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{plan.maxRulesPerWorkspace || 'Unlimited'}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Account Status</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{user.disabled ? 'Disabled' : 'Good Standing'}</div>
          </div>
        </div>

        {plan.features && plan.features.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: '12px', opacity: 0.85, marginBottom: '6px' }}>Plan Features:</div>
            <ul className="plan-card__feature-list">
              {plan.features.map((feat, idx) => (
                <li key={idx} className="plan-card__feature-item">
                  <span>&#10003;</span> {feat}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Workspaces & Teams Section */}
      <div className="card">
        <div className="card__header" style={{ flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <h2 className="card__title">Workspaces & Teams</h2>
            <span className="badge badge--info">{workspaces.length} Total</span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            <button
              className={`btn btn--sm ${activeTab === 'all' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setActiveTab('all')}
            >
              All ({workspaces.length})
            </button>
            <button
              className={`btn btn--sm ${activeTab === 'owned' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setActiveTab('owned')}
            >
              Owned Workspaces ({stats.ownedWorkspaces})
            </button>
            <button
              className={`btn btn--sm ${activeTab === 'teams' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setActiveTab('teams')}
            >
              Teams & Collaborative ({stats.teamWorkspaces})
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Workspace Name</th>
                <th>Role</th>
                <th>Owner</th>
                <th>Team Members</th>
                <th>Rules Count</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedWorkspaces.map(ws => (
                <tr
                  key={ws.id}
                  className="clickable-row"
                  onClick={() => navigate(`/workspaces/${ws.id}`)}
                >
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {ws.name}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>
                      ID: {ws.id}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${ws.isOwner ? 'badge--info' : 'badge--warning'}`}>
                      {ws.isOwner ? 'Owner' : ws.role || 'Member'}
                    </span>
                  </td>
                  <td>
                    {ws.isOwner ? (
                      <span style={{ color: 'var(--color-gray-600)' }}>This User</span>
                    ) : (
                      <span>{ws.ownerEmail}</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge--info">
                      {ws.memberCount} {ws.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge badge--success"
                      style={{ fontWeight: 600 }}
                    >
                      {ws.rulesCount || 0} {ws.rulesCount === 1 ? 'rule' : 'rules'}
                    </span>
                  </td>
                  <td>
                    {ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/workspaces/${ws.id}`);
                      }}
                    >
                      View Rules &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayedWorkspaces.length === 0 && (
            <EmptyState message="No workspaces found for this user in this view." />
          )}
        </div>
      </div>

      {/* Plan Edit Modal */}
      {showPlanModal && (
        <div className="modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Update User Plan</h2>
              <button className="modal__close" onClick={() => setShowPlanModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSavePlan}>
              <div className="modal__body">
                {planError && <div className="alert alert--error">{planError}</div>}
                <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-gray-600)', fontSize: '13px' }}>
                  Select the subscription tier for <strong>{user.email}</strong>. This updates their quota limits and enabled features.
                </p>
                <div className="form-group">
                  <label className="form-label">Subscription Tier *</label>
                  <select
                    className="form-select"
                    value={selectedPlan}
                    onChange={e => setSelectedPlan(e.target.value)}
                  >
                    <option value="free">Free Tier (1 Workspace, 10 Rules)</option>
                    <option value="pro">Pro Tier (5 Workspaces, Unlimited Rules)</option>
                    <option value="team">Team Tier (15 Workspaces, Team Collaboration, Unlimited Rules)</option>
                    <option value="enterprise">Enterprise Tier (Unlimited Workspaces & Rules, Custom MITM)</option>
                  </select>
                </div>
              </div>
              <div className="modal__footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowPlanModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={savingPlan}>
                  {savingPlan ? 'Saving...' : 'Update Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetailPage;
