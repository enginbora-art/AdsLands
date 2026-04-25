import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';

const ICONS = {
  dashboard:    <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  channels:     <path d="M18 20V10M12 20V4M6 20v-6"/>,
  report:       <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></>,
  budget:       <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>,
  tv:           <><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M8 2l4 4 4-4"/></>,
  tvplan:       <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  anomalies:    <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  benchmark:    <><circle cx="12" cy="12" r="10"/><path d="M16 12l-4-4-4 4M12 16V8"/></>,
  reports:      <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></>,
  integrations: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
  agency:       <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,
  settings:     <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
};

const AGENCY_BASE_NAV = [
  { label: 'Ana', items: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'agency',    label: 'Markalar' },
  ]},
  { label: 'İzleme', items: [
    { id: 'anomalies', label: 'Anomaliler' },
  ]},
  { label: 'Raporlar', items: [
    { id: 'reports', label: 'Rapor Oluştur' },
  ]},
  { label: 'Yönetim', items: [
    { id: 'settings', label: 'Ayarlar' },
  ]},
];

const AGENCY_BRAND_NAV = [
  { label: 'Online', items: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'channels',  label: 'Kanal Analizi' },
    { id: 'report',    label: 'AI Raporları' },
    { id: 'budget',    label: 'Bütçe Planlama' },
  ]},
  { label: 'Broadcast', items: [
    { id: 'tv',     label: 'TV Ad Verification', badge: 'CANLI', badgeLive: true },
    { id: 'tvplan', label: 'TV Medya Planı' },
  ]},
  { label: 'İzleme', items: [
    { id: 'anomalies', label: 'Anomaliler' },
    { id: 'benchmark', label: 'Benchmark' },
  ]},
  { label: 'Raporlar', items: [
    { id: 'reports', label: 'Rapor Oluştur' },
  ]},
  { label: 'Yönetim', items: [
    { id: 'integrations', label: 'Entegrasyonlar' },
    { id: 'settings',     label: 'Ayarlar' },
  ]},
];

const BRAND_NAV = [
  { label: 'Online', items: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'channels',  label: 'Kanal Analizi' },
    { id: 'report',    label: 'AI Raporları' },
    { id: 'budget',    label: 'Bütçe Planlama' },
  ]},
  { label: 'Broadcast', items: [
    { id: 'tv',     label: 'TV Ad Verification', badge: 'CANLI', badgeLive: true },
    { id: 'tvplan', label: 'TV Medya Planı' },
  ]},
  { label: 'İzleme', items: [
    { id: 'anomalies', label: 'Anomaliler' },
    { id: 'benchmark', label: 'Benchmark' },
  ]},
  { label: 'Raporlar', items: [
    { id: 'reports', label: 'Raporlar' },
  ]},
  { label: 'Yönetim', items: [
    { id: 'integrations', label: 'Entegrasyonlar' },
    { id: 'settings',     label: 'Ayarlar' },
  ]},
];

export default function Sidebar({ active, onNav, onLogout }) {
  const { user } = useAuth();
  const { selectedBrand, setSelectedBrand } = useSelectedBrand();
  const isAgency = user?.role === 'agency';

  const nav = isAgency
    ? (selectedBrand ? AGENCY_BRAND_NAV : AGENCY_BASE_NAV)
    : BRAND_NAV;

  const roleLabel = isAgency ? 'Ajans hesabı' : 'Marka yöneticisi';

  const handleClearBrand = () => {
    setSelectedBrand(null);
    onNav('agency');
  };

  return (
    <aside className="sidebar">
      <div className="logo" onClick={() => onNav('dashboard')} style={{ cursor: 'pointer' }}>
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
          <line x1="16" y1="2" x2="16" y2="7" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="25" x2="16" y2="30" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="2" y1="16" x2="7" y2="16" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="25" y1="16" x2="30" y2="16" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
        </svg>
        <div className="logo-text">Ads<span>Lands</span></div>
      </div>

      {isAgency && selectedBrand && (
        <div style={{ margin: '0 12px 8px', padding: '10px 12px', background: 'rgba(0,191,166,0.07)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 10 }}>
          <button
            onClick={handleClearBrand}
            style={{ fontSize: 11, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            ← Tüm Markalar
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', lineHeight: 1.3 }}>{selectedBrand.company_name}</div>
        </div>
      )}

      <nav className="nav">
        {nav.map(section => (
          <div className="nav-section" key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map(item => (
              <div
                key={item.id}
                className={`nav-item${active === item.id ? ' active' : ''}`}
                onClick={() => onNav(item.id)}
              >
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {ICONS[item.id]}
                </svg>
                {item.label}
                {item.badge && <span className={`nav-badge${item.badgeLive ? ' live' : ''}`}>{item.badge}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="workspace">
          <div className="workspace-avatar">{user?.company_name?.slice(0, 2).toUpperCase() || 'TM'}</div>
          <div className="workspace-info">
            <div className="workspace-name">{user?.company_name || 'Şirket Adı'}</div>
            <div className="workspace-role">{roleLabel}</div>
          </div>
        </div>
        {onLogout && (
          <button onClick={onLogout} style={{ marginTop: 10, width: '100%', padding: '7px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Çıkış Yap
          </button>
        )}
      </div>
    </aside>
  );
}
