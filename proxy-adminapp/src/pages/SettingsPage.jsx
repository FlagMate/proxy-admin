import { useApi } from '../api/useApi';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

function SettingsPage() {
  const { data, loading, error, reload } = useApi('/admin/health');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const h = data || {};

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 'var(--spacing-lg)' }}>Settings</h1>

      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card__header">
          <h2 className="card__title">Server Configuration</h2>
        </div>
        <div className="card__body">
          <table className="table">
            <tbody>
              <tr><td style={{ fontWeight: 500 }}>Version</td><td>{h.version || '1.0.0'}</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Port</td><td>3010</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Database</td><td>{h.database || 'N/A'}</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Uptime</td><td>{h.uptimeSeconds ? `${Math.floor(h.uptimeSeconds / 3600)}h` : 'N/A'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">About</h2>
        </div>
        <div className="card__body">
          <p>ProxyCeptor Admin Platform</p>
          <p style={{ color: 'var(--color-gray-500)', marginTop: 'var(--spacing-sm)' }}>Enterprise admin dashboard for ProxyCeptor Cloud.</p>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;