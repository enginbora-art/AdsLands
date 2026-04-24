import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getDashboardAnomalies, getAgencyBrandDetail } from '../api';

const PLATFORM_LABELS = { google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', google_analytics: 'Google Analytics' };

function NoBrandSelected() {
  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Anomaliler</div></div>
      <div className="content">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Önce bir müşteri seçin</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Sol menüden <strong>Müşteri Yönetimi</strong>'ne giderek bir marka seçin.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Anomalies() {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const [data, setData] = useState(null);
  const isAgency = user?.role === 'agency';

  useEffect(() => {
    setData(null);
    if (isAgency && !selectedBrand) return;
    if (isAgency && selectedBrand) {
      getAgencyBrandDetail(selectedBrand.id)
        .then(d => setData(d.anomalies || []))
        .catch(() => setData([]));
    } else {
      getDashboardAnomalies()
        .then(setData)
        .catch(() => setData([]));
    }
  }, [isAgency, selectedBrand?.id]);

  if (isAgency && !selectedBrand) return <NoBrandSelected />;

  const title = isAgency ? `${selectedBrand?.company_name} — Anomaliler` : 'Anomaliler';

  if (!data) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">{title}</div></div>
      <div className="loading">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <div className="topbar-right">
          {data.length > 0 && <span className="nav-badge">{data.length}</span>}
        </div>
      </div>
      <div className="content">
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div>Henüz veri yok</div>
          </div>
        ) : data.map((a, i) => (
          <div key={i} className="alert-card" style={{ marginBottom: 16 }}>
            <div className="alert-icon" style={{
              background: a.severity === 'high' ? 'var(--coral-dim)' : 'var(--amber-dim)',
              color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)'
            }}>!</div>
            <div className="alert-content">
              <div className="alert-title" style={{ color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)' }}>
                {PLATFORM_LABELS[a.platform] || a.platform} — {a.metric}
              </div>
              <div className="alert-desc">
                {a.description || (a.actual_value && `Gerçek: ₺${Number(a.actual_value).toLocaleString('tr-TR')}${a.expected_value ? ` · Beklenen: ₺${Number(a.expected_value).toLocaleString('tr-TR')}` : ''}`)}
              </div>
              <div className="alert-time">
                {a.detected_at ? new Date(a.detected_at).toLocaleString('tr-TR') : a.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
