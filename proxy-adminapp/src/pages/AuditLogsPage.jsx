import { useState } from 'react';
import { useApi } from '../api/useApi';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const { data, loading, error, reload } = useApi(
    `/admin/audit-logs?page=${page}&limit=20${actionFilter ? `&action=${actionFilter}` : ''}`,
    [page, actionFilter]
  );

  // audit-logs returns { data: { logs, pagination } }
  const logs = data?.logs || [];
  const totalPages = data?.pagination?.pages ?? 1;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 'var(--spacing-lg)' }}>Audit Logs</h1>
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log._id || log.id}>
                  <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                  <td>{(log.userId?.email) || (typeof log.userId === 'string' ? `${log.userId.substring(0, 8)}...` : '-')}</td>
                  <td><span className="badge badge--info">{log.action}</span></td>
                  <td>{log.targetType || '-'}</td>
                  <td><code style={{ fontSize: '12px' }}>{JSON.stringify(log.details || {}).substring(0, 50)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <EmptyState message="No audit logs found." />}
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

export default AuditLogsPage;