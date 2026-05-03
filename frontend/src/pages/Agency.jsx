import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import SubscriptionBanner from '../components/SubscriptionBanner';
import SubscriptionGateModal from '../components/SubscriptionGateModal';
import {
  getAgencyDashboard, inviteBrand,
  getInvitations, getSentInvitations, acceptInvitation, rejectInvitation, sendInvitation,
  getConnectableCompanies,
} from '../api';

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtDate = (d) => new Date(d).toLocaleDateString('tr-TR');

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

// ── Davet modal ───────────────────────────────────────────────────────────────
function InviteModal({ onClose, onSuccess }) {
  const [tab, setTab] = useState('email');
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ company_name: '', email: '' });
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getConnectableCompanies().then(setCompanies).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (tab === 'registered') {
        if (!selectedId) return setError('Bir marka seçin.');
        await sendInvitation({ receiver_company_id: selectedId });
      } else {
        if (!form.company_name.trim() || !form.email.trim()) return setError('Tüm alanlar zorunludur.');
        await inviteBrand(form);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Davet gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Marka Davet Et</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[['registered', 'Kayıtlı Marka'], ['email', 'E-posta ile Davet']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tab === id ? 'var(--teal)' : 'var(--bg)', color: tab === id ? '#0B1219' : 'var(--text3)', fontFamily: 'var(--font)' }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'registered' ? (
            <div style={{ marginBottom: 20 }}>
              {companies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>
                  Bağlanılabilecek kayıtlı marka bulunamadı.
                </div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border2)', borderRadius: 8 }}>
                  {companies.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border2)', background: selectedId === c.id ? 'rgba(0,191,166,0.08)' : 'transparent' }}>
                      <input type="radio" name="company" value={c.id} checked={selectedId === c.id}
                        onChange={() => setSelectedId(c.id)} style={{ accentColor: '#00BFA6' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>Şirket / Marka Adı</label>
                <input className="sinput" placeholder="Şirket adı"
                  value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>E-posta Adresi</label>
                <input className="sinput" type="email" placeholder="marka@sirket.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </>
          )}

          {error && (
            <div style={{ background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16, border: '1px solid rgba(255,107,90,0.2)' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              İptal
            </button>
            <button type="submit" disabled={submitting}
              style={{ flex: 1, padding: '10px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'var(--font)' }}>
              {submitting ? 'Gönderiliyor...' : 'Davet Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tab: Markalar listesi ─────────────────────────────────────────────────────
function BrandsTab({ clients, loading, onSelectBrand, onInvite }) {
  const [search, setSearch] = useState('');

  if (loading) return <div className="loading">Yükleniyor...</div>;

  const brandName = (c) => c.brand?.name || c.brand?.company_name || '';
  const filtered = search.trim()
    ? clients.filter(c => brandName(c).toLowerCase().includes(search.toLowerCase()))
    : clients;
  const sorted = [...filtered].sort((a, b) => b.anomalies.length - a.anomalies.length);

  if (clients.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 56 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Henüz bağlı marka yok</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
          Markaları platforma davet ederek çalışmaya başlayın.
        </div>
        <button onClick={onInvite}
          style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219' }}>
          + Marka Davet Et
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <input className="sinput" placeholder="Marka ara..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
      </div>
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
          Arama sonucu bulunamadı.
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="cmp-table">
            <colgroup>
              <col style={{ width: '30%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Marka</th>
                <th className="col-num">30g Harcama</th>
                <th className="col-num">ROAS</th>
                <th className="col-num">Ay Bütçesi</th>
                <th className="col-center">Anomali</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(client => {
                const ss = STATUS_STYLE[statusOf(client.anomalies.length)];
                const name = brandName(client);
                return (
                  <tr key={client.brand.id} onClick={() => onSelectBrand?.(client.brand)}
                    style={{ cursor: 'pointer' }} className="hover-row">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,191,166,0.15)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {avatar(name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{client.integrations.length} platform</div>
                        </div>
                      </div>
                    </td>
                    <td className="col-num">₺{fmt(client.summary.total_spend)}</td>
                    <td className="col-num" style={{ color: client.summary.avg_roas >= 3 ? 'var(--success)' : 'var(--text2)', fontWeight: 600 }}>
                      {Number(client.summary.avg_roas).toFixed(2)}x
                    </td>
                    <td className="col-num" style={{ color: client.monthly_budget > 0 ? 'var(--text1)' : 'var(--text3)' }}>
                      {client.monthly_budget > 0 ? `₺${fmt(client.monthly_budget)}` : '—'}
                    </td>
                    <td className="col-center">
                      {client.anomalies.length > 0
                        ? <span style={{ background: 'rgba(255,107,90,0.15)', color: 'var(--coral)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{client.anomalies.length}</span>
                        : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>
                      <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>{ss.label}</span>
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 16, textAlign: 'right' }}>›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Tab: Gelen istekler ───────────────────────────────────────────────────────
function IncomingTab({ items, onRefresh, onSuccess }) {
  const handleAccept = async (id) => {
    try { await acceptInvitation(id); onRefresh(); onSuccess('Bağlantı isteği kabul edildi.'); }
    catch (err) { alert(err.response?.data?.error || 'Hata.'); }
  };
  const handleReject = async (id) => {
    try { await rejectInvitation(id); onRefresh(); onSuccess('Bağlantı isteği reddedildi.'); }
    catch (err) { alert(err.response?.data?.error || 'Hata.'); }
  };

  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 }}>
        Bekleyen gelen istek yok.
      </div>
    );
  }

  return (
    <div>
      {items.map(inv => (
        <div key={inv.id} className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{inv.sender_company_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtDate(inv.created_at)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleReject(inv.id)}
              style={{ padding: '6px 14px', border: '1px solid var(--border2)', borderRadius: 7, background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Reddet
            </button>
            <button onClick={() => handleAccept(inv.id)}
              style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: 'var(--teal)', color: '#0B1219', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Kabul Et
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Gönderilen ───────────────────────────────────────────────────────────
function SentTab({ items }) {
  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 }}>
        Gönderilen istek yok.
      </div>
    );
  }

  return (
    <div className="card table-wrap">
      <table className="cmp-table">
        <thead><tr><th>Alıcı</th><th>Durum</th><th>Tarih</th></tr></thead>
        <tbody>
          {items.map(inv => (
            <tr key={inv.id}>
              <td style={{ fontSize: 13 }}>{inv.receiver_company_name || inv.receiver_email}</td>
              <td>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: inv.status === 'accepted' ? 'rgba(52,211,153,0.12)' : inv.status === 'rejected' ? 'rgba(255,107,90,0.12)' : 'rgba(255,181,71,0.12)',
                  color: inv.status === 'accepted' ? 'var(--success)' : inv.status === 'rejected' ? 'var(--coral)' : 'var(--amber)' }}>
                  {inv.status === 'accepted' ? 'Kabul edildi' : inv.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                </span>
              </td>
              <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmtDate(inv.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Ana component ─────────────────────────────────────────────────────────────
export default function Agency({ onSelectBrand, onNav }) {
  const { user } = useAuth();
  const { isActive } = useSubscription();
  const [tab, setTab] = useState('brands');
  const [clients, setClients] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [connLoading, setConnLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [gateModal, setGateModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };

  const loadBrands = useCallback(() => {
    setBrandsLoading(true);
    getAgencyDashboard()
      .then(d => setClients(d?.clients || []))
      .catch(() => setClients([]))
      .finally(() => setBrandsLoading(false));
  }, []);

  const loadConnections = useCallback(() => {
    setConnLoading(true);
    Promise.all([getInvitations(), getSentInvitations()])
      .then(([i, s]) => { setIncoming(i); setSent(s); })
      .catch(() => {})
      .finally(() => setConnLoading(false));
  }, []);

  useEffect(() => {
    if (user?.company_type !== 'agency') return;
    loadBrands();
    loadConnections();
  }, [user?.company_type]);

  if (user?.company_type !== 'agency') return null;

  const pendingCount = incoming.length;

  const TABS = [
    { id: 'brands',   label: `Markalar${clients.length > 0 ? ` (${clients.length})` : ''}` },
    { id: 'incoming', label: `Gelen İstekler${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { id: 'sent',     label: 'Gönderilen' },
  ];

  return (
    <div className="fade-in">
      {gateModal && <SubscriptionGateModal onClose={() => setGateModal(false)} onNav={onNav} />}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            showSuccess('Davet gönderildi! Marka hesabını oluştururken otomatik olarak sizinle bağlanacak.');
            loadBrands();
            loadConnections();
          }}
        />
      )}

      <div className="topbar">
        <div className="topbar-title">Markalar</div>
        <div className="topbar-right">
          <button onClick={() => { if (!isActive) { setGateModal(true); return; } setShowInvite(true); }}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219' }}>
            + Marka Davet Et
          </button>
        </div>
      </div>

      <div className="content">
        <SubscriptionBanner onNav={onNav} />
        {successMsg && (
          <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 16 }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 20px', background: 'none', border: 'none', fontFamily: 'var(--font)',
                borderBottom: tab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
                color: tab === t.id ? 'var(--teal)' : 'var(--text3)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'brands' && (
          <BrandsTab
            clients={clients}
            loading={brandsLoading}
            onSelectBrand={onSelectBrand}
            onInvite={() => { if (!isActive) { setGateModal(true); return; } setShowInvite(true); }}
          />
        )}
        {tab === 'incoming' && !connLoading && (
          <IncomingTab items={incoming} onRefresh={loadConnections} onSuccess={showSuccess} />
        )}
        {tab === 'sent' && !connLoading && (
          <SentTab items={sent} />
        )}
        {(tab === 'incoming' || tab === 'sent') && connLoading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
        )}
      </div>
    </div>
  );
}
