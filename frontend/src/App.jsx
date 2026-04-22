import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
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
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import InviteAccept from './pages/InviteAccept';
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
  settings: Settings,
};

function AppInner() {
  const { user, loading, logout } = useAuth();
  const [active, setActive] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');

  if (loading) return <div className="loading">Yükleniyor...</div>;

  // /invite/:token URL kontrolü
  const path = window.location.pathname;
  const inviteMatch = path.match(/^\/invite\/(.+)$/);
  if (inviteMatch) {
    return <InviteAccept token={inviteMatch[1]} onDone={() => window.history.pushState({}, '', '/')} />;
  }

  if (!user) {
    return authMode === 'login'
      ? <Login onSwitch={() => setAuthMode('register')} />
      : <Register onSwitch={() => setAuthMode('login')} />;
  }

  const Page = pages[active] || Dashboard;

  return (
    <div className="app">
      <Sidebar active={active} onNav={setActive} onLogout={logout} />
      <main className="main">
        <Page key={active} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
