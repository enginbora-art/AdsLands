import { useState } from 'react';
import { login } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login({ onSwitch }) {
  const { saveAuth } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await login(form);
      saveAuth(token, user);
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş başarısız.');
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
          <span style={styles.logoText}>Ads<span style={{ color: '#00BFA6' }}>Lens</span></span>
        </div>

        <h2 style={styles.title}>Giriş Yap</h2>
        <p style={styles.sub}>Hesabınıza erişin</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>E-posta</label>
            <input
              className="sinput"
              type="email"
              placeholder="ornek@sirket.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Şifre</label>
            <input
              className="sinput"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p style={styles.switchText}>
          Hesabınız yok mu?{' '}
          <span style={styles.link} onClick={onSwitch}>Kayıt olun</span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoText: { fontSize: 20, fontWeight: 700 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: 13, color: 'var(--text3)', marginBottom: 28 },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  btn: { width: '100%', padding: '11px 0', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  error: { background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  switchText: { textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text3)' },
  link: { color: 'var(--teal)', cursor: 'pointer', fontWeight: 600 },
};
