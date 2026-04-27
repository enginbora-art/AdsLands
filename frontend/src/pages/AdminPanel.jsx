import { useState, useEffect } from 'react';
import { adminGetCompanies, adminCreateCompany, adminUpdateCompany, adminToggleUser } from '../api';

const fmt = (d) => new Date(d).toLocaleDateString('tr-TR');

const SECTORS = [
  'E-ticaret', 'Perakende', 'Finans & Sigorta', 'Otomotiv',
  'Gıda & İçecek', 'Turizm & Seyahat', 'Teknoloji & SaaS',
  'Sağlık & Güzellik', 'Eğitim', 'Gayrimenkul', 'Medya & Eğlence', 'Diğer',
];

const inp = {
  padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border2)',
  borderRadius: 8, color: 'var(--text1)', fontSize: 14, width: '100%', boxSizing: 'border-box',
};
const fieldLabel = {
  display: 'block', fontSize: 11, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600,
};

function CreateModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', type: 'brand', sector: '', admin_email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sector) { setError('Sektör seçimi zorunludur.'); return; }
    setLoading(true);
    setError('');
    try {
      await adminCreateCompany(form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Yeni Şirket Oluştur</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Şirket Adı</label>
            <input style={inp} placeholder="Şirket / Marka adı"
              value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Şirket Tipi</label>
            <select style={inp} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="brand">Marka</option>
              <option value="agency">Ajans</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Sektör <span style={{ color: 'var(--coral)' }}>*</span></label>
            <select style={inp} value={form.sector} onChange={e => set('sector', e.target.value)}>
              <option value="">— Seçiniz —</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={fieldLabel}>Admin E-posta</label>
            <input style={inp} type="email" placeholder="admin@sirket.com"
              value={form.admin_email} onChange={e => set('admin_email', e.target.value)} required />
          </div>
          {error && (
            <div style={{ background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '10px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Oluşturuluyor...' : 'Oluştur & Mail Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectorCell({ company, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [sector, setSector] = useState(company.sector || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdateCompany(company.id, { sector });
      await onUpdate();
      setEditing(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <select value={sector} onChange={e => setSector(e.target.value)}
          style={{ ...inp, padding: '4px 8px', fontSize: 12, width: 'auto' }}>
          <option value="">—</option>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={save} disabled={saving}
          style={{ padding: '3px 8px', background: 'var(--teal)', border: 'none', borderRadius: 5, color: '#0B1219', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          ✓
        </button>
        <button onClick={() => { setEditing(false); setSector(company.sector || ''); }}
          style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
          ✕
        </button>
      </span>
    );
  }

  return (
    <span onClick={() => setEditing(true)}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: sector ? 'var(--text2)' : 'var(--text3)', fontSize: 12 }}>
      {sector || '— ekle'}
      <span style={{ opacity: 0.5, fontSize: 11 }}>✎</span>
    </span>
  );
}

export default function AdminPanel({ onLogout }) {
  const [companies, setCompanies] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    return adminGetCompanies()
      .then(setCompanies)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? companies : companies.filter(c => c.type === filter);

  const handleToggleUser = async (userId) => {
    try {
      await adminToggleUser(userId);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Hata oluştu.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text1)' }}>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            setSuccessMsg('Şirket oluşturuldu ve setup maili gönderildi.');
            setTimeout(() => setSuccessMsg(''), 5000);
            load();
          }}
        />
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <svg width="28" height="28" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
                <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
              </svg>
              <span style={{ fontSize: 20, fontWeight: 700 }}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Yönetimi</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '8px 18px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Şirket Ekle
            </button>
            <button onClick={onLogout}
              style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
              Çıkış
            </button>
          </div>
        </div>

        {successMsg && (
          <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 20 }}>
            ✓ {successMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['all', 'agency', 'brand'].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === t ? 'var(--teal)' : 'var(--bg2)', color: filter === t ? '#0B1219' : 'var(--text3)' }}>
              {t === 'all' ? 'Tümü' : t === 'agency' ? 'Ajans' : 'Marka'} ({t === 'all' ? companies.length : companies.filter(c => c.type === t).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
        ) : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12 }}>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Şirket</th>
                  <th>Tip</th>
                  <th>Sektör</th>
                  <th>Kullanıcı</th>
                  <th>Oluşturulma</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Şirket bulunamadı.</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <span style={{ background: c.type === 'agency' ? 'rgba(167,139,250,0.15)' : 'rgba(0,191,166,0.12)', color: c.type === 'agency' ? '#A78BFA' : 'var(--teal)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                        {c.type === 'agency' ? 'Ajans' : 'Marka'}
                      </span>
                    </td>
                    <td><SectorCell company={c} onUpdate={load} /></td>
                    <td style={{ color: 'var(--text2)' }}>{c.user_count}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
