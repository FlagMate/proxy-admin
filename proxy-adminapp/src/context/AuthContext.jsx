import { createContext, useContext, useState, useEffect } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Expiry check
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('admin_token');
          setToken(null);
          setUser(null);
        } else {
          setUser({ id: payload.sub, email: payload.email, role: payload.role });
        }
      } catch (e) {
        localStorage.removeItem('admin_token');
        setToken(null);
      }
    }
    setLoading(false);
  }, [token]);

  // When any protected request gets a 401, clear the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem('admin_token');
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (email, password) => {
    try {
      const result = await api.post('/admin/auth/login', { email, password }, { auth: false });
      localStorage.setItem('admin_token', result.data.token);
      setToken(result.data.token);
      setUser(result.data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}