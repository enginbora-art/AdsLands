import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getInvitations, getSentInvitations, getConnectableCompanies, getConnections,
  sendInvitation, acceptInvitation, rejectInvitation,
} from '../api';

function fmt(d) { return new Date(d).toLocaleDateString('tr-TR'); }

function SendModal({ onClose, onSuccess }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('registered');
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ receiver_email: '', company_name: '' });
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getConnectableCompanies().then(setCompanies).catch(console.error);
  }, []);

  const targetLabel = user?.company_type === 'agency' ? 'Marka' : 'Ajans';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (tab === 'registered') {
        if (!selectedId) return setError('Bir şirket seçin.');
        await sendInvitation({ receiver_company_id: selectedId });
      } else {
        await sendInvitation({ receiver_email: form.receiver_email, company_name: form.company_name });
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{targetLabel} Bağlantı İsteği</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {['registered', 'email'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--teal)' : 'var(--bg)', color: tab === t ? '#0B1219' : 'var(--text3)' }}>
              {t === 'registered' ? `Kayıtlı ${targetLabel}` : 'E-posta ile Davet'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'registered' ? (
            <div style={{ marginBottom: 20 }}>
              {companies.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>
                  Bağlanılabilecek {targetLabel.toLowerCase()} bulunamadı.
                </div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border2)', borderRadius: 8 }}>
                  {companies.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border2)',
                      background: selectedId === c.id ? 'rgba(0,191,166,0.08)' : 'transparent' }}>
                      <input type="radio" name="company" value={c.id} checked={selectedId === c.id}
                        onChange={() => setSelectedId(c.id)} style={{ accentColor: '#00BFA6' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  {targetLabel} Adı
                </label>
                <input className="sinput" placeholder={`${targetLabel} adı`}
                  value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>E-posta</label>
                <input className="sinput" type="email" placeholder="admin@sirket.com"
                  value={form.receiver_email} onChange={e => setForm(f => ({ ...f, receiver_email: e.target.value }))} required />
              </div>
            </>
          )}
          {error && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>İptal</button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '9px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Gönderiliyor...' : 'İstek Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Connections() {
  const [tab, setTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [showSend, setShowSend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, i, s] = await Promise.all([getConnections(), getInvitations(), getSentInvitations()]);
      setConnections(c); setIncoming(i); setSent(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const handleAccept = async (id) => {
    try { await acceptInvitation(id); load(); showSuccess('Bağlantı isteği kabul edildi.'); } catch (err) { alert(err.response?.data?.error || 'Hata.'); }
  };
  const handleReject = async (id) => {
    try { await rejectInvitation(id); load(); showSuccess('Bağlantı isteği reddedildi.'); } catch (err) { alert(err.response?.data?.error || 'Hata.'); }
  };

  const pendingCount = incoming.length;

  return (
    <div className="fade-in">
      {showSend && (
        <SendModal
          onClose={() => setShowSend(false)}
          onSuccess={() => { setShowSend(false); showSuccess('İstek gönderildi.'); load(); }}
        />
      )}

      <div className="topbar">
        <div className="topbar-title">Bağlantılar</div>
        <div className="topbar-right">
          <button onClick={() => setShowSend(true)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219' }}>
            + Bağlantı İsteği Gönder
          </button>
        </div>
      </div>

      <div className="content">
        {successMsg && (
          <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 16 }}>
            ✓ {successMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border2)' }}>
          {[
            { id: 'connections', label: 'Bağlantılar' },
            { id: 'incoming', label: `Gelen İstekler${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
            { id: 'sent', label: 'Gönderilen' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 18px', background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
                color: tab === t.id ? 'var(--teal)' : 'var(--text3)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
        ) : tab === 'connections' ? (
          <div className="card table-wrap">
            {connections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 }}>
                Henüz bağlantı yok. Bağlantı isteği göndererek başlayın.
              </div>
            ) : (
              <table className="cmp-table">
                <thead><tr><th>Şirket</th><th>Bağlantı Tarihi</th></tr></thead>
                <tbody>
                  {connections.map(c => (
                    <tr key={c.partner_id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{c.partner_name}</td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : tab === 'incoming' ? (
          <div>
            {incoming.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 }}>
                Bekleyen gelen istek yok.
              </div>
            ) : incoming.map(inv => (
              <div key={inv.id} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{inv.sender_company_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(inv.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleReject(inv.id)}
                    style={{ padding: '6px 14px', border: '1px solid var(--border2)', borderRadius: 7, background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>
                    Reddet
                  </button>
                  <button onClick={() => handleAccept(inv.id)}
                    style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: 'var(--teal)', color: '#0B1219', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Kabul Et
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card table-wrap">
            {sent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 }}>Gönderilen istek yok.</div>
            ) : (
              <table className="cmp-table">
                <thead><tr><th>Alıcı</th><th>Durum</th><th>Tarih</th></tr></thead>
                <tbody>
                  {sent.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontSize: 13 }}>{inv.receiver_company_name || inv.receiver_email}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: inv.status === 'accepted' ? 'rgba(52,211,153,0.12)' : inv.status === 'rejected' ? 'rgba(255,107,90,0.12)' : 'rgba(255,181,71,0.12)',
                          color: inv.status === 'accepted' ? 'var(--success)' : inv.status === 'rejected' ? 'var(--coral)' : 'var(--amber)' }}>
                          {inv.status === 'accepted' ? 'Kabul edildi' : inv.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(inv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
