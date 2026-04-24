import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getBrandDashboard, getAgencyBrandDetail } from '../api';
import InviteModal from '../components/InviteModal';

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const PLATFORM_LABELS = { google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', google_analytics: 'Google Analytics' };
const PLATFORM_COLORS = { google_ads: '#4285F4', meta: '#1877F2', tiktok: '#00BFA6', google_analytics: '#E37400' };
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || 'var(--text1)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function NoBrandSelected() {
  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Dashboard</div></div>
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

function DashboardContent({ data, title, showInvite, setShowInvite, isAgency }) {
  const { summary, integrations, today_spend, budget, anomalies } = data;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        {!isAgency && (
          <div className="topbar-right">
            <button
              style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--teal)', background: 'transparent', color: 'var(--teal)' }}
              onClick={() => setShowInvite(true)}>
              + Davet Gönder
            </button>
          </div>
        )}
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      <div className="content">
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <MetricCard label="30g Harcama" value={`₺${fmt(summary?.total_spend)}`} accent="var(--teal)" />
          <MetricCard label="Bugünkü Harcama" value={`₺${fmt(today_spend)}`} accent="#60A5FA" />
          <MetricCard label="Ort. ROAS" value={`${Number(summary?.avg_roas || 0).toFixed(2)}x`} accent="#A78BFA" />
          <MetricCard label="Dönüşüm" value={fmt(summary?.total_conversions)} sub="Son 30 gün" accent="var(--amber)" />
        </div>

        {!integrations?.length ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Bağlı platform yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Entegrasyonlar sayfasından reklam hesabını bağlayın.</div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div><div className="card-title">Platform Performansı</div><div className="card-subtitle">Son 30 gün</div></div>
            </div>
            <div className="card-body">
              {integrations.map(i => {
                const color = PLATFORM_COLORS[i.platform] || 'var(--teal)';
                const icon = i.platform === 'google_analytics' ? 'GA' : i.platform[0].toUpperCase();
                return (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: `${color}20`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{PLATFORM_LABELS[i.platform]}</div>
                        {i.account_id && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i.account_id}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 28, fontSize: 13 }}>
                      <span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}>₺{fmt(i.total_spend)}</span>
                      <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{Number(i.avg_roas).toFixed(2)}x ROAS</span>
                      <span style={{ color: 'var(--text3)' }}>{fmt(i.total_conversions)} dönüşüm</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {budget && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Ay Bütçesi</div>
                <div className="card-subtitle">{MONTHS[(budget.month || 1) - 1]} {budget.year}</div>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Toplam</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)' }}>₺{fmt(budget.total_budget)}</div>
              </div>
              {budget.google_ads_budget > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Google Ads</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: '#4285F4' }}>₺{fmt(budget.google_ads_budget)}</div>
                </div>
              )}
              {budget.meta_budget > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Meta Ads</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: '#1877F2' }}>₺{fmt(budget.meta_budget)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {anomalies?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div><div className="card-title">Son Anomaliler</div><div className="card-subtitle">{anomalies.length} uyarı</div></div>
            </div>
            <div className="card-body">
              {anomalies.slice(0, 3).map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border2)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--coral)' }}>{PLATFORM_LABELS[a.platform] || a.platform}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{a.metric}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(a.detected_at).toLocaleDateString('tr-TR')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const [data, setData] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const isAgency = user?.role === 'agency';

  useEffect(() => {
    setData(null);
    if (isAgency && !selectedBrand) return;
    const fetch = isAgency
      ? getAgencyBrandDetail(selectedBrand.id)
      : getBrandDashboard();
    fetch.then(setData).catch(console.error);
  }, [isAgency, selectedBrand?.id]);

  if (isAgency && !selectedBrand) return <NoBrandSelected />;

  const title = isAgency ? selectedBrand?.company_name : 'Dashboard';

  if (!data) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">{title}</div></div>
      <div className="loading">Yükleniyor...</div>
    </div>
  );

  return (
    <DashboardContent
      data={data}
      title={title}
      showInvite={showInvite}
      setShowInvite={setShowInvite}
      isAgency={isAgency}
    />
  );
}
