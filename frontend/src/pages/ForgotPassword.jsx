import { useState } from 'react';
import { forgotPassword } from '../api';

export default function ForgotPassword({ onBack }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Bir hata oluştu, lütfen tekrar deneyin.');
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

        <h2 style={styles.title}>Şifremi Unuttum</h2>

        {sent ? (
          <>
            <div style={styles.success}>
              E-postanızı kontrol edin. Sıfırlama bağlantısı gönderildi.
            </div>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>
              E-posta birkaç dakika içinde gelmezse spam klasörünü kontrol edin.
            </p>
          </>
        ) : (
          <>
            <p style={styles.sub}>
              Kayıtlı e-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
            </p>
            <form onSubmit={handleSubmit}>
              <div style={styles.field}>
                <label style={styles.label}>E-posta</label>
                <input
                  className="sinput"
                  type="email"
                  placeholder="ornek@sirket.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {error && <div style={styles.error}>{error}</div>}
              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
              </button>
            </form>
          </>
        )}

        <div style={styles.backRow}>
          <span style={styles.link} onClick={onBack}>← Giriş sayfasına dön</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card:    { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 },
  logo:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoText:{ fontSize: 20, fontWeight: 700 },
  title:   { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  sub:     { fontSize: 13, color: 'var(--text3)', marginBottom: 28, lineHeight: 1.6 },
  field:   { marginBottom: 18 },
  label:   { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  btn:     { width: '100%', padding: '11px 0', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  error:   { background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  success: { background: 'rgba(0,191,166,0.12)', color: 'var(--teal)', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 600 },
  backRow: { marginTop: 24, textAlign: 'center' },
  link:    { color: 'var(--teal)', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
