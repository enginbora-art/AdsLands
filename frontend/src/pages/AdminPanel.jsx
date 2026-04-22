import { useState, useEffect } from 'react';
import { adminGetBrands, adminGetAgencies, adminCreateBrand, adminCreateAgency, adminToggleActive } from '../api';

const emptyForm = { email: '', company_name: '' };

export default function AdminPanel({ onLogout, user }) {
  const [tab, setTab] = useState('brands');
  const [brands, setBrands] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [b, a] = await Promise.all([adminGetBrands(), adminGetAgencies()]);
      setBrands(b);
      setAgencies(a);
    } catch {
      setError('Veriler yüklenemedi.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (tab === 'brands') {
        const newBrand = await adminCreateBrand(form);
        setBrands(prev => [newBrand, ...prev]);
      } else {
        const newAgency = await adminCreateAgency(form);
        setAgencies(prev => [newAgency, ...prev]);
      }
      setForm(emptyForm);
      setShowForm(false);
      setSuccess(`${tab === 'brands' ? 'Marka' : 'Ajans'} başarıyla oluşturuldu.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Oluşturma başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const updated = await adminToggleActive(id);
      if (tab === 'brands') {
        setBrands(prev => prev.map(b => b.id === id ? { ...b, is_active: updated.is_active } : b));
      } else {
        setAgencies(prev => prev.map(a => a.id === id ? { ...a, is_active: updated.is_active } : a));
      }
    } catch {
      setError('Durum güncellenemedi.');
    }
  };

  const list = tab === 'brands' ? brands : agencies;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <svg width="28" height="28" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
            <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
          </svg>
          <span style={s.logoText}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
          <span style={s.adminBadge}>ADMIN</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.adminEmail}>{user?.email}</span>
          <button onClick={onLogout} style={s.logoutBtn}>Çıkış Yap</button>
        </div>
      </header>

      <div style={s.content}>
        <div style={s.titleRow}>
          <h1 style={s.title}>Yönetim Paneli</h1>
          <button style={s.addBtn} onClick={() => { setShowForm(!showForm); setError(''); setForm(emptyForm); }}>
            {showForm ? '✕ İptal' : `+ Yeni ${tab === 'brands' ? 'Marka' : 'Ajans'}`}
          </button>
        </div>

        {success && <div style={s.successBox}>{success}</div>}
        {error && <div style={s.errorBox}>{error}</div>}

        {showForm && (
          <div style={s.formCard}>
            <h3 style={s.formTitle}>Yeni {tab === 'brands' ? 'Marka' : 'Ajans'} Ekle</h3>
            <form onSubmit={handleCreate} style={s.formGrid}>
              <div style={s.field}>
                <label style={s.label}>Şirket Adı</label>
                <input
                  className="sinput"
                  placeholder="TechModa A.Ş."
                  value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>E-posta</label>
                <input
                  className="sinput"
                  type="email"
                  placeholder="info@sirket.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" style={s.submitBtn} disabled={loading}>
                  {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === 'brands' ? s.tabActive : {}) }}
            onClick={() => { setTab('brands'); setShowForm(false); }}
          >
            Markalar <span style={s.count}>{brands.length}</span>
          </button>
          <button
            style={{ ...s.tab, ...(tab === 'agencies' ? s.tabActive : {}) }}
            onClick={() => { setTab('agencies'); setShowForm(false); }}
          >
            Ajanslar <span style={s.count}>{agencies.length}</span>
          </button>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Şirket</th>
                <th style={s.th}>E-posta</th>
                <th style={s.th}>Kayıt Tarihi</th>
                <th style={s.th}>Durum</th>
                <th style={s.th}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...s.td, textAlign: 'center', color: 'var(--text3)', padding: '32px 0' }}>
                    Henüz kayıt yok.
                  </td>
                </tr>
              ) : list.map(u => (
                <tr key={u.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.avatar}>{u.company_name.slice(0, 2).toUpperCase()}</div>
                    <span style={{ fontWeight: 600 }}>{u.company_name}</span>
                  </td>
                  <td style={{ ...s.td, color: 'var(--text3)' }}>{u.email}</td>
                  <td style={{ ...s.td, color: 'var(--text3)' }}>
                    {new Date(u.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...(u.is_active ? s.badgeActive : s.badgePassive) }}>
                      {u.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <button
                      style={{ ...s.toggleBtn, ...(u.is_active ? s.toggleBtnDeactivate : s.toggleBtnActivate) }}
                      onClick={() => handleToggle(u.id)}
                    >
                      {u.is_active ? 'Pasife Al' : 'Aktife Al'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 64, background: 'var(--bg2)', borderBottom: '1px solid var(--border2)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  logoText: { fontSize: 18, fontWeight: 700 },
  adminBadge: { fontSize: 10, fontWeight: 700, background: 'var(--teal)', color: 'var(--bg)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' },
  adminEmail: { fontSize: 13, color: 'var(--text3)' },
  logoutBtn: { padding: '6px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  content: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700 },
  addBtn: { padding: '8px 20px', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  successBox: { background: 'rgba(0,191,166,0.12)', color: '#00BFA6', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16 },
  errorBox: { background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16 },
  formCard: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 24, marginBottom: 24 },
  formTitle: { fontSize: 15, fontWeight: 700, marginBottom: 18 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'start' },
  field: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  submitBtn: { padding: '10px 24px', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg2)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border2)' },
  tab: { padding: '8px 20px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 },
  tabActive: { background: 'var(--teal)', color: 'var(--bg)' },
  count: { background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '1px 7px', fontSize: 11 },
  tableWrap: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', borderBottom: '1px solid var(--border2)', fontWeight: 600 },
  tr: { borderBottom: '1px solid var(--border2)' },
  td: { padding: '14px 16px', fontSize: 14, display: 'revert', verticalAlign: 'middle' },
  avatar: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--teal)', color: 'var(--bg)', fontSize: 11, fontWeight: 700, marginRight: 10 },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 },
  badgeActive: { background: 'rgba(0,191,166,0.15)', color: '#00BFA6' },
  badgePassive: { background: 'rgba(255,107,90,0.15)', color: 'var(--coral)' },
  toggleBtn: { padding: '5px 14px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  toggleBtnDeactivate: { background: 'rgba(255,107,90,0.12)', color: 'var(--coral)' },
  toggleBtnActivate: { background: 'rgba(0,191,166,0.12)', color: '#00BFA6' },
};
