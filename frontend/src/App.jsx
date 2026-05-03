import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandProvider, useSelectedBrand } from './context/BrandContext';
import { SubscriptionProvider, useSubscription } from './context/SubscriptionContext';
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
import Agency from './pages/Agency';
import Campaigns from './pages/Campaigns';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import Connections from './pages/Connections';
import Pricing from './pages/Pricing';
import Subscription from './pages/Subscription';
import PaymentResult from './pages/PaymentResult';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import './index.css';

// Abonelik gerektiren veri sayfaları (30 gün sonra tamamen kilitlenir)
const DATA_PAGES = new Set(['dashboard', 'channels', 'report', 'budget', 'campaigns', 'anomalies', 'benchmark', 'tv', 'tvplan']);

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

function FrozenDataPage({ onNav, expiredAt }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🔒</div>
      <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 12, fontFamily: 'var(--font)' }}>Veri Erişimi Donduruldu</h2>
      <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, maxWidth: 400, marginBottom: 28, fontFamily: 'var(--font)' }}>
        Aboneliğinizin <strong style={{ color: '#f1f5f9' }}>{fmtDate(expiredAt)}</strong> tarihinde sona ermesinden 30 gün geçtiğinden tüm veri erişimi durdurulmuştur. Verilere yeniden erişmek için aboneliğinizi yenileyin.
      </p>
      <button
        onClick={() => onNav('subscription')}
        style={{ padding: '13px 32px', borderRadius: 12, background: '#0d9488', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)' }}
      >
        Aboneliği Yenile
      </button>
    </div>
  );
}

const PAGES = {
  dashboard:    Dashboard,
  channels:     Channels,
  report:       AiReport,
  budget:       Budget,
  tv:           TvBroadcast,
  tvplan:       TvPlan,
  anomalies:    Anomalies,
  benchmark:    Benchmark,
  agency:       Agency,
  campaigns:    Campaigns,
  integrations: Integrations,
  settings:     Settings,
  users:        UserManagement,
  connections:   Connections,
  pricing:       Pricing,
  subscription:  Subscription,
  'payment-result': PaymentResult,
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
  campaigns:    'campaigns',
  channels:     'channels',
  report:       'ai-reports',
  tv:           'tv',
  tvplan:       'tvplan',
  benchmark:    'benchmark',
  connections:      'connections',
  pricing:          'pricing',
  subscription:     'subscription',
  'payment-result': 'payment/result',
};

const URL_PAGE = Object.fromEntries(Object.entries(PAGE_URL).map(([k, v]) => [v, k]));

function parseUrl() {
  const segs = window.location.pathname.replace(/^\//, '').split('/').filter(Boolean);
  // /payment/result
  if (segs[0] === 'payment' && segs[1] === 'result') {
    return { page: 'payment-result', brandId: null };
  }
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
  const sub = useSubscription();
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

  // Forgot password page
  if (path === '/forgot-password') {
    return <ForgotPassword onBack={() => { window.history.pushState({}, '', '/'); }} />;
  }

  // Reset password page
  if (path === '/reset-password') {
    const resetToken = new URLSearchParams(window.location.search).get('token') || '';
    return <ResetPassword token={resetToken} onDone={() => { window.history.pushState({}, '', '/'); }} />;
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

  const mainContent = (() => {
    if (active === 'agency') return <Agency key="agency" onSelectBrand={handleSelectBrand} onNav={handleNav} />;
    if (sub.isFrozen && DATA_PAGES.has(active)) return <FrozenDataPage onNav={handleNav} expiredAt={sub.expiredAt} />;
    return <Page key={active} onNav={handleNav} />;
  })();

  return (
    <div className="app">
      <Sidebar active={active} onNav={handleNav} onLogout={logout} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onNav={handleNav} onMenuToggle={() => setSidebarOpen(prev => !prev)} />
      <main className="main">
        {mainContent}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <SubscriptionProvider>
          <AppInner />
        </SubscriptionProvider>
      </BrandProvider>
    </AuthProvider>
  );
}
