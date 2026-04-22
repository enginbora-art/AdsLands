import { useEffect, useState } from 'react';
import { getInvitation, acceptInvitation } from '../api';
import { useAuth } from '../context/AuthContext';

export default function InviteAccept({ token, onDone }) {
  const { saveAuth } = useAuth();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ password: '', company_name: '', role: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getInvitation(token)
      .then(setInvite)
      .catch(err => setError(err.response?.data?.error || 'Davet bulunamadı.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.role) return setError('Lütfen hesap tipini seçin.');
    setSubmitting(true);
    try {
      const { token: jwt, user } = await acceptInvitation({ token, ...form });
      saveAuth(jwt, user);
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Hesap oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={styles.page}><div style={{ color: 'var(--text3)' }}>Davet yükleniyor...</div></div>;

  if (error && !invite) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>⚠️</div>
        <div style={{ textAlign: 'center', color: 'var(--coral)', fontWeight: 600 }}>{error}</div>
      </div>
    </div>
  );

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

        <div style={styles.inviteBanner}>
          <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Davet</div>
          <div style={{ fontSize: 14 }}>
            <strong>{invite.sender_company}</strong>{' '}
            <span style={{ color: 'var(--text3)' }}>({invite.sender_role === 'brand' ? 'Marka' : 'Ajans'})</span>{' '}
            sizi AdsLands'e davet etti.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{invite.receiver_email}</div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Hesabınızı oluşturun</h2>

        <div style={styles.typeRow}>
          {[
            { value: 'brand', label: 'Marka', icon: '🏢' },
            { value: 'agency', label: 'Ajans', icon: '📊' },
          ].map(t => (
            <div
              key={t.value}
              style={{ ...styles.typeCard, ...(form.role === t.value ? styles.typeCardActive : {}) }}
              onClick={() => setForm({ ...form, role: t.value })}
            >
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 8 }}>{t.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Şirket / Marka Adı</label>
            <input className="sinput" placeholder="Şirket adınız" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Şifre</label>
            <input className="sinput" type="password" placeholder="En az 6 karakter" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={submitting}>
            {submitting ? 'Hesap oluşturuluyor...' : 'Daveti Kabul Et & Kayıt Ol'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 460 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoText: { fontSize: 20, fontWeight: 700 },
  inviteBanner: { background: 'var(--teal-dim)', border: '1px solid var(--teal-mid)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 },
  typeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 },
  typeCard: { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' },
  typeCardActive: { borderColor: 'var(--teal)', background: 'var(--teal-dim)' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  btn: { width: '100%', padding: '11px 0', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  error: { background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
};
