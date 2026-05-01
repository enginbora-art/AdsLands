import { useState } from 'react';
import { resetPassword } from '../api';

export default function ResetPassword({ token, onDone }) {
  const [form, setForm]       = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Logo />
          <div style={styles.errorBox}>Bu link geçersiz veya süresi dolmuş.</div>
          <div style={styles.backRow}><span style={styles.link} onClick={onDone}>Giriş sayfasına dön</span></div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Şifreler eşleşmiyor.');
    }
    if (form.password.length < 8 || !/\d/.test(form.password)) {
      return setError('Şifre en az 8 karakter olmalı ve en az 1 rakam içermelidir.');
    }
    setLoading(true);
    try {
      await resetPassword(token, form.password);
      setDone(true);
      setTimeout(onDone, 2000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Bir hata oluştu.';
      if (msg.includes('Geçersiz') || msg.includes('süresi')) {
        setError('Bu link geçersiz veya süresi dolmuş.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Logo />
        <h2 style={styles.title}>Yeni Şifre Belirle</h2>

        {done ? (
          <div style={styles.success}>
            Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={styles.field}>
              <label style={styles.label}>Yeni Şifre</label>
              <input
                className="sinput"
                type="password"
                placeholder="En az 8 karakter, 1 rakam"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Yeni Şifre Tekrar</label>
              <input
                className="sinput"
                type="password"
                placeholder="Şifrenizi tekrar girin"
                value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
            {error && <div style={styles.errorBox}>{error}</div>}
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Kaydediliyor...' : 'Şifremi Güncelle'}
            </button>
          </form>
        )}

        <div style={styles.backRow}>
          <span style={styles.link} onClick={onDone}>← Giriş sayfasına dön</span>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
        <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
      </svg>
      <span style={{ fontSize: 20, fontWeight: 700 }}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
    </div>
  );
}

const styles = {
  page:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card:     { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 },
  title:    { fontSize: 22, fontWeight: 700, marginBottom: 28 },
  field:    { marginBottom: 18 },
  label:    { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  btn:      { width: '100%', padding: '11px 0', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  errorBox: { background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  success:  { background: 'rgba(0,191,166,0.12)', color: 'var(--teal)', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 600 },
  backRow:  { marginTop: 24, textAlign: 'center' },
  link:     { color: 'var(--teal)', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
