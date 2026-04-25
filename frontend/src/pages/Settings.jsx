import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const NOTIF_DEFAULTS = {
  anomalyAlerts: true,
  weeklyReport: false,
  tvDetection: true,
  budgetWarnings: true,
  emailDigest: false,
};

const ROLE_LABELS = { agency: 'Ajans', brand: 'Marka' };

export default function Settings() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(NOTIF_DEFAULTS);
  const [saved, setSaved] = useState(false);

  const toggleNotif = (key) => {
    setNotifications(n => ({ ...n, [key]: !n[key] }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <div className="topbar-right">
          <button className="btn-export" onClick={handleSave}>{saved ? '✓ Kaydedildi' : 'Kaydet'}</button>
        </div>
      </div>
      <div className="content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Profil bilgileri</div></div>
            <div className="card-body">
              {[
                { label: 'E-posta', value: user?.email || '' },
                { label: 'Şirket', value: user?.company_name || '' },
                { label: 'Hesap Türü', value: roleLabel },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  <input
                    className="sinput"
                    value={value}
                    readOnly
                    style={{ opacity: 0.7, cursor: 'default' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Bildirimler</div></div>
            <div className="card-body">
              {[
                { key: 'anomalyAlerts', label: 'Anomali uyarıları', desc: 'Anormal metrik değişimlerinde bildir' },
                { key: 'weeklyReport', label: 'Haftalık rapor', desc: 'Her pazartesi otomatik rapor gönder' },
                { key: 'tvDetection', label: 'TV tespit uyarıları', desc: 'Yeni yayın tespitinde bildir' },
                { key: 'budgetWarnings', label: 'Bütçe uyarıları', desc: 'Bütçe %80\'i aşınca uyar' },
                { key: 'emailDigest', label: 'E-posta özeti', desc: 'Günlük e-posta özeti gönder' },
              ].map(({ key, label, desc }) => (
                <div className="settings-row" key={key}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{desc}</div>
                  </div>
                  <button
                    className={`toggle${notifications[key] ? ' on' : ''}`}
                    onClick={() => toggleNotif(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
