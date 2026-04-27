import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getBrandDashboard, getAgencyBrandDetail, getAgencyDashboard } from '../api';
import InviteModal from '../components/InviteModal';

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const PLATFORM_LABELS = { google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', google_analytics: 'Google Analytics' };
const PLATFORM_COLORS = { google_ads: '#4285F4', meta: '#1877F2', tiktok: '#00BFA6', google_analytics: '#E37400' };
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function MetricCard({ label, value, sub, accent, danger }) {
  return (
    <div style={{ background: 'var(--bg2)', border: `1px solid ${danger ? 'rgba(255,107,90,0.3)' : 'var(--border2)'}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: danger ? 'var(--coral)' : accent || 'var(--text1)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Bütçe-entegrasyon uyarı banner'ı ─────────────────────────────────────────
const BUDGET_CHECKS = [
  { field: 'google_ads_budget', platform: 'google_ads', label: 'Google Ads' },
  { field: 'meta_ads_budget',   platform: 'meta',       label: 'Meta Ads'   },
  { field: 'tiktok_ads_budget', platform: 'tiktok',     label: 'TikTok Ads' },
];

function BudgetIntegrationWarning({ budget, integrations, onNav }) {
  const dismissKey = budget
    ? `budget_warn_${budget.company_id}_${budget.month}_${budget.year}_${new Date().toDateString()}`
    : null;

  const [dismissed, setDismissed] = useState(() =>
    dismissKey ? !!localStorage.getItem(dismissKey) : true
  );

  if (!budget || dismissed) return null;

  const connected = new Set((integrations || []).map(i => i.platform));
  const missing = BUDGET_CHECKS.filter(c => parseFloat(budget[c.field]) > 0 && !connected.has(c.platform));

  if (missing.length === 0) return null;

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const message = missing.length === 1
    ? `Bütçe planınızda ${missing[0].label} için ₺${fmt(budget[missing[0].field])} ayrıldı ancak hesap bağlı değil. Veri takibi yapılamıyor.`
    : `${missing.map(m => m.label).join(' ve ')} hesapları bağlı değil. Bütçe takibi eksik.`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: 10, padding: '11px 16px', marginBottom: 20,
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1, fontSize: 13, color: '#F59E0B', lineHeight: 1.5 }}>{message}</div>
      <button
        onClick={() => onNav?.('integrations')}
        style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(245,158,11,0.5)', borderRadius: 7, color: '#F59E0B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        Entegrasyona Git →
      </button>
      <button
        onClick={dismiss}
        style={{ background: 'none', border: 'none', color: 'rgba(245,158,11,0.6)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>
        ×
      </button>
    </div>
  );
}

// ── Ajans özet dashboard (marka seçilmemiş) ───────────────────────────────────
function AgencySummary() {
  const [summary, setSummary] = useState({
    total_managed_budget: 0,
    total_clients: 0,
    total_today_spend: 0,
    total_anomalies: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgencyDashboard()
      .then(d => setSummary(d?.summary || summary))
      .catch(() => {}) // hata olsa bile 0 göster
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Dashboard</div></div>
      <div className="content">
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <MetricCard label="Toplam Müşteri"      value={loading ? '—' : summary.total_clients}                       sub="Bağlı marka"  accent="#A78BFA" />
          <MetricCard label="Yönetilen Bütçe"     value={loading ? '—' : `₺${fmt(summary.total_managed_budget)}`}    sub="Bu ay toplam" accent="var(--teal)" />
          <MetricCard label="Bugünkü Harcama"     value={loading ? '—' : `₺${fmt(summary.total_today_spend)}`}       sub="Tüm markalar" accent="#60A5FA" />
          <MetricCard
            label="Aktif Anomali"
            value={loading ? '—' : summary.total_anomalies}
            sub={summary.total_anomalies > 0 ? 'Dikkat gerektiriyor' : 'Sorun yok'}
            danger={summary.total_anomalies > 0}
          />
        </div>
        {!loading && summary.total_clients === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Henüz bağlı marka yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Sol menüden <strong style={{ color: 'var(--text1)' }}>Markalar</strong>'a gidin ve marka ekleyin veya bağlantı isteği gönderin.
            </div>
          </div>
        )}
        {!loading && summary.total_clients > 0 && (
          <div style={{ padding: '14px 18px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 13, color: 'var(--text3)' }}>
            Marka detayları için sol menüden <strong style={{ color: 'var(--text1)' }}>Markalar</strong>'a gidin ve bir marka seçin.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Marka dashboard içeriği ────────────────────────────────────────────────────
function BrandDashboardContent({ data, title, isAgency, showInvite, setShowInvite, onNav }) {
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
              + Ajans Davet Et
            </button>
          </div>
        )}
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      <div className="content">
        <BudgetIntegrationWarning budget={budget} integrations={integrations} onNav={onNav} />
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <MetricCard label="30g Harcama"     value={`₺${fmt(summary?.total_spend)}`}             accent="var(--teal)" />
          <MetricCard label="Bugünkü Harcama" value={`₺${fmt(today_spend)}`}                       accent="#60A5FA" />
          <MetricCard label="Ort. ROAS"       value={`${Number(summary?.avg_roas || 0).toFixed(2)}x`} accent="#A78BFA" />
          <MetricCard label="Dönüşüm"         value={fmt(summary?.total_conversions)} sub="Son 30 gün" accent="var(--amber)" />
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
                      <span style={{ fontFamily: 'var(--mono)' }}>₺{fmt(i.total_spend)}</span>
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
              <div><div className="card-title">Ay Bütçesi</div><div className="card-subtitle">{MONTHS[(budget.month || 1) - 1]} {budget.year}</div></div>
            </div>
            <div className="card-body" style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Toplam</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)' }}>₺{fmt(budget.total_budget)}</div>
              </div>
              {budget.google_ads_budget > 0 && <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Google Ads</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: '#4285F4' }}>₺{fmt(budget.google_ads_budget)}</div>
              </div>}
              {budget.meta_budget > 0 && <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Meta Ads</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: '#1877F2' }}>₺{fmt(budget.meta_budget)}</div>
              </div>}
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
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {a.detected_at ? new Date(a.detected_at).toLocaleDateString('tr-TR') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_BRAND_DATA = {
  summary: { total_spend: 0, avg_roas: 0, total_conversions: 0, total_clicks: 0 },
  integrations: [],
  anomalies: [],
  today_spend: 0,
  budget: null,
};

// ── Ana export ────────────────────────────────────────────────────────────────
export default function Dashboard({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const isAgency = user?.company_type === 'agency';

  useEffect(() => {
    setData(null);
    setApiError(null);
    setLoading(true);
    if (isAgency && !selectedBrand) { setLoading(false); return; }

    const brandId = selectedBrand?.id;
    console.log('[Dashboard] fetching brand data, brandId=', brandId, 'isAgency=', isAgency);

    const req = isAgency
      ? getAgencyBrandDetail(brandId)
      : getBrandDashboard();

    req
      .then(d => {
        console.log('[Dashboard] response integrations count=', d?.integrations?.length, d);
        setData(d);
      })
      .catch(err => {
        const status = err?.response?.status;
        const msg = err?.response?.data?.error || err?.message || 'Bilinmeyen hata';
        console.error('[Dashboard] API error', status, msg, err);
        setApiError({ status, msg });
        setData(EMPTY_BRAND_DATA);
      })
      .finally(() => setLoading(false));
  }, [isAgency, selectedBrand?.id]);

  // Agency, marka seçilmemiş → özet kartlar
  if (isAgency && !selectedBrand) return <AgencySummary />;

  const title = isAgency ? (selectedBrand?.name || selectedBrand?.company_name) : 'Dashboard';

  if (loading) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">{title}</div></div>
      <div className="loading">Yükleniyor...</div>
    </div>
  );

  if (apiError) {
    return (
      <div className="fade-in">
        <div className="topbar"><div className="topbar-title">{title}</div></div>
        <div className="content">
          <div style={{ background: 'rgba(255,107,90,0.1)', border: '1px solid rgba(255,107,90,0.25)', borderRadius: 10, padding: '16px 20px', fontSize: 13, color: 'var(--coral)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {apiError.status === 403 ? 'Erişim Reddedildi' : 'Veri Yüklenemedi'}
            </div>
            <div style={{ color: 'var(--text3)' }}>{apiError.msg}</div>
            {apiError.status === 403 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                Bu marka ile bağlantı kaydı bulunamadı. Markalar sayfasından bağlantı durumunu kontrol edin.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrandDashboardContent
      data={data || EMPTY_BRAND_DATA}
      title={title}
      isAgency={isAgency}
      showInvite={showInvite}
      setShowInvite={setShowInvite}
      onNav={onNav}
    />
  );
}
