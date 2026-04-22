export default function Sidebar({ active, onNav }) {
  const nav = [
    {
      label: 'Online', items: [
        { id: 'dashboard', label: 'Dashboard', icon: <rect x="3" y="3" width="7" height="7" rx="1"/>, icon2: <><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></> },
        { id: 'channels', label: 'Kanal analizi', icon: <path d="M18 20V10M12 20V4M6 20v-6"/> },
        { id: 'report', label: 'AI raporlar', icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></> },
        { id: 'budget', label: 'Bütçe planlama', icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/> },
      ]
    },
    {
      label: 'Broadcast', items: [
        { id: 'tv', label: 'TV Ad Verification', badge: 'CANLI', badgeLive: true, icon: <><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M8 2l4 4 4-4"/></> },
        { id: 'tvplan', label: 'TV medya planı', icon: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></> },
      ]
    },
    {
      label: 'İzleme', items: [
        { id: 'anomalies', label: 'Anomaliler', badge: '2', icon: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
        { id: 'benchmark', label: 'Benchmark', icon: <><circle cx="12" cy="12" r="10"/><path d="M16 12l-4-4-4 4M12 16V8"/></> },
      ]
    },
    {
      label: 'Raporlar', items: [
        { id: 'reports', label: 'Rapor oluştur', icon: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></> },
      ]
    },
    {
      label: 'Yönetim', items: [
        { id: 'agency', label: 'Ajans yönetimi', icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></> },
        { id: 'settings', label: 'Ayarlar', icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></> },
      ]
    },
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
          <line x1="16" y1="2" x2="16" y2="7" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="25" x2="16" y2="30" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="2" y1="16" x2="7" y2="16" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <line x1="25" y1="16" x2="30" y2="16" stroke="#00BFA6" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
        </svg>
        <div className="logo-text">Ads<span>Lens</span></div>
      </div>
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
                  {item.icon}{item.icon2}
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
          <div className="workspace-avatar">TM</div>
          <div className="workspace-info">
            <div className="workspace-name">TechModa A.Ş.</div>
            <div className="workspace-role">Marka yöneticisi</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
