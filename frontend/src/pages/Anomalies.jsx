import { useEffect, useState } from 'react';
import { useAgencyBrand, NoBrandSelected } from '../components/AgencyGuard';
import { getDashboardAnomalies, getAgencyBrandDetail, getAgencyDashboard } from '../api';

const PLATFORM_LABELS = { google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', google_analytics: 'Google Analytics' };
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

function AnomalyList({ anomalies, title }) {
  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <div className="topbar-right">
          {anomalies.length > 0 && <span className="nav-badge">{anomalies.length}</span>}
        </div>
      </div>
      <div className="content">
        {anomalies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div>Henüz veri yok</div>
          </div>
        ) : anomalies.map((a, i) => (
          <div key={i} className="alert-card" style={{ marginBottom: 16 }}>
            <div className="alert-icon" style={{
              background: a.severity === 'high' ? 'var(--coral-dim)' : 'var(--amber-dim)',
              color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)'
            }}>!</div>
            <div className="alert-content">
              {a.brandName && (
                <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, marginBottom: 2 }}>{a.brandName}</div>
              )}
              <div className="alert-title" style={{ color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)' }}>
                {PLATFORM_LABELS[a.platform] || a.platform} — {a.metric}
              </div>
              <div className="alert-desc">
                {a.description || (a.actual_value
                  ? `Gerçek: ₺${fmt(a.actual_value)}${a.expected_value ? ` · Beklenen: ₺${fmt(a.expected_value)}` : ''}`
                  : '')}
              </div>
              <div className="alert-time">
                {a.detected_at ? new Date(a.detected_at).toLocaleString('tr-TR') : a.time || ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Anomalies() {
  const { isAgency, selectedBrand } = useAgencyBrand();
  const [anomalies, setAnomalies] = useState(null);

  useEffect(() => {
    setAnomalies(null);

    if (isAgency && !selectedBrand) {
      // Agency without brand: show all anomalies across all brands
      getAgencyDashboard()
        .then(d => {
          const all = (d.clients || []).flatMap(c =>
            (c.anomalies || []).map(a => ({ ...a, brandName: c.brand.company_name }))
          );
          setAnomalies(all);
        })
        .catch(() => setAnomalies([]));
    } else if (isAgency && selectedBrand) {
      getAgencyBrandDetail(selectedBrand.id)
        .then(d => setAnomalies(d.anomalies || []))
        .catch(() => setAnomalies([]));
    } else {
      getDashboardAnomalies()
        .then(setAnomalies)
        .catch(() => setAnomalies([]));
    }
  }, [isAgency, selectedBrand?.id]);

  if (!anomalies) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Anomaliler</div></div>
      <div className="loading">Yükleniyor...</div>
    </div>
  );

  const title = isAgency && selectedBrand
    ? `${selectedBrand.company_name} — Anomaliler`
    : 'Anomaliler';

  return <AnomalyList anomalies={anomalies} title={title} />;
}
