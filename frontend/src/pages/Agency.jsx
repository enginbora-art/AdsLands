import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAgencyDashboard, getBrandDashboard } from '../api';

const PLATFORM_LABELS = {
  google_ads: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  google_analytics: 'Google Analytics',
};

const PLATFORM_COLORS = {
  google_ads: '#4285F4',
  meta: '#1877F2',
  tiktok: '#00BFA6',
  google_analytics: '#E37400',
};

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 });

function AnomalyBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{ background: 'rgba(255,107,90,0.15)', color: 'var(--coral)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
      {count} anomali
    </span>
  );
}

function IntegrationRow({ integration }) {
  const icon = integration.platform === 'google_analytics' ? 'GA' : integration.platform[0].toUpperCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${PLATFORM_COLORS[integration.platform]}20`, color: PLATFORM_COLORS[integration.platform], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{PLATFORM_LABELS[integration.platform]}</span>
      </div>
      <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
        <span style={{ color: 'var(--text3)' }}>₺{fmt(integration.total_spend)}</span>
        <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{Number(integration.avg_roas || 0).toFixed(2)}x ROAS</span>
        <span style={{ color: 'var(--text3)' }}>{fmt(integration.total_conversions)} dönüşüm</span>
      </div>
    </div>
  );
}

function AgencyView() {
  const [data, setData] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgencyDashboard()
      .then(d => { setData(d); if (d.clients.length > 0) setSelectedClient(d.clients[0]); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: 'var(--text3)', padding: 32 }}>Yükleniyor...</div>;

  if (!data?.clients?.length) {
    return (
      <div style={{ padding: '32px 28px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Müşteri Yönetimi</h1>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 40, textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Henüz bağlı müşteri yok</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Markalar sizi ajans olarak davet ettiğinde burada görünecekler.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Müşteri Yönetimi</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>{data.clients.length} aktif müşteri · {data.total_anomalies} anomali</p>
        </div>
        {data.total_anomalies > 0 && (
          <div style={{ background: 'rgba(255,107,90,0.12)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 8, padding: '8px 16px', color: 'var(--coral)', fontSize: 13, fontWeight: 600 }}>
            ⚠️ {data.total_anomalies} anomali tespit edildi
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Müşteriler</div>
          {data.clients.map(client => (
            <div
              key={client.brand.id}
              onClick={() => setSelectedClient(client)}
              style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border2)',
                background: selectedClient?.brand.id === client.brand.id ? 'var(--teal-dim)' : 'transparent',
                borderLeft: selectedClient?.brand.id === client.brand.id ? '3px solid var(--teal)' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{client.brand.company_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{client.integrations.length} platform</div>
                </div>
                <AnomalyBadge count={client.anomalies.length} />
              </div>
            </div>
          ))}
        </div>

        {selectedClient && (
          <div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selectedClient.brand.company_name}</h2>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{selectedClient.brand.email}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--teal)' }}>
                  ₺{fmt(selectedClient.summary.total_spend)} <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>/ 30 gün</span>
                </div>
              </div>
              {selectedClient.integrations.length === 0
                ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Henüz bağlı platform yok.</div>
                : selectedClient.integrations.map(i => <IntegrationRow key={i.id} integration={i} />)
              }
            </div>

            {selectedClient.anomalies.length > 0 && (
              <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--coral)', marginBottom: 12 }}>⚠️ Anomali Uyarıları</h3>
                {selectedClient.anomalies.map((a, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < selectedClient.anomalies.length - 1 ? '1px solid var(--border2)' : 'none', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{PLATFORM_LABELS[a.platform]}</span>
                      <span style={{ color: 'var(--text3)' }}>{new Date(a.detected_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div style={{ color: 'var(--text3)', marginTop: 4 }}>
                      Harcama: <span style={{ color: 'var(--coral)', fontWeight: 600 }}>₺{fmt(a.actual_value)}</span> (beklenen: ₺{fmt(a.expected_value)})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BrandView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrandDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: 'var(--text3)', padding: 32 }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: '32px 28px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Reklam Performansı</h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>Son 30 günlük platform bazlı özet</p>

      {!data?.integrations?.length ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Henüz bağlı platform yok</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Entegrasyonlar sayfasından reklam hesabınızı bağlayın.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Toplam Harcama', val: `₺${fmt(data.summary.total_spend)}`, color: 'var(--teal)' },
              { label: 'Ort. ROAS', val: `${Number(data.summary.avg_roas).toFixed(2)}x`, color: '#A78BFA' },
              { label: 'Toplam Dönüşüm', val: fmt(data.summary.total_conversions), color: '#60A5FA' },
              { label: 'Toplam Tıklama', val: fmt(data.summary.total_clicks), color: '#FFB547' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Platform Bazlı Performans</h3>
            {data.integrations.map(i => <IntegrationRow key={i.id} integration={i} />)}
          </div>

          {data.anomalies?.length > 0 && (
            <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--coral)', marginBottom: 12 }}>⚠️ Anomali Uyarıları</h3>
              {data.anomalies.map((a, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < data.anomalies.length - 1 ? '1px solid var(--border2)' : 'none', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{PLATFORM_LABELS[a.platform]}</span>
                    <span style={{ color: 'var(--text3)' }}>{new Date(a.detected_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                  <div style={{ color: 'var(--text3)', marginTop: 4 }}>
                    Harcama: <span style={{ color: 'var(--coral)', fontWeight: 600 }}>₺{fmt(a.actual_value)}</span> (beklenen: ₺{fmt(a.expected_value)})
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Agency() {
  const { user } = useAuth();
  return user?.role === 'agency' ? <AgencyView /> : <BrandView />;
}
