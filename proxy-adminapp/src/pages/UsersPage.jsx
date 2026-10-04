import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function UsersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { envelope, data, loading, error, reload } = useApi(`/admin/users?page=${page}&limit=20`, [page]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ email: '', name: '', role: 'viewer', plan: 'free', password: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const users = Array.isArray(data) ? data : [];
  const total = envelope?.total ?? 0;
  const totalPages = envelope?.totalPages ?? 1;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/admin/users', formData);
      setShowModal(false);
      setFormData({ email: '', name: '', role: 'viewer', plan: 'free', password: '' });
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.del(`/admin/users/${userId}`);
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Users</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-gray-500)', marginTop: '2px' }}>
            Click on any user to view their teams, plans, and workspaces.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>Add User</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Providers</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr
                  key={user.id}
                  className="clickable-row"
                  onClick={() => navigate(`/users/${user.id}`)}
                >
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {user.email}
                    </div>
                  </td>
                  <td>{user.name || '-'}</td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge--info' : user.role === 'editor' ? 'badge--warning' : 'badge--success'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge--purple" style={{ textTransform: 'capitalize' }}>
                      {user.plan || 'Free'}
                    </span>
                  </td>
                  <td>{user.authProviders?.join(', ') || '-'}</td>
                  <td>
                    <span className={`badge ${user.disabled ? 'badge--error' : 'badge--success'}`}>
                      {user.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => navigate(`/users/${user.id}`)}
                        title="View user details, plans, and workspaces"
                      >
                        View Details &rarr;
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <EmptyState message="No users found." />}
        </div>

        <div className="pagination">
          <div className="pagination__info">
            Showing {total === 0 ? 0 : ((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total}
          </div>
          <div className="pagination__controls">
            <button className="pagination__btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="pagination__btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Create User</h2>
              <button className="modal__close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal__body">
                {formError && <div className="alert alert--error">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-input" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input type="text" className="form-input" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-select" value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Plan Tier *</label>
                  <select className="form-select" value={formData.plan}
                    onChange={e => setFormData({ ...formData, plan: e.target.value })}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="team">Team</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Password (min 12 chars) *</label>
                  <input type="password" className="form-input" value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })} required minLength={12} />
                </div>
              </div>
              <div className="modal__footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;