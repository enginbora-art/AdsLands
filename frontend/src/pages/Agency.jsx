import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAgencyDashboard } from '../api';

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

function avatar(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function statusOf(n) {
  if (n >= 3) return 'critical';
  if (n >= 1) return 'warning';
  return 'normal';
}

const STATUS_STYLE = {
  normal:   { bg: 'rgba(52,211,153,0.12)',  color: 'var(--success)', label: 'Normal' },
  warning:  { bg: 'rgba(255,181,71,0.15)',  color: 'var(--amber)',   label: 'Uyarı' },
  critical: { bg: 'rgba(255,107,90,0.15)',  color: 'var(--coral)',   label: 'Kritik' },
};

export default function Agency({ onSelectBrand }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.role !== 'agency') return;
    getAgencyDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  if (user?.role !== 'agency') return null;
  if (loading) return <div className="loading">Yükleniyor...</div>;

  const clients = data?.clients || [];
  const filtered = search.trim()
    ? clients.filter(c => c.brand.company_name.toLowerCase().includes(search.toLowerCase()))
    : clients;
  const sorted = [...filtered].sort((a, b) => b.anomalies.length - a.anomalies.length);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Markalar</div>
        <div className="topbar-right" style={{ fontSize: 13, color: 'var(--text3)' }}>
          {clients.length} bağlı marka
        </div>
      </div>
      <div className="content">
        {clients.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 56 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🤝</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Henüz bağlı marka yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Markalar sizi ajans olarak davet ettiğinde burada görünürler.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <input
                className="sinput"
                placeholder="Marka ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ maxWidth: 320 }}
              />
            </div>

            {sorted.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
                Arama sonucu bulunamadı.
              </div>
            ) : (
              <div className="card">
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
                      const ss = STATUS_STYLE[statusOf(client.anomalies.length)];
                      return (
                        <tr
                          key={client.brand.id}
                          onClick={() => onSelectBrand?.(client.brand)}
                          style={{ cursor: 'pointer' }}
                          className="hover-row"
                        >
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
          </>
        )}
      </div>
    </div>
  );
}
