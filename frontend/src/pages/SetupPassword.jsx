import { useState, useEffect } from 'react';
import { getSetup, completeSetup } from '../api';
import { useAuth } from '../context/AuthContext';

export default function SetupPassword({ token, onDone }) {
  const { saveAuth } = useAuth();
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getSetup(token)
      .then(setInfo)
      .catch(err => setError(err.response?.data?.error || 'Geçersiz bağlantı.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Şifreler eşleşmiyor.');
    if (form.password.length < 6) return setError('Şifre en az 6 karakter olmalıdır.');
    setError('');
    setSubmitting(true);
    try {
      const companyName = new URLSearchParams(window.location.search).get('company_name') || '';
      const { token: jwt } = await completeSetup({ token, password: form.password, company_name: companyName });
      // JWT'den kullanıcı bilgilerini decode et
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      saveAuth(jwt, {
        id: payload.user_id,
        company_id: payload.company_id,
        company_name: payload.company_name,
        company_type: payload.company_type,
        is_company_admin: payload.is_company_admin,
        is_platform_admin: payload.is_platform_admin,
        permissions: payload.permissions,
      });
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ color: 'var(--text3)' }}>Yükleniyor...</div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.logo}>
            <svg width="28" height="28" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
              <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
            </svg>
            <span style={s.logoText}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--coral)', fontWeight: 600, marginTop: 8 }}>{error}</div>
        </div>
      </div>
    );
  }

  const roleLabel = info?.role === 'brand' ? 'Marka' : 'Ajans';

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <svg width="28" height="28" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
            <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
          </svg>
          <span style={s.logoText}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
        </div>

        <div style={s.infoBanner}>
          <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {roleLabel} Hesabı
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{info?.company_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{info?.email}</div>
        </div>

        <h2 style={s.title}>Şifrenizi belirleyin</h2>
        <p style={s.sub}>Hesabınıza erişmek için bir şifre oluşturun.</p>

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Şifre</label>
            <input
              className="sinput"
              type="password"
              placeholder="En az 6 karakter"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Şifre Tekrar</label>
            <input
              className="sinput"
              type="password"
              placeholder="Şifrenizi tekrar girin"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" style={s.btn} disabled={submitting}>
            {submitting ? 'Kaydediliyor...' : 'Şifremi Belirle & Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 440 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoText: { fontSize: 18, fontWeight: 700 },
  infoBanner: { background: 'var(--teal-dim)', border: '1px solid var(--teal-mid)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: 13, color: 'var(--text3)', marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  btn: { width: '100%', padding: '11px 0', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  error: { background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
};
