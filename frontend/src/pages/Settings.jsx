import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api';

const NOTIF_DEFAULTS = {
  anomalyAlerts: true,
  weeklyReport: false,
  tvDetection: true,
  budgetWarnings: true,
  emailDigest: false,
};

const ROLE_LABELS = { agency: 'Ajans', brand: 'Marka' };

export default function Settings() {
  const { user, saveAuth } = useAuth();
  const [notifications, setNotifications] = useState(NOTIF_DEFAULTS);
  const [fullName, setFullName]           = useState(user?.full_name || '');
  const [profileState, setProfileState]   = useState('idle'); // idle | saving | saved | error
  const [profileError, setProfileError]   = useState('');

  const toggleNotif = (key) => setNotifications(n => ({ ...n, [key]: !n[key] }));

  const handleProfileSave = async () => {
    if (!fullName.trim()) { setProfileError('Ad Soyad boş bırakılamaz.'); return; }
    setProfileState('saving');
    setProfileError('');
    try {
      const { token: newJwt } = await updateProfile({ full_name: fullName.trim() });
      const payload = JSON.parse(atob(newJwt.split('.')[1]));
      saveAuth(newJwt, {
        ...user,
        full_name: payload.full_name,
      });
      setProfileState('saved');
      setTimeout(() => setProfileState('idle'), 2500);
    } catch (err) {
      setProfileError(err?.response?.data?.error || 'Kaydetme başarısız.');
      setProfileState('error');
    }
  };

  const roleLabel = user?.is_platform_admin
    ? 'Platform Admin'
    : user?.is_company_admin
      ? `${ROLE_LABELS[user?.company_type] || ''} Admin`
      : ROLE_LABELS[user?.company_type] || '';

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Ayarlar</div>
      </div>
      <div className="content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* Profile card */}
          <div className="card">
            <div className="card-header"><div className="card-title">Profil</div></div>
            <div className="card-body">
              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>Ad Soyad</div>
                <input
                  className="sinput"
                  type="text"
                  placeholder="Adınız ve soyadınız"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setProfileState('idle'); setProfileError(''); }}
                />
              </div>
              {[
                { label: 'E-posta',    value: user?.email || '' },
                { label: 'Şirket',     value: user?.company_name || '' },
                { label: 'Hesap Türü', value: roleLabel },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={labelStyle}>{label}</div>
                  <input className="sinput" value={value} readOnly style={{ opacity: 0.55, cursor: 'default' }} />
                </div>
              ))}
              {profileError && (
                <div style={{ background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
                  {profileError}
                </div>
              )}
              <button
                onClick={handleProfileSave}
                disabled={profileState === 'saving'}
                style={{ padding: '9px 20px', background: profileState === 'saved' ? 'rgba(52,211,153,0.15)' : 'var(--teal)', border: profileState === 'saved' ? '1px solid rgba(52,211,153,0.4)' : 'none', borderRadius: 8, color: profileState === 'saved' ? 'var(--success)' : 'var(--bg)', fontSize: 13, fontWeight: 700, cursor: profileState === 'saving' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', transition: 'all 0.2s' }}>
                {profileState === 'saving' ? 'Kaydediliyor...' : profileState === 'saved' ? '✓ Kaydedildi' : 'Kaydet'}
              </button>
            </div>
          </div>

          {/* Notifications card */}
          <div className="card">
            <div className="card-header"><div className="card-title">Bildirimler</div></div>
            <div className="card-body">
              {[
                { key: 'anomalyAlerts', label: 'Anomali uyarıları',  desc: 'Anormal metrik değişimlerinde bildir' },
                { key: 'weeklyReport',  label: 'Haftalık rapor',     desc: 'Her pazartesi otomatik rapor gönder' },
                { key: 'tvDetection',   label: 'TV tespit uyarıları',desc: 'Yeni yayın tespitinde bildir' },
                { key: 'budgetWarnings',label: 'Bütçe uyarıları',    desc: "Bütçe %80'i aşınca uyar" },
                { key: 'emailDigest',   label: 'E-posta özeti',      desc: 'Günlük e-posta özeti gönder' },
              ].map(({ key, label, desc }) => (
                <div className="settings-row" key={key}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{desc}</div>
                  </div>
                  <button className={`toggle${notifications[key] ? ' on' : ''}`} onClick={() => toggleNotif(key)} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' };
