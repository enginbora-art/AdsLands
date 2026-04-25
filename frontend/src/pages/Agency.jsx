import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAgencyDashboard, inviteBrand } from '../api';

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

function InviteModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ company_name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.email.trim()) return setError('Tüm alanlar zorunludur.');
    setSubmitting(true);
    setError('');
    try {
      await inviteBrand(form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Davet gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Marka Davet Et</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>Şirket / Marka Adı</label>
            <input className="sinput" placeholder="Şirket adı"
              value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>E-posta Adresi</label>
            <input className="sinput" type="email" placeholder="marka@sirket.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          {error && (
            <div style={{ background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16, border: '1px solid rgba(255,107,90,0.2)' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" disabled={submitting}
              style={{ flex: 1, padding: '10px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Gönderiliyor...' : 'Davet Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Agency({ onSelectBrand }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user?.company_type !== 'agency') return;
    getAgencyDashboard()
      .then(setData)
      .catch(() => setData({ clients: [] }))
      .finally(() => setLoading(false));
  }, [user]);

  if (user?.company_type !== 'agency') return null;
  if (loading) return <div className="loading">Yükleniyor...</div>;

  const clients = data?.clients || [];
  // brand.name (yeni şema: companies.name) veya eski company_name'e fallback
  const brandName = (c) => c.brand?.name || c.brand?.company_name || '';
  const filtered = search.trim()
    ? clients.filter(c => brandName(c).toLowerCase().includes(search.toLowerCase()))
    : clients;
  const sorted = [...filtered].sort((a, b) => b.anomalies.length - a.anomalies.length);

  return (
    <div className="fade-in">
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            setSuccessMsg('Davet gönderildi! Marka hesabını oluştururken otomatik olarak sizinle bağlanacak.');
            setTimeout(() => setSuccessMsg(''), 6000);
          }}
        />
      )}
      <div className="topbar">
        <div className="topbar-title">Markalar</div>
        <div className="topbar-right">
          <span style={{ fontSize: 13, color: 'var(--text3)', marginRight: 16 }}>{clients.length} bağlı marka</span>
          <button
            onClick={() => setShowInvite(true)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219' }}>
            + Marka Davet Et
          </button>
        </div>
      </div>
      <div className="content">
        {successMsg && (
          <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 16 }}>
            ✓ {successMsg}
          </div>
        )}
        {clients.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 56 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Henüz bağlı marka yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
              Markaları platforma davet ederek çalışmaya başlayın.
            </div>
            <button
              onClick={() => setShowInvite(true)}
              style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219' }}>
              + Marka Davet Et
            </button>
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
                                {avatar(brandName(client))}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{brandName(client)}</div>
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
