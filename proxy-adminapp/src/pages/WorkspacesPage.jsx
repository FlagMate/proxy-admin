import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApi } from '../api/useApi';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function WorkspacesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { envelope, data, loading, error, reload } = useApi(`/admin/workspaces?page=${page}&limit=20`, [page]);

  const workspaces = Array.isArray(data) ? data : [];
  const total = envelope?.total ?? 0;
  const totalPages = envelope?.totalPages ?? 1;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Workspaces</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-gray-500)', marginTop: '2px' }}>
            Click on any workspace to inspect its rules and configuration.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Workspace Name</th>
                <th>Owner</th>
                <th>Team Members</th>
                <th>Rules Count</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map(ws => (
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
                    <span onClick={e => e.stopPropagation()}>
                      <Link
                        to={`/users/${ws.ownerId}`}
                        style={{ color: 'var(--color-gray-800)', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {ws.ownerEmail}
                      </Link>
                    </span>
                  </td>
                  <td>
                    <span className="badge badge--info">{ws.memberCount}</span>
                  </td>
                  <td>
                    <span className="badge badge--success" style={{ fontWeight: 600 }}>
                      {ws.rulesCount || 0} {ws.rulesCount === 1 ? 'rule' : 'rules'}
                    </span>
                  </td>
                  <td>{ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <button
                      className="btn btn--secondary btn--sm"
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
          {workspaces.length === 0 && <EmptyState message="No workspaces found." />}
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
    </div>
  );
}

export default WorkspacesPage;