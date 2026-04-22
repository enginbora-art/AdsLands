import { useState } from 'react';
import { register } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register({ onSwitch }) {
  const { saveAuth } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', company_name: '', role: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.role) return setError('Lütfen hesap tipini seçin.');
    setLoading(true);
    try {
      const { token, user } = await register(form);
      saveAuth(token, user);
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
            <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
          </svg>
          <span style={styles.logoText}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
        </div>

        <h2 style={styles.title}>Hesap Oluştur</h2>
        <p style={styles.sub}>AdsLands'e ücretsiz katılın</p>

        <div style={styles.typeRow}>
          {[
            { value: 'brand', label: 'Marka', icon: '🏢', desc: 'Kendi reklamlarınızı yönetin' },
            { value: 'agency', label: 'Ajans', icon: '📊', desc: 'Müşteri hesaplarını yönetin' },
          ].map(t => (
            <div
              key={t.value}
              style={{ ...styles.typeCard, ...(form.role === t.value ? styles.typeCardActive : {}) }}
              onClick={() => setForm({ ...form, role: t.value })}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.desc}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Şirket / Marka Adı</label>
            <input className="sinput" placeholder="TechModa A.Ş." value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>E-posta</label>
            <input className="sinput" type="email" placeholder="ornek@sirket.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Şifre</label>
            <input className="sinput" type="password" placeholder="En az 6 karakter" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Kayıt oluşturuluyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <p style={styles.switchText}>
          Zaten hesabınız var mı?{' '}
          <span style={styles.link} onClick={onSwitch}>Giriş yapın</span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 460 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoText: { fontSize: 20, fontWeight: 700 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: 13, color: 'var(--text3)', marginBottom: 24 },
  typeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 },
  typeCard: { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
  typeCardActive: { borderColor: 'var(--teal)', background: 'var(--teal-dim)' },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  btn: { width: '100%', padding: '11px 0', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  error: { background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  switchText: { textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text3)' },
  link: { color: 'var(--teal)', cursor: 'pointer', fontWeight: 600 },
};
