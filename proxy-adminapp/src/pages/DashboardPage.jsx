import { useApi } from '../api/useApi';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

function DashboardPage() {
  const users = useApi('/admin/users?page=1&limit=1');
  const workspaces = useApi('/admin/workspaces?page=1&limit=1');
  const apiKeys = useApi('/admin/api-keys?page=1&limit=1');
  const health = useApi('/admin/health');

  const loading = users.loading || workspaces.loading || apiKeys.loading || health.loading;
  const error = users.error || workspaces.error || apiKeys.error || health.error;

  const reloadAll = () => {
    users.reload();
    workspaces.reload();
    apiKeys.reload();
    health.reload();
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reloadAll} />;

  const h = health.data || {};

  return (
    <div>
      <h1 style={{ marginBottom: 'var(--spacing-xl)', fontSize: '24px', fontWeight: 700 }}>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total Users</div>
          <div className="stat-card__value">{users.envelope?.total ?? 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Total Workspaces</div>
          <div className="stat-card__value">{workspaces.envelope?.total ?? 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Total API Keys</div>
          <div className="stat-card__value">{apiKeys.envelope?.total ?? 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">System Status</div>
          <div className="stat-card__value" style={{ fontSize: '20px' }}>
            <span className={`badge ${h.status === 'ok' ? 'badge--success' : 'badge--warning'}`}>
              {h.status || 'unknown'}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">System Information</h2>
        </div>
        <div className="card__body">
          <table className="table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 500 }}>Version</td>
                <td>{h.version || '1.0.0'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Uptime</td>
                <td>{h.uptimeSeconds ? `${Math.floor(h.uptimeSeconds / 3600)}h ${Math.floor((h.uptimeSeconds % 3600) / 60)}m` : 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Database</td>
                <td>
                  <span className={`badge ${h.database === 'connected' ? 'badge--success' : 'badge--error'}`}>
                    {h.database || 'unknown'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Memory Usage</td>
                <td>{h.memoryUsageMB ? `${h.memoryUsageMB} MB` : 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;