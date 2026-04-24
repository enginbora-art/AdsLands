import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAgencyDashboard, getAgencyBrandDetail, getBrandDashboard } from '../api';
import Budget from './Budget';

const PLATFORM_LABELS = { google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', google_analytics: 'Google Analytics' };
const PLATFORM_COLORS = { google_ads: '#4285F4', meta: '#1877F2', tiktok: '#00BFA6', google_analytics: '#E37400' };
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 });

function avatar(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function statusOf(anomalyCount) {
  if (anomalyCount >= 3) return 'critical';
  if (anomalyCount >= 1) return 'warning';
  return 'normal';
}

const STATUS_STYLE = {
  normal:   { bg: 'rgba(52,211,153,0.12)',  color: 'var(--success)', label: 'Normal' },
  warning:  { bg: 'rgba(255,181,71,0.15)',  color: 'var(--amber)',   label: 'Uyarı' },
  critical: { bg: 'rgba(255,107,90,0.15)',  color: 'var(--coral)',   label: 'Kritik' },
};

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, accent, danger }) {
  return (
    <div style={{ background: 'var(--bg2)', border: `1px solid ${danger ? 'rgba(255,107,90,0.3)' : 'var(--border2)'}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: danger ? 'var(--coral)' : accent || 'var(--text1)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── KATMAN 1: Genel Dashboard ─────────────────────────────────────────────────
function AgencyOverview({ data, onSelectBrand }) {
  const sorted = [...(data?.clients || [])].sort((a, b) => b.anomalies.length - a.anomalies.length);
  const { summary } = data || {};

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Müşteri Yönetimi</div>
        <div className="topbar-right" style={{ fontSize: 13, color: 'var(--text3)' }}>
          {summary?.total_clients || 0} aktif müşteri
        </div>
      </div>
      <div className="content">
        {/* Özet kartlar */}
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <SummaryCard label="Yönetilen Bütçe" value={`₺${fmt(summary?.total_managed_budget)}`} sub="Bu ay toplam" accent="var(--teal)" />
          <SummaryCard label="Aktif Müşteri" value={summary?.total_clients || 0} sub="Bağlı marka" accent="#A78BFA" />
          <SummaryCard label="Bugünkü Harcama" value={`₺${fmt(summary?.total_today_spend)}`} sub="Tüm markalar" accent="#60A5FA" />
          <SummaryCard
            label="Aktif Anomali"
            value={summary?.total_anomalies || 0}
            sub={summary?.total_anomalies > 0 ? 'Dikkat gerektiriyor' : 'Sorun yok'}
            danger={summary?.total_anomalies > 0}
          />
        </div>

        {/* Marka tablosu */}
        {sorted.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🤝</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Henüz bağlı müşteri yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Markalar sizi ajans olarak davet ettiğinde burada görünürler.</div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Müşteri Listesi</div>
              <div className="card-subtitle">Anomalisi olanlar üstte</div>
            </div>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Marka</th>
                  <th>30g Harcama</th>
                  <th>ROAS</th>
                  <th>Ay Bütçesi</th>
                  <th>Anomali</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(client => {
                  const status = statusOf(client.anomalies.length);
                  const ss = STATUS_STYLE[status];
                  return (
                    <tr key={client.brand.id}
                      onClick={() => onSelectBrand(client.brand)}
                      style={{ cursor: 'pointer' }}
                      className="hover-row">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,191,166,0.15)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                            {avatar(client.brand.company_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{client.brand.company_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{client.integrations.length} platform</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>₺{fmt(client.summary.total_spend)}</td>
                      <td style={{ color: client.summary.avg_roas >= 3 ? 'var(--success)' : 'var(--text2)', fontWeight: 600 }}>
                        {Number(client.summary.avg_roas).toFixed(2)}x
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 13, color: client.monthly_budget > 0 ? 'var(--text1)' : 'var(--text3)' }}>
                        {client.monthly_budget > 0 ? `₺${fmt(client.monthly_budget)}` : '—'}
                      </td>
                      <td>
                        {client.anomalies.length > 0
                          ? <span style={{ background: 'rgba(255,107,90,0.15)', color: 'var(--coral)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{client.anomalies.length}</span>
                          : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td>
                        <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>{ss.label}</span>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 16 }}>›</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Katman 2: Dashboard Tab ───────────────────────────────────────────────────
function BrandDashboardTab({ data }) {
  if (!data) return <div style={{ color: 'var(--text3)', padding: 24 }}>Yükleniyor...</div>;

  const { summary, integrations, today_spend, budget } = data;

  return (
    <div>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <SummaryCard label="30g Harcama" value={`₺${fmt(summary.total_spend)}`} accent="var(--teal)" />
        <SummaryCard label="Bugün" value={`₺${fmt(today_spend)}`} accent="#60A5FA" />
        <SummaryCard label="Ort. ROAS" value={`${Number(summary.avg_roas).toFixed(2)}x`} accent="#A78BFA" />
        <SummaryCard label="Ay Bütçesi" value={budget ? `₺${fmt(budget.total_budget)}` : '—'} sub={budget ? `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}` : 'Belirlenmedi'} accent="var(--amber)" />
      </div>

      {integrations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Bağlı platform yok</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Bu marka henüz reklam hesabı bağlamamış.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><div className="card-title">Platform Performansı</div><div className="card-subtitle">Son 30 gün</div></div>
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
    </div>
  );
}

// ── Katman 2: Entegrasyonlar Tab ──────────────────────────────────────────────
function BrandIntegrationsTab({ integrations }) {
  if (!integrations) return <div style={{ color: 'var(--text3)', padding: 24 }}>Yükleniyor...</div>;

  if (integrations.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🔌</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Bağlı platform yok</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Bu marka henüz reklam hesabı bağlamamış.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Bağlı Platformlar</div></div>
      <div className="card-body">
        {integrations.map(i => {
          const color = PLATFORM_COLORS[i.platform] || 'var(--teal)';
          const icon = i.platform === 'google_analytics' ? 'GA' : i.platform[0].toUpperCase();
          return (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}20`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{icon}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{PLATFORM_LABELS[i.platform]}</div>
                  {i.account_id && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Hesap: {i.account_id}</div>}
                </div>
              </div>
              <span style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--success)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>Aktif</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Katman 2: Anomaliler Tab ──────────────────────────────────────────────────
function BrandAnomaliesTab({ anomalies }) {
  if (!anomalies) return <div style={{ color: 'var(--text3)', padding: 24 }}>Yükleniyor...</div>;

  if (anomalies.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Anomali yok</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Bu markada tespit edilmiş anormal harcama bulunmuyor.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Anomali Uyarıları</div>
        <div className="card-subtitle">{anomalies.length} kayıt</div>
      </div>
      <div className="card-body">
        {anomalies.map((a, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: i < anomalies.length - 1 ? '1px solid var(--border2)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: PLATFORM_COLORS[a.platform] || 'var(--text1)' }}>{PLATFORM_LABELS[a.platform]}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(a.detected_at).toLocaleDateString('tr-TR')}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {a.metric} · Gerçek: <span style={{ color: 'var(--coral)', fontWeight: 600 }}>₺{fmt(a.actual_value)}</span>
              {a.expected_value && <> · Beklenen: ₺{fmt(a.expected_value)}</>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KATMAN 2: Marka Detay ─────────────────────────────────────────────────────
const TABS = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'budget',        label: 'Bütçe Planlama' },
  { key: 'integrations',  label: 'Entegrasyonlar' },
  { key: 'anomalies',     label: 'Anomaliler' },
];

function BrandDetail({ brand, onBack }) {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAgencyBrandDetail(brand.id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [brand.id]);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 8, padding: '5px 12px', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Tüm Müşteriler
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,191,166,0.15)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
              {avatar(brand.company_name)}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{brand.company_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{brand.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid var(--border2)', background: 'var(--bg1)', padding: '0 28px', display: 'flex', gap: 2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px',
            fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? 'var(--teal)' : 'var(--text3)',
            borderBottom: tab === t.key ? '2px solid var(--teal)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="content">
        {tab === 'dashboard'    && <BrandDashboardTab data={loading ? null : data} />}
        {tab === 'budget'       && <Budget forceBrandId={brand.id} forceBrandName={brand.company_name} />}
        {tab === 'integrations' && <BrandIntegrationsTab integrations={loading ? null : data?.integrations} />}
        {tab === 'anomalies'    && <BrandAnomaliesTab anomalies={loading ? null : data?.anomalies} />}
      </div>
    </div>
  );
}

// ── Ajans Ana Görünüm ─────────────────────────────────────────────────────────
function AgencyView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState(null);

  useEffect(() => {
    getAgencyDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Yükleniyor...</div>;

  if (selectedBrand) {
    return <BrandDetail brand={selectedBrand} onBack={() => setSelectedBrand(null)} />;
  }

  return <AgencyOverview data={data} onSelectBrand={setSelectedBrand} />;
}

// ── Marka Görünüm ─────────────────────────────────────────────────────────────
function BrandView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrandDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Reklam Performansı</div></div>
      <div className="content">
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <SummaryCard label="30g Harcama" value={`₺${fmt(data?.summary?.total_spend)}`} accent="var(--teal)" />
          <SummaryCard label="Bugün" value={`₺${fmt(data?.today_spend)}`} accent="#60A5FA" />
          <SummaryCard label="Ort. ROAS" value={`${Number(data?.summary?.avg_roas || 0).toFixed(2)}x`} accent="#A78BFA" />
          <SummaryCard label="Dönüşüm" value={fmt(data?.summary?.total_conversions)} sub="Son 30 gün" accent="var(--amber)" />
        </div>

        {!data?.integrations?.length ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Henüz bağlı platform yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Entegrasyonlar sayfasından reklam hesabınızı bağlayın.</div>
          </div>
        ) : (
          <BrandDashboardTab data={data} />
        )}

        {data?.anomalies?.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <BrandAnomaliesTab anomalies={data.anomalies} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function Agency() {
  const { user } = useAuth();
  return user?.role === 'agency' ? <AgencyView /> : <BrandView />;
}
