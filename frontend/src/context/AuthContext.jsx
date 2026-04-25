import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('user'); }
    }
    setLoading(false);
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
