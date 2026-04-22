import { useState, useEffect } from 'react';
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  disconnectGoogleIntegration,
  getIntegrationMetrics,
  getGoogleData,
} from '../api';

const PLATFORMS = [
  { id: 'google_analytics', name: 'Google Analytics', color: '#E37400', bg: 'rgba(227,116,0,0.1)', icon: 'GA', isGoogle: true },
  { id: 'google_ads', name: 'Google Ads', color: '#4285F4', bg: 'rgba(66,133,244,0.1)', icon: 'G', isGoogle: true },
  { id: 'meta', name: 'Meta Ads', color: '#1877F2', bg: 'rgba(24,119,242,0.1)', icon: 'M', isGoogle: false },
  { id: 'tiktok', name: 'TikTok Ads', color: '#00BFA6', bg: 'rgba(0,191,166,0.1)', icon: 'T', isGoogle: false },
];

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 });
const fmtDate = (str) => {
  if (!str) return '';
  if (str.length === 8) {
    // YYYYMMDD (GA4 format)
    return `${str.slice(6, 8)}.${str.slice(4, 6)}.${str.slice(0, 4)}`;
  }
  return new Date(str).toLocaleDateString('tr-TR');
};

function StatusBanner({ params, onDismiss }) {
  if (params.get('success')) {
    const p = params.get('platform');
    const name = PLATFORMS.find(x => x.id === p)?.name || 'Google';
    return (
      <div style={s.successBanner}>
        ✓ {name} başarıyla bağlandı.
        <button onClick={onDismiss} style={s.bannerClose}>×</button>
      </div>
    );
  }
  if (params.get('error')) {
    return (
      <div style={s.errorBanner}>
        ✗ Bağlantı kurulamadı: {params.get('error')}
        <button onClick={onDismiss} style={s.bannerClose}>×</button>
      </div>
    );
  }
  return null;
}

function MetricsTable({ platform, integration, metrics, liveData, liveLoading, onFetchLive }) {
  const isGA = platform === 'google_analytics';
  const isGoogle = platform === 'google_analytics' || platform === 'google_ads';

  if (liveData) {
    return (
      <div style={s.metricsPanel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={s.metricsTitle}>
            {PLATFORMS.find(p => p.id === platform)?.name} — Canlı Veri (Son 30 Gün)
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Hesap: {liveData.account_id}</span>
        </div>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {isGA
                  ? ['Tarih', 'Oturum', 'Kullanıcı', 'Dönüşüm', 'Gelir (₺)', 'Sayfa Görüntüleme'].map(h => <th key={h} style={s.th}>{h}</th>)
                  : ['Tarih', 'Harcama', 'Gösterim', 'Tıklama', 'Dönüşüm'].map(h => <th key={h} style={s.th}>{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {liveData.data.map((row, i) => (
                <tr key={i} style={s.tr}>
                  <td style={s.td}>{fmtDate(row.date)}</td>
                  {isGA ? (
                    <>
                      <td style={s.td}>{fmt(row.sessions)}</td>
                      <td style={s.td}>{fmt(row.users)}</td>
                      <td style={s.td}>{fmt(row.conversions)}</td>
                      <td style={{ ...s.td, color: 'var(--teal)', fontWeight: 600 }}>₺{fmt(row.revenue)}</td>
                      <td style={s.td}>{fmt(row.pageViews)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...s.td, color: 'var(--teal)', fontWeight: 600 }}>₺{fmt(row.spend)}</td>
                      <td style={s.td}>{fmt(row.impressions)}</td>
                      <td style={s.td}>{fmt(row.clicks)}</td>
                      <td style={s.td}>{fmt(row.conversions)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (metrics.length > 0) {
    return (
      <div style={s.metricsPanel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={s.metricsTitle}>
            {PLATFORMS.find(p => p.id === platform)?.name} — Son 30 Gün
          </h3>
          {isGoogle && (
            <button
              onClick={onFetchLive}
              disabled={liveLoading}
              style={{ ...s.detailBtn, padding: '6px 14px', fontSize: 12 }}
            >
              {liveLoading ? 'Yükleniyor...' : 'Canlı Veri Al'}
            </button>
          )}
        </div>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Tarih', 'Harcama', 'Gösterim', 'Tıklama', 'Dönüşüm', 'ROAS'].map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={i} style={s.tr}>
                  <td style={s.td}>{fmtDate(m.date)}</td>
                  <td style={s.td}>₺{fmt(m.spend)}</td>
                  <td style={s.td}>{fmt(m.impressions)}</td>
                  <td style={s.td}>{fmt(m.clicks)}</td>
                  <td style={s.td}>{fmt(m.conversions)}</td>
                  <td style={{ ...s.td, color: 'var(--teal)', fontWeight: 600 }}>{Number(m.roas).toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') || params.get('error') || params.get('integration_connected')) {
      setBanner(params);
      window.history.replaceState({}, '', window.location.pathname);
    }
    load();
  }, []);

  const load = async () => {
    try {
      const data = await getIntegrations();
      setIntegrations(data);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platformId) => {
    setConnecting(platformId);
    try {
      await connectIntegration(platformId);
      // Google platforms do a full-page redirect so no reload needed here
      // Mock platforms also redirect; reload handles the rest
    } catch (err) {
      console.error('Bağlantı hatası:', err);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integration) => {
    const isGoogle = integration.platform === 'google_analytics' || integration.platform === 'google_ads';
    setDisconnecting(integration.id);
    try {
      if (isGoogle) {
        await disconnectGoogleIntegration(integration.platform);
      } else {
        await disconnectIntegration(integration.id);
      }
      setIntegrations(prev => prev.filter(i => i.id !== integration.id));
      if (selected?.id === integration.id) {
        setSelected(null);
        setMetrics([]);
        setLiveData(null);
      }
    } finally {
      setDisconnecting(null);
    }
  };

  const handleSelect = async (integration) => {
    if (selected?.id === integration.id) {
      setSelected(null);
      setMetrics([]);
      setLiveData(null);
      return;
    }
    setSelected(integration);
    setLiveData(null);
    const data = await getIntegrationMetrics(integration.id);
    setMetrics(data);
  };

  const handleFetchLive = async () => {
    if (!selected) return;
    setLiveLoading(true);
    try {
      const data = await getGoogleData(selected.platform);
      setLiveData(data);
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Canlı veri çekilemedi.');
    } finally {
      setLiveLoading(false);
    }
  };

  const getConnected = (platformId) => integrations.find(i => i.platform === platformId);

  return (
    <div style={s.page}>
      {banner && (
        <StatusBanner params={banner} onDismiss={() => setBanner(null)} />
      )}

      <div style={s.header}>
        <h1 style={s.title}>Reklam Entegrasyonları</h1>
        <p style={s.sub}>Reklam platformlarınızı bağlayın, verilerinizi tek ekranda takip edin.</p>
      </div>

      <div style={s.grid}>
        {PLATFORMS.map(platform => {
          const connected = getConnected(platform.id);
          const isConnecting = connecting === platform.id;
          const isDisconnecting = disconnecting === connected?.id;

          return (
            <div key={platform.id} style={s.card}>
              <div style={s.cardTop}>
                <div style={{ ...s.icon, background: platform.bg, color: platform.color }}>
                  {platform.icon}
                </div>
                <div>
                  <div style={s.platformName}>{platform.name}</div>
                  <div style={{ ...s.status, color: connected ? '#00BFA6' : 'var(--text3)' }}>
                    {connected ? '● Bağlı' : '○ Bağlı değil'}
                  </div>
                </div>
                {platform.isGoogle && (
                  <div style={s.googleBadge}>Google OAuth</div>
                )}
              </div>

              {connected && (
                <div style={s.statsRow}>
                  <div style={s.stat}>
                    <div style={s.statLabel}>30G Harcama</div>
                    <div style={s.statVal}>₺{fmt(connected.total_spend)}</div>
                  </div>
                  <div style={s.stat}>
                    <div style={s.statLabel}>Ort. ROAS</div>
                    <div style={s.statVal}>{Number(connected.avg_roas || 0).toFixed(2)}x</div>
                  </div>
                  <div style={s.stat}>
                    <div style={s.statLabel}>Dönüşüm</div>
                    <div style={s.statVal}>{fmt(connected.total_conversions)}</div>
                  </div>
                </div>
              )}

              <div style={s.cardActions}>
                {connected ? (
                  <>
                    <button style={s.detailBtn} onClick={() => handleSelect(connected)}>
                      {selected?.id === connected.id ? 'Kapat' : 'Detay'}
                    </button>
                    <button
                      style={s.disconnectBtn}
                      onClick={() => handleDisconnect(connected)}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? '...' : 'Bağlantıyı Kes'}
                    </button>
                  </>
                ) : (
                  <button
                    style={{ ...s.connectBtn, background: isConnecting ? '#666' : platform.color }}
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Yönlendiriliyor...' : `${platform.name} Bağla`}
                  </button>
                )}
              </div>

              {connected?.account_id && (
                <div style={s.accountId}>
                  Hesap: {connected.account_id}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <MetricsTable
          platform={selected.platform}
          integration={selected}
          metrics={metrics}
          liveData={liveData}
          liveLoading={liveLoading}
          onFetchLive={handleFetchLive}
        />
      )}

      {loading && <div style={{ color: 'var(--text3)', padding: 32 }}>Yükleniyor...</div>}
    </div>
  );
}

const s = {
  page: { padding: '32px 28px' },
  header: { marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: 13, color: 'var(--text3)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 28 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 20 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' },
  icon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 },
  platformName: { fontSize: 15, fontWeight: 700 },
  status: { fontSize: 12, marginTop: 2 },
  googleBadge: { marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#4285F4', background: 'rgba(66,133,244,0.1)', padding: '2px 8px', borderRadius: 6 },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16, background: 'var(--bg3)', borderRadius: 8, padding: '10px 8px' },
  stat: { textAlign: 'center' },
  statLabel: { fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 },
  statVal: { fontSize: 13, fontWeight: 700 },
  cardActions: { display: 'flex', gap: 8 },
  connectBtn: { flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  detailBtn: { flex: 1, padding: '8px 0', background: 'var(--teal-dim)', border: '1px solid var(--teal-mid)', borderRadius: 8, color: 'var(--teal)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  disconnectBtn: { flex: 1, padding: '8px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer' },
  accountId: { marginTop: 10, fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' },
  metricsPanel: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 24 },
  metricsTitle: { fontSize: 15, fontWeight: 700 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', borderBottom: '1px solid var(--border2)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--border2)' },
  td: { padding: '11px 14px', fontSize: 13 },
  successBanner: { marginBottom: 20, background: 'rgba(0,191,166,0.12)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '12px 16px', color: 'var(--teal)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  errorBanner: { marginBottom: 20, background: 'rgba(255,107,90,0.12)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 10, padding: '12px 16px', color: 'var(--coral)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bannerClose: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'inherit', lineHeight: 1 },
};
