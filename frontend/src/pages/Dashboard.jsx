import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getBrandDashboard, getAgencyBrandDetail, getAgencyDashboard, getLastUpdated, refreshMetrics, getCampaigns } from '../api';
import InviteModal from '../components/InviteModal';
import SubscriptionBanner from '../components/SubscriptionBanner';

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const PLATFORM_LABELS = { google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', google_analytics: 'Google Analytics', linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust', other: 'Diğer' };
const PLATFORM_COLORS = { google_ads: '#4285F4', meta: '#1877F2', tiktok: '#69C9D0', google_analytics: '#E37400', linkedin: '#0A66C2', adform: '#FF6B00', appsflyer: '#00B4E6', adjust: '#00B2FF', other: '#6B7280' };
const LEGACY_CHANNEL_MAP = [
  { field: 'google_ads_budget', platform: 'google_ads' },
  { field: 'meta_ads_budget',   platform: 'meta'       },
  { field: 'tiktok_ads_budget', platform: 'tiktok'     },
];
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function Gauge({ value = 0, color = '#F59E0B' }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setP(Math.min(Math.max(value, 0), 1)), 150);
    return () => clearTimeout(id);
  }, [value]);
  // M 12 40 A 28 28 0 0 0 68 40 = semicircle from left to right through TOP
  const arcLen = Math.PI * 28;
  const filled = arcLen * p;
  return (
    <svg width="72" height="40" viewBox="8 8 64 36" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M 12 40 A 28 28 0 0 0 68 40" fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 12 40 A 28 28 0 0 0 68 40" fill="none"
        stroke={color} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={`${filled} ${arcLen}`}
        style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
    </svg>
  );
}

function MetricCard({ label, value, sub, accent, danger, gauge }) {
  const color = danger ? '#F87171' : (accent || 'var(--text1)');
  const isHex = color.startsWith('#');
  const bg    = isHex ? `${color}0D` : 'transparent';
  const glow  = isHex ? `0 0 25px ${color}33, 0 0 50px ${color}14` : 'none';
  return (
    <div
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = glow; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
      style={{
        background: bg,
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: '18px 20px',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 600 }}>{label}</div>
      {gauge != null ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
          </div>
          <Gauge value={gauge} color={color} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
        </>
      )}
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
function AgencySummary({ onNav }) {
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
        <SubscriptionBanner onNav={onNav} />
        <div className="metrics" style={{ marginBottom: 24 }}>
          <MetricCard label="Toplam Müşteri"      value={loading ? '—' : summary.total_clients}                       sub="Bağlı marka"  accent="#A78BFA" />
          <MetricCard label="Yönetilen Bütçe"     value={loading ? '—' : `₺${fmt(summary.total_managed_budget)}`}    sub="Bu ay toplam" accent="#00C9A7" />
          <MetricCard label="Bugünkü Harcama"     value={loading ? '—' : `₺${fmt(summary.total_today_spend)}`}       sub="Tüm markalar" accent="#38BDF8" />
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
function ActiveCampaigns({ campaigns, onNav }) {
  if (!campaigns?.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Aktif Kampanyalar</div>
          <div className="card-subtitle">{campaigns.length} kampanya</div>
        </div>
        <button onClick={() => onNav('campaigns')} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)' }}>
          Tümü →
        </button>
      </div>
      <div className="card-body">
        {campaigns.map(c => {
          const pct = c.total_budget > 0 ? Math.min((c.total_spend / c.total_budget) * 100, 100) : 0;
          const daysLeft = Math.max(Math.ceil((new Date(c.end_date) - new Date()) / 86400000), 0);
          const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#00C9A7';
          return (
            <div key={c.id} onClick={() => onNav('campaigns')}
              style={{ padding: '12px 0', borderBottom: '1px solid var(--border2)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)' }}>
                  <span style={{ color: '#00C9A7', fontWeight: 600 }}>{Number(c.avg_roas || 0).toFixed(2)}x ROAS</span>
                  <span>{fmt(c.total_conversions)} dönüşüm</span>
                  <span style={{ color: daysLeft <= 3 ? '#EF4444' : daysLeft <= 7 ? '#F59E0B' : 'var(--text3)' }}>{daysLeft}g kaldı</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>
                <span>₺{fmt(c.total_spend)}</span>
                <span style={{ color: pct >= 80 ? '#F59E0B' : 'inherit' }}>%{Math.round(pct)}</span>
                <span>₺{fmt(c.total_budget)}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandDashboardContent({ data, title, isAgency, showInvite, setShowInvite, onNav, lastUpdated, onRefresh, refreshing, campaigns }) {
  const { summary, integrations, today_spend, budget, anomalies } = data;

  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {updatedLabel && (
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
              Son güncelleme: {updatedLabel}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: refreshing ? 'var(--text3)' : 'var(--text1)', opacity: refreshing ? 0.6 : 1, fontFamily: 'var(--font)' }}>
            {refreshing ? 'Güncelleniyor...' : 'Şimdi Yenile'}
          </button>
          {!isAgency && (
            <button
              className="btn-glow-teal"
              style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--teal)', background: 'transparent', color: 'var(--teal)' }}
              onClick={() => setShowInvite(true)}>
              + Ajans Davet Et
            </button>
          )}
        </div>
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      <div className="content">
        <SubscriptionBanner onNav={onNav} />
        <BudgetIntegrationWarning budget={budget} integrations={integrations} onNav={onNav} />
        <div className="metrics" style={{ marginBottom: 24 }}>
          <MetricCard label="30g Harcama"     value={`₺${fmt(summary?.total_spend)}`}             accent="#00C9A7" />
          <MetricCard label="Bugünkü Harcama" value={`₺${fmt(today_spend)}`}                       accent="#38BDF8" />
          <MetricCard label="Ort. ROAS"       value={`${Number(summary?.avg_roas || 0).toFixed(2)}x`} accent="#A78BFA" gauge={Math.min(Number(summary?.avg_roas || 0) / 5, 1)} />
          <MetricCard label="Dönüşüm"         value={fmt(summary?.total_conversions)} sub="Son 30 gün" accent="#F59E0B" gauge={0.75} />
        </div>

        <ActiveCampaigns campaigns={campaigns} onNav={onNav} />

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
                  <div
                    key={i.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(13,27,42,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(13,27,42,0.4)'}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,27,42,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 16, marginBottom: 8, transition: 'background 0.2s' }}
                  >
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

        {budget && (() => {
          const channels = budget.channels?.length > 0
            ? budget.channels
            : LEGACY_CHANNEL_MAP.filter(lc => Number(budget[lc.field]) > 0).map(lc => ({ platform: lc.platform, amount: Number(budget[lc.field]) }));
          return (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div><div className="card-title">Ay Bütçesi</div><div className="card-subtitle">{MONTHS[(budget.month || 1) - 1]} {budget.year}</div></div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: channels.length > 0 ? 16 : 0 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Toplam</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)' }}>₺{fmt(budget.total_budget)}</div>
                  </div>
                </div>
                {channels.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {channels.map(ch => {
                      const label = PLATFORM_LABELS[ch.platform] || ch.platform;
                      const color = PLATFORM_COLORS[ch.platform] || '#6B7280';
                      const pct = Number(budget.total_budget) > 0 ? (ch.amount / Number(budget.total_budget)) * 100 : 0;
                      return (
                        <div key={ch.platform}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text1)' }}>₺{fmt(ch.amount)}</span>
                              <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 32, textAlign: 'right' }}>%{Math.round(pct)}</span>
                            </div>
                          </div>
                          <div style={{ height: 4, background: 'var(--bg3,rgba(255,255,255,0.06))', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ── Ana export ────────────────────────────────────────────────────────────────
export default function Dashboard({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const pollRef = useRef(null);
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

  // Fetch active campaigns for the dashboard section
  useEffect(() => {
    if (isAgency && !selectedBrand) return;
    const params = isAgency && selectedBrand ? { brand_id: selectedBrand.id, status: 'active' } : { status: 'active' };
    getCampaigns(params).then(setActiveCampaigns).catch(() => setActiveCampaigns([]));
  }, [isAgency, selectedBrand?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch last-updated timestamp + poll every 5 minutes
  const fetchLastUpdated = useCallback(() => {
    getLastUpdated()
      .then(d => setLastUpdated(d.last_updated))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isAgency && !selectedBrand) return;
    fetchLastUpdated();
    pollRef.current = setInterval(fetchLastUpdated, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [isAgency, selectedBrand?.id, fetchLastUpdated]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshMetrics();
      // Re-fetch last-updated after a brief delay to let the backend finish
      setTimeout(fetchLastUpdated, 3000);
    } catch (err) {
      console.error('Refresh hatası:', err?.response?.data?.error || err.message);
    } finally {
      setTimeout(() => setRefreshing(false), 3000);
    }
  }, [refreshing, fetchLastUpdated]);

  // Agency, marka seçilmemiş → özet kartlar
  if (isAgency && !selectedBrand) return <AgencySummary onNav={onNav} />;

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
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      campaigns={activeCampaigns}
    />
  );
}
