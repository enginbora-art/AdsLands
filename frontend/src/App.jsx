import { useState } from 'react';
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

export default function App() {
  const [active, setActive] = useState('dashboard');
  const Page = pages[active] || Dashboard;

  return (
    <div className="app">
      <Sidebar active={active} onNav={setActive} />
      <main className="main">
        <Page key={active} />
      </main>
    </div>
  );
}
