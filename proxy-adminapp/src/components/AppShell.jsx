import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/users', label: 'Users' },
  { path: '/workspaces', label: 'Workspaces' },
  { path: '/api-keys', label: 'API Keys' },
  { path: '/audit-logs', label: 'Audit Logs' },
  { path: '/settings', label: 'Settings' },
];

function AppShell({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <nav className="top-nav">
        <div className="top-nav__logo">
          <img className="top-nav__logo-img" src="/brand/proxyceptor-mark.webp" alt="ProxyCeptor" />
          <span className="top-nav__logo-text">
            <span className="brand-proxy">Proxy</span><span className="brand-ceptor">Ceptor</span> Admin
          </span>
        </div>

        <div className="top-nav__right">
          <div className="top-nav__tabs">
            {navItems.map(item => {
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`top-nav__tab ${isActive ? 'top-nav__tab--active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="top-nav__user">
            <span className="top-nav__user-name">{user?.name || user?.email || 'Admin'}</span>
            <span className="badge badge--info">{user?.role || 'admin'}</span>
            <button className="btn btn--secondary btn--sm" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default AppShell;