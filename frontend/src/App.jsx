import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandProvider, useSelectedBrand } from './context/BrandContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
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
import UserManagement from './pages/UserManagement';
import Connections from './pages/Connections';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import './index.css';

const PAGES = {
  dashboard:    Dashboard,
  channels:     Channels,
  report:       AiReport,
  budget:       Budget,
  tv:           TvBroadcast,
  tvplan:       TvPlan,
  anomalies:    Anomalies,
  benchmark:    Benchmark,
  reports:      Reports,
  agency:       Agency,
  integrations: Integrations,
  settings:     Settings,
  users:        UserManagement,
  connections:  Connections,
};

// page-id ↔ URL segment mapping
const PAGE_URL = {
  dashboard:    'dashboard',
  agency:       'brands',
  anomalies:    'anomalies',
  users:        'users',
  settings:     'settings',
  integrations: 'integrations',
  budget:       'budget',
  channels:     'channels',
  report:       'ai-reports',
  tv:           'tv',
  tvplan:       'tvplan',
  benchmark:    'benchmark',
  reports:      'reports',
  connections:  'connections',
};

const URL_PAGE = Object.fromEntries(Object.entries(PAGE_URL).map(([k, v]) => [v, k]));

function parseUrl() {
  const segs = window.location.pathname.replace(/^\//, '').split('/').filter(Boolean);
  // /brands/:brandId/:page
  if (segs[0] === 'brands' && segs[1] && segs[2]) {
    return { page: URL_PAGE[segs[2]] || 'dashboard', brandId: segs[1] };
  }
  // /brands  (agency list)
  if (segs[0] === 'brands') {
    return { page: 'agency', brandId: null };
  }
  // /page
  return { page: URL_PAGE[segs[0]] || 'dashboard', brandId: null };
}

function buildUrl(page, brand) {
  if (page === 'agency') return '/brands';
  const seg = PAGE_URL[page] || page;
  return brand ? `/brands/${brand.id}/${seg}` : `/${seg}`;
}

function AppInner() {
  const { user, loading, logout } = useAuth();
  const { selectedBrand, setSelectedBrand } = useSelectedBrand();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [active, setActive] = useState(() => {
    const { page } = parseUrl();
    return PAGES[page] ? page : 'dashboard';
  });

  const path = window.location.pathname;

  // Restore brand from sessionStorage when loading a brand URL directly
  useEffect(() => {
    const { brandId } = parseUrl();
    if (!brandId) return;
    const stored = JSON.parse(sessionStorage.getItem('selectedBrand') || 'null');
    if (stored?.id === brandId) {
      setSelectedBrand(stored);
    } else {
      setSelectedBrand(null);
      setActive('agency');
      window.history.replaceState({}, '', '/brands');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser back / forward
  useEffect(() => {
    const handler = () => {
      const { page, brandId } = parseUrl();
      if (brandId) {
        const stored = JSON.parse(sessionStorage.getItem('selectedBrand') || 'null');
        if (stored?.id === brandId) {
          setSelectedBrand(stored);
        } else {
          setSelectedBrand(null);
          setActive('agency');
          window.history.replaceState({}, '', '/brands');
          return;
        }
      } else if (page === 'agency') {
        setSelectedBrand(null);
        sessionStorage.removeItem('selectedBrand');
      }
      setActive(PAGES[page] ? page : 'dashboard');
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [setSelectedBrand]);

  // Setup page — open without auth
  const setupMatch = path.match(/^\/setup\/(.+)$/);
  if (setupMatch) {
    return <SetupPassword token={setupMatch[1]} onDone={() => { window.history.pushState({}, '', '/dashboard'); }} />;
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!user) return <Login />;

  // Platform admin
  if (user.is_platform_admin) {
    if (path !== '/admin') window.history.pushState({}, '', '/admin');
    return <AdminPanel onLogout={logout} />;
  }
  if (path === '/admin') window.history.pushState({}, '', '/dashboard');

  const handleSelectBrand = (brand) => {
    setSelectedBrand(brand);
    sessionStorage.setItem('selectedBrand', JSON.stringify(brand));
    setActive('dashboard');
    window.history.pushState({}, '', buildUrl('dashboard', brand));
  };

  const handleNav = (id) => {
    const brand = id === 'agency' ? null : selectedBrand;
    if (id === 'agency') {
      setSelectedBrand(null);
      sessionStorage.removeItem('selectedBrand');
    }
    setActive(id);
    setSidebarOpen(false);
    window.history.pushState({}, '', buildUrl(id, brand));
  };

  const Page = PAGES[active] || Dashboard;

  return (
    <div className="app">
      <Sidebar active={active} onNav={handleNav} onLogout={logout} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onNav={handleNav} onMenuToggle={() => setSidebarOpen(prev => !prev)} />
      <main className="main">
        {active === 'agency'
          ? <Agency key="agency" onSelectBrand={handleSelectBrand} />
          : <Page key={active} onNav={handleNav} />}
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
