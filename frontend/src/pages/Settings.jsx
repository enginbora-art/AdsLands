import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { updateProfile, getSettings, updateCompanySector, getNotificationPrefs, saveNotificationPrefs, changePassword } from '../api';
import { parseJwt } from '../utils';

const NOTIF_DEFAULTS = {
  anomalyAlerts: true,
  weeklyReport: false,
  tvDetection: true,
  budgetWarnings: true,
  emailDigest: false,
};

const SECTORS = [
  'E-ticaret', 'Perakende', 'Finans & Sigorta', 'Otomotiv',
  'Gıda & İçecek', 'Turizm & Seyahat', 'Teknoloji & SaaS',
  'Sağlık & Güzellik', 'Eğitim', 'Gayrimenkul', 'Medya & Eğlence', 'Diğer',
];

const ROLE_LABELS = { agency: 'Ajans', brand: 'Marka' };

export default function Settings() {
  const { user, saveAuth } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const [notifications, setNotifications] = useState(NOTIF_DEFAULTS);
  const [notifState, setNotifState]       = useState('idle'); // idle | saving | saved | error
  const notifTimerRef                     = useRef(null);
  const [fullName, setFullName]           = useState(user?.full_name || '');
  const [profileState, setProfileState]   = useState('idle');
  const [profileError, setProfileError]   = useState('');

  const [sector, setSector]           = useState('');
  const [sectorState, setSectorState] = useState('idle');
  const [sectorError, setSectorError] = useState('');

  const [pwForm, setPwForm]       = useState({ current: '', next: '', confirm: '' });
  const [pwState, setPwState]     = useState('idle');
  const [pwError, setPwError]     = useState('');

  const isAgency = user?.company_type === 'agency';
  const isBrand  = user?.company_type === 'brand';

  // Show brand profile card for brand users or agency users with a selected brand
  const showBrandProfile = isBrand || (isAgency && selectedBrand);
  const brandProfileName = isAgency ? (selectedBrand?.name || selectedBrand?.company_name) : user?.company_name;
  const brandProfileId   = isAgency ? selectedBrand?.id : user?.company_id;

  useEffect(() => {
    if (!showBrandProfile) return;
    const brandId = isAgency ? selectedBrand?.id : null;
    getSettings(brandId)
      .then(data => setSector(data.sector || ''))
      .catch(() => {});
  }, [showBrandProfile, isAgency, selectedBrand?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load notification prefs from DB on mount
  useEffect(() => {
    getNotificationPrefs()
      .then(prefs => {
        if (prefs && typeof prefs === 'object' && Object.keys(prefs).length > 0) {
          setNotifications(prev => ({ ...prev, ...prefs }));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle + debounced auto-save (600ms)
  const toggleNotif = (key) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setNotifState('saving');
    notifTimerRef.current = setTimeout(async () => {
      try {
        await saveNotificationPrefs(next);
        setNotifState('saved');
        setTimeout(() => setNotifState('idle'), 2500);
      } catch {
        setNotifState('error');
        setTimeout(() => setNotifState('idle'), 3000);
      }
    }, 600);
  };

  const handleProfileSave = async () => {
    if (!fullName.trim()) { setProfileError('Ad Soyad boş bırakılamaz.'); return; }
    setProfileState('saving');
    setProfileError('');
    try {
      const { token: newJwt } = await updateProfile({ full_name: fullName.trim() });
      const payload = parseJwt(newJwt);
      saveAuth(newJwt, { ...user, full_name: payload.full_name });
      setProfileState('saved');
      setTimeout(() => setProfileState('idle'), 2500);
    } catch (err) {
      setProfileError(err?.response?.data?.error || 'Kaydetme başarısız.');
      setProfileState('error');
    }
  };

  const handleSectorSave = async () => {
    if (!brandProfileId) return;
    setSectorState('saving');
    setSectorError('');
    try {
      await updateCompanySector(brandProfileId, sector);
      setSectorState('saved');
      setTimeout(() => setSectorState('idle'), 2500);
    } catch (err) {
      setSectorError(err?.response?.data?.error || 'Kaydetme başarısız.');
      setSectorState('error');
    }
  };

  const handlePasswordSave = async () => {
    setPwError('');
    if (!pwForm.current) { setPwError('Mevcut şifre zorunludur.'); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError('Yeni şifreler eşleşmiyor.'); return; }
    if (pwForm.next.length < 8 || !/\d/.test(pwForm.next)) {
      setPwError('Şifre en az 8 karakter olmalı ve en az 1 rakam içermelidir.');
      return;
    }
    setPwState('saving');
    try {
      await changePassword(pwForm.current, pwForm.next);
      setPwState('saved');
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwState('idle'), 2500);
    } catch (err) {
      setPwError(err?.response?.data?.error || 'Şifre güncellenemedi.');
      setPwState('error');
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
        <div className="resp-grid-2" style={{ gap: 24 }}>

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
                style={saveBtnStyle(profileState)}>
                {profileState === 'saving' ? 'Kaydediliyor...' : profileState === 'saved' ? '✓ Kaydedildi' : 'Kaydet'}
              </button>
            </div>
          </div>

          {/* Notifications card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Bildirimler</div>
              <div style={{ fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                color: notifState === 'saved' ? 'var(--teal)' : notifState === 'error' ? 'var(--coral)' : notifState === 'saving' ? 'var(--text3)' : 'transparent' }}>
                {notifState === 'saving' ? 'Kaydediliyor...' : notifState === 'saved' ? '✓ Kaydedildi' : notifState === 'error' ? '⚠ Hata' : '·'}
              </div>
            </div>
            <div className="card-body">
              {[
                { key: 'anomalyAlerts', label: 'Anomali uyarıları',   desc: 'Anormal metrik değişimlerinde bildir' },
                { key: 'weeklyReport',  label: 'Haftalık rapor',      desc: 'Her pazartesi otomatik rapor gönder' },
                { key: 'tvDetection',   label: 'TV tespit uyarıları', desc: 'Yeni yayın tespitinde bildir' },
                { key: 'budgetWarnings',label: 'Bütçe uyarıları',     desc: "Bütçe %80'i aşınca uyar" },
                { key: 'emailDigest',   label: 'E-posta özeti',       desc: 'Günlük e-posta özeti gönder' },
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

          {/* Marka Profili card — brand users + agency with selected brand */}
          {showBrandProfile && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Marka Profili</div>
                {brandProfileName && (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{brandProfileName}</div>
                )}
              </div>
              <div className="card-body">
                {isAgency && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={labelStyle}>Marka</div>
                    <input className="sinput" value={brandProfileName || ''} readOnly style={{ opacity: 0.55, cursor: 'default' }} />
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={labelStyle}>Sektör</div>
                  <select
                    className="sinput"
                    value={sector}
                    onChange={e => { setSector(e.target.value); setSectorState('idle'); setSectorError(''); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">— Seçiniz —</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {sectorError && (
                  <div style={{ background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
                    {sectorError}
                  </div>
                )}
                <button
                  onClick={handleSectorSave}
                  disabled={sectorState === 'saving'}
                  style={saveBtnStyle(sectorState)}>
                  {sectorState === 'saving' ? 'Kaydediliyor...' : sectorState === 'saved' ? '✓ Kaydedildi' : 'Kaydet'}
                </button>
              </div>
            </div>
          )}

          {/* Şifre Değiştir kartı */}
          <div className="card">
            <div className="card-header"><div className="card-title">Şifre Değiştir</div></div>
            <div className="card-body">
              {[
                { key: 'current', label: 'Mevcut Şifre',    placeholder: '••••••••' },
                { key: 'next',    label: 'Yeni Şifre',       placeholder: 'En az 8 karakter, 1 rakam' },
                { key: 'confirm', label: 'Yeni Şifre Tekrar', placeholder: 'Şifrenizi tekrar girin' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={labelStyle}>{label}</div>
                  <input
                    className="sinput"
                    type="password"
                    placeholder={placeholder}
                    value={pwForm[key]}
                    onChange={e => { setPwForm({ ...pwForm, [key]: e.target.value }); setPwState('idle'); setPwError(''); }}
                  />
                </div>
              ))}
              {pwError && (
                <div style={{ background: 'var(--coral-dim)', color: 'var(--coral)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
                  {pwError}
                </div>
              )}
              {pwState === 'saved' && (
                <div style={{ background: 'rgba(0,191,166,0.12)', color: 'var(--teal)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>
                  ✓ Şifreniz güncellendi
                </div>
              )}
              <button
                onClick={handlePasswordSave}
                disabled={pwState === 'saving'}
                style={saveBtnStyle(pwState)}>
                {pwState === 'saving' ? 'Kaydediliyor...' : pwState === 'saved' ? '✓ Kaydedildi' : 'Kaydet'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 11, color: 'var(--text3)', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.5px',
};

const saveBtnStyle = (state) => ({
  padding: '9px 20px',
  background: state === 'saved' ? 'rgba(52,211,153,0.15)' : 'var(--teal)',
  border: state === 'saved' ? '1px solid rgba(52,211,153,0.4)' : 'none',
  borderRadius: 8,
  color: state === 'saved' ? 'var(--success)' : 'var(--bg)',
  fontSize: 13, fontWeight: 700,
  cursor: state === 'saving' ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--font)', transition: 'all 0.2s',
  opacity: state === 'saving' ? 0.7 : 1,
});
