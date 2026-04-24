import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getAgencyBrandDetail } from '../api';

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const PLATFORM_LABELS = { google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', google_analytics: 'Google Analytics' };
const PLATFORM_COLORS = { google_ads: '#4285F4', meta: '#1877F2', tiktok: '#00BFA6', google_analytics: '#E37400' };

function NoBrandSelected() {
  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Kanal Analizi</div></div>
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

function NoData() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Henüz veri yok</div>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Reklam hesabı bağlandıktan sonra kanal verisi burada görünecek.</div>
    </div>
  );
}

export default function Channels() {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const [integrations, setIntegrations] = useState(null);
  const isAgency = user?.role === 'agency';

  useEffect(() => {
    setIntegrations(null);
    if (isAgency && !selectedBrand) return;
    if (isAgency && selectedBrand) {
      getAgencyBrandDetail(selectedBrand.id)
        .then(d => setIntegrations(d.integrations || []))
        .catch(() => setIntegrations([]));
    } else {
      setIntegrations([]);
    }
  }, [isAgency, selectedBrand?.id]);

  if (isAgency && !selectedBrand) return <NoBrandSelected />;

  const title = isAgency ? selectedBrand?.company_name : 'Kanal Analizi';

  if (!integrations) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">{title} — Kanal Analizi</div></div>
      <div className="loading">Yükleniyor...</div>
    </div>
  );

  const totalSpend = integrations.reduce((s, i) => s + parseFloat(i.total_spend || 0), 0);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{isAgency ? `${title} — Kanal Analizi` : 'Kanal Analizi'}</div>
      </div>
      <div className="content">
        {integrations.length === 0 ? <NoData /> : (
          <>
            <div className="metrics" style={{ gridTemplateColumns: `repeat(${Math.min(integrations.length, 3)}, 1fr)`, marginBottom: 24 }}>
              {integrations.map(i => (
                <div key={i.id} className="metric-card" style={{ borderColor: PLATFORM_COLORS[i.platform] + '40' }}>
                  <div className="metric-label">{PLATFORM_LABELS[i.platform] || i.platform} harcama</div>
                  <div className="metric-value">₺{fmt(i.total_spend)}</div>
                  <div className="metric-sub">
                    ROAS: {Number(i.avg_roas).toFixed(2)}x · {fmt(i.total_conversions)} dönüşüm
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header">
                <div><div className="card-title">Kanal Dağılımı</div><div className="card-subtitle">Son 30 gün</div></div>
              </div>
              <div className="card-body">
                <div className="channel-table">
                  {integrations.map(i => {
                    const pct = totalSpend > 0 ? Math.round((parseFloat(i.total_spend) / totalSpend) * 100) : 0;
                    const color = PLATFORM_COLORS[i.platform] || 'var(--teal)';
                    const icon = i.platform === 'google_analytics' ? 'GA' : i.platform[0].toUpperCase();
                    return (
                      <div key={i.id} className="channel-row">
                        <div className="channel-name">
                          <div className="channel-icon" style={{ background: `${color}20`, color }}>{icon}</div>
                          {PLATFORM_LABELS[i.platform] || i.platform}
                        </div>
                        <div className="channel-bar-wrap">
                          <div className="channel-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="channel-value" style={{ color }}>%{pct}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div><div className="card-title">Performans Karşılaştırması</div><div className="card-subtitle">Son 30 gün</div></div>
              </div>
              <div className="card-body">
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Harcama</th>
                      <th>ROAS</th>
                      <th>Dönüşüm</th>
                      <th>Tıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrations.map(i => (
                      <tr key={i.id}>
                        <td style={{ color: PLATFORM_COLORS[i.platform], fontWeight: 600 }}>
                          {PLATFORM_LABELS[i.platform] || i.platform}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)' }}>₺{fmt(i.total_spend)}</td>
                        <td style={{ color: Number(i.avg_roas) >= 3 ? 'var(--success)' : 'var(--text2)', fontWeight: 600 }}>
                          {Number(i.avg_roas).toFixed(2)}x
                        </td>
                        <td>{fmt(i.total_conversions)}</td>
                        <td>{fmt(i.total_clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
