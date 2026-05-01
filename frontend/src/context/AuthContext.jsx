import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('user'); }
      // Oturum açık — /me ile taze veri çek (is_managed_by_agency gibi alanlar için)
      axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          localStorage.setItem('user', JSON.stringify(data));
          setUser(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const saveAuth = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // user.permissions içinde belirli bir izin var mı?
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.is_platform_admin || user.is_company_admin) return true;
    return user.permissions?.includes(perm) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, saveAuth, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
