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
  reports:      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>,
  agency:       <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,
  integrations: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
  connections:  <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
  users:        <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,
  settings:     <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
};

const AGENCY_BASE_NAV = [
  { label: 'Ana', items: [
    { id: 'dashboard', label: 'Dashboard',   perm: 'dashboard' },
    { id: 'agency',    label: 'Markalar',    perm: null },
  ]},
  { label: 'İzleme', items: [
    { id: 'anomalies', label: 'Anomaliler',  perm: 'anomalier' },
  ]},
  { label: 'Yönetim', items: [
    { id: 'users',    label: 'Kullanıcılar', perm: 'kullanici_yonetimi' },
    { id: 'settings', label: 'Ayarlar',      perm: 'ayarlar' },
  ]},
];

const AGENCY_BRAND_NAV = [
  { label: 'Online', items: [
    { id: 'dashboard', label: 'Dashboard',      perm: 'dashboard' },
    { id: 'channels',  label: 'Kanal Analizi',  perm: 'kanal_analizi' },
    { id: 'report',    label: 'AI Raporları',   perm: 'ai_raporlar' },
    { id: 'budget',    label: 'Bütçe Planlama', perm: 'butce_planlama' },
  ]},
  { label: 'Broadcast', items: [
    { id: 'tv',     label: 'TV Ad Verification', badge: 'CANLI', badgeLive: true, perm: 'tv_ad_verification' },
    { id: 'tvplan', label: 'TV Medya Planı',     perm: 'tv_medya_plani' },
  ]},
  { label: 'İzleme', items: [
    { id: 'anomalies', label: 'Anomaliler', perm: 'anomalier' },
    { id: 'benchmark', label: 'Benchmark',  perm: 'benchmark' },
  ]},
  { label: 'Raporlar', items: [
    { id: 'reports', label: 'Rapor Oluştur', perm: 'raporlar' },
  ]},
  { label: 'Yönetim', items: [
    { id: 'integrations', label: 'Entegrasyonlar', perm: 'entegrasyonlar' },
    { id: 'users',        label: 'Kullanıcılar',   perm: 'kullanici_yonetimi' },
    { id: 'settings',     label: 'Ayarlar',        perm: 'ayarlar' },
  ]},
];

const BRAND_NAV = [
  { label: 'Online', items: [
    { id: 'dashboard', label: 'Dashboard',      perm: 'dashboard' },
    { id: 'channels',  label: 'Kanal Analizi',  perm: 'kanal_analizi' },
    { id: 'report',    label: 'AI Raporları',   perm: 'ai_raporlar' },
    { id: 'budget',    label: 'Bütçe Planlama', perm: 'butce_planlama' },
  ]},
  { label: 'Broadcast', items: [
    { id: 'tv',     label: 'TV Ad Verification', badge: 'CANLI', badgeLive: true, perm: 'tv_ad_verification' },
    { id: 'tvplan', label: 'TV Medya Planı',     perm: 'tv_medya_plani' },
  ]},
  { label: 'İzleme', items: [
    { id: 'anomalies', label: 'Anomaliler', perm: 'anomalier' },
    { id: 'benchmark', label: 'Benchmark',  perm: 'benchmark' },
  ]},
  { label: 'Raporlar', items: [
    { id: 'reports', label: 'Raporlar', perm: 'raporlar' },
  ]},
  { label: 'Bağlantılar', items: [
    { id: 'connections', label: 'Bağlantılar', perm: null },
  ]},
  { label: 'Yönetim', items: [
    { id: 'integrations', label: 'Entegrasyonlar', perm: 'entegrasyonlar' },
    { id: 'users',        label: 'Kullanıcılar',   perm: 'kullanici_yonetimi' },
    { id: 'settings',     label: 'Ayarlar',        perm: 'ayarlar' },
  ]},
];

function Icon({ id }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[id] || ICONS.dashboard}
    </svg>
  );
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Sidebar({ active, onNav, onLogout }) {
  const { user, hasPermission } = useAuth();
  const { selectedBrand, setSelectedBrand } = useSelectedBrand();
  const isAgency = user?.company_type === 'agency';

  const navConfig = isAgency
    ? (selectedBrand ? AGENCY_BRAND_NAV : AGENCY_BASE_NAV)
    : BRAND_NAV;

  const handleClearBrand = () => {
    setSelectedBrand(null);
    onNav('agency');
  };

  const isVisible = (item) => {
    if (!item.perm) return true;
    return hasPermission(item.perm);
  };

  const roleLabel = user?.is_platform_admin
    ? 'Platform Admin'
    : user?.is_company_admin
      ? 'Şirket Yöneticisi'
      : user?.company_type === 'agency' ? 'Ajans' : 'Marka';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="logo" onClick={() => onNav('dashboard')}>
        <svg width="26" height="26" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
          <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
          <line x1="16" y1="2" x2="16" y2="7" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="25" x2="16" y2="30" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="2" y1="16" x2="7" y2="16" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="25" y1="16" x2="30" y2="16" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
        </svg>
        <div className="logo-text">Ads<span>Lands</span></div>
      </div>

      {/* Selected brand chip */}
      {isAgency && selectedBrand && (
        <div style={{ margin: '4px 12px 8px', padding: '8px 12px', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.15)', borderRadius: 8 }}>
          <button
            onClick={handleClearBrand}
            style={{ fontSize: 11, color: 'rgba(0,191,166,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, fontFamily: 'var(--font)' }}>
            ← Tüm Markalar
          </button>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedBrand.name || selectedBrand.company_name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Marka</div>
        </div>
      )}

      {/* Nav */}
      <nav className="nav">
        {navConfig.map(section => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="nav-section">
              <div className="nav-section-label">{section.label}</div>
              {visibleItems.map(item => (
                <button
                  key={item.id}
                  className={`nav-item${active === item.id ? ' active' : ''}`}
                  onClick={() => onNav(item.id)}
                >
                  <Icon id={item.id} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 5px',
                      borderRadius: 3,
                      background: item.badgeLive ? 'rgba(255,107,90,0.18)' : 'rgba(0,191,166,0.15)',
                      color: item.badgeLive ? 'var(--coral)' : 'var(--teal)',
                      letterSpacing: '0.4px',
                    }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {onLogout && (
        <div className="sidebar-footer">
          <button className="nav-item nav-logout" onClick={onLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Çıkış Yap</span>
          </button>
        </div>
      )}
    </aside>
  );
}
