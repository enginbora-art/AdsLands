import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandProvider, useSelectedBrand } from './context/BrandContext';
import Sidebar from './components/Sidebar';
import AdminPanel from './pages/AdminPanel';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import AiReport from './pages/AiReport';
import Budget from './pages/Budget';
import TvBroadcast from './pages/TvBroadcast';
import TvPlan from './pages/TvPlan';
import Anomalies from './pages/Anomalies';
import Benchmark from './pages/Benchmark';
import Reports from './pages/Reports';
import Agency from './pages/Agency';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import InviteAccept from './pages/InviteAccept';
import SetupPassword from './pages/SetupPassword';
import './index.css';

const pages = {
  dashboard: Dashboard,
  channels: Channels,
  report: AiReport,
  budget: Budget,
  tv: TvBroadcast,
  tvplan: TvPlan,
  anomalies: Anomalies,
  benchmark: Benchmark,
  reports: Reports,
  agency: Agency,
  integrations: Integrations,
  settings: Settings,
};

function AppInner() {
  const { user, loading, logout } = useAuth();
  const { setSelectedBrand } = useSelectedBrand();
  const [active, setActive] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    if (!loading && user?.role === 'agency') setActive('agency');
  }, [loading, user]);

  const path = window.location.pathname;

  // Davet sayfası — auth beklenmeden açılır
  const inviteMatch = path.match(/^\/invite\/(.+)$/);
  if (inviteMatch) {
    return <InviteAccept token={inviteMatch[1]} onDone={() => window.history.pushState({}, '', '/')} />;
  }

  // Şifre kurulum sayfası — auth beklenmeden açılır
  const setupMatch = path.match(/^\/setup\/(.+)$/);
  if (setupMatch) {
    return <SetupPassword token={setupMatch[1]} onDone={() => window.history.pushState({}, '', '/')} />;
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  // Giriş yapılmamış
  if (!user) {
    return authMode === 'login'
      ? <Login onSwitch={() => setAuthMode('register')} />
      : <Register onSwitch={() => setAuthMode('login')} />;
  }

  // Admin paneli
  if (user.role === 'admin') {
    if (path !== '/admin') window.history.pushState({}, '', '/admin');
    return <AdminPanel onLogout={logout} user={user} />;
  }

  // /admin URL'ine admin olmayan biri geldiyse dashboard'a yönlendir
  if (path === '/admin') window.history.pushState({}, '', '/');

  const Page = pages[active] || Dashboard;

  const handleSelectBrand = (brand) => {
    setSelectedBrand(brand);
    setActive('dashboard');
  };

  const handleNav = (id) => {
    if (id === 'agency') setSelectedBrand(null);
    setActive(id);
  };

  return (
    <div className="app">
      <Sidebar active={active} onNav={handleNav} onLogout={logout} />
      <main className="main">
        {active === 'agency'
          ? <Agency key="agency" onSelectBrand={handleSelectBrand} />
          : <Page key={active} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <AppInner />
      </BrandProvider>
    </AuthProvider>
  );
}
