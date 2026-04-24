import { useEffect, useState } from 'react';
import { getInvitation, acceptInvitation } from '../api';

export default function InviteAccept({ token, onDone }) {
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ password: '', password2: '', company_name: '', role: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getInvitation(token)
      .then(setInvite)
      .catch(err => setError(err.response?.data?.error || 'Davet bulunamadı.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => {
        window.history.pushState({}, '', '/');
        onDone?.();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [success, onDone]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.role) return setError('Lütfen hesap tipini seçin.');
    if (!form.company_name.trim()) return setError('Şirket adı zorunludur.');
    if (form.password.length < 6) return setError('Şifre en az 6 karakter olmalıdır.');
    if (form.password !== form.password2) return setError('Şifreler eşleşmiyor.');
    setSubmitting(true);
    setError('');
    try {
      await acceptInvitation({ token, password: form.password, company_name: form.company_name, role: form.role });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Hesap oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={st.page}>
      <div style={{ color: 'var(--text3)' }}>Davet yükleniyor...</div>
    </div>
  );

  if (error && !invite) return (
    <div style={st.page}>
      <div style={st.card}>
        <Logo />
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 16 }}>⚠️</div>
        <div style={{ textAlign: 'center', color: 'var(--coral)', fontWeight: 600 }}>{error}</div>
      </div>
    </div>
  );

  if (success) return (
    <div style={st.page}>
      <div style={st.card}>
        <Logo />
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Hesabınız oluşturuldu!</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginBottom: 0 }}>
          Giriş sayfasına yönlendiriliyorsunuz...
        </p>
      </div>
    </div>
  );

  return (
    <div style={st.page}>
      <div style={st.card}>
        <Logo />

        <div style={st.banner}>
          <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Davet</div>
          <div style={{ fontSize: 14 }}>
            <strong>{invite.sender_company}</strong>{' '}
            <span style={{ color: 'var(--text3)' }}>({invite.sender_role === 'brand' ? 'Marka' : 'Ajans'})</span>{' '}
            sizi AdsLands'e davet etti.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{invite.receiver_email}</div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Hoş geldiniz!</h2>

        <div style={st.typeRow}>
          {[{ value: 'brand', label: 'Marka', icon: '🏢' }, { value: 'agency', label: 'Ajans', icon: '📊' }].map(t => (
            <div key={t.value}
              style={{ ...st.typeCard, ...(form.role === t.value ? st.typeCardActive : {}) }}
              onClick={() => setForm(f => ({ ...f, role: t.value }))}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13, marginLeft: 8 }}>{t.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={st.field}>
            <label style={st.label}>Şirket / Marka Adı</label>
            <input className="sinput" placeholder="Şirket adınız"
              value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required />
          </div>
          <div style={st.field}>
            <label style={st.label}>Şifre belirle</label>
            <input className="sinput" type="password" placeholder="En az 6 karakter"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <div style={st.field}>
            <label style={st.label}>Şifre tekrar</label>
            <input className="sinput" type="password" placeholder="Şifrenizi tekrar girin"
              value={form.password2} onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} required />
          </div>

          {error && <div style={st.error}>{error}</div>}

          <button type="submit" style={{ ...st.btn, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>
            {submitting ? 'Hesap oluşturuluyor...' : 'Hesabımı Aktifleştir'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
        <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
      </svg>
      <span style={{ fontSize: 20, fontWeight: 700 }}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
    </div>
  );
}

const st = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 40, width: '100%', maxWidth: 460 },
  banner: { background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 },
  typeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 },
  typeCard: { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' },
  typeCardActive: { borderColor: 'var(--teal)', background: 'rgba(0,191,166,0.08)' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 },
  btn: { width: '100%', padding: '11px 0', background: 'var(--teal)', color: '#0B1219', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  error: { background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, border: '1px solid rgba(255,107,90,0.2)' },
};
