import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function ApiKeysPage() {
  const [page, setPage] = useState(1);
  const { envelope, data, loading, error, reload } = useApi(`/admin/api-keys?page=${page}&limit=20`, [page]);

  const keys = Array.isArray(data) ? data : [];
  const totalPages = envelope?.totalPages ?? 1;

  const handleRevoke = async (id, revoke) => {
    try {
      await api.put(`/admin/api-keys/${id}/${revoke ? 'revoke' : 'activate'}`);
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 'var(--spacing-lg)' }}>API Keys</h1>
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Prefix</th><th>Workspace</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {keys.map(key => (
                <tr key={key.id}>
                  <td><code>{key.keyPrefix}</code></td>
                  <td>{key.workspaceName}</td>
                  <td><span className={`badge ${key.revoked ? 'badge--error' : 'badge--success'}`}>{key.revoked ? 'Revoked' : 'Active'}</span></td>
                  <td>{key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <button className={`btn btn--sm ${key.revoked ? 'btn--primary' : 'btn--danger'}`} onClick={() => handleRevoke(key.id, !key.revoked)}>
                      {key.revoked ? 'Activate' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {keys.length === 0 && <EmptyState message="No API keys found." />}
        </div>
        <div className="pagination">
          <div className="pagination__info">Page {page} of {totalPages}</div>
          <div className="pagination__controls">
            <button className="pagination__btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="pagination__btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiKeysPage;