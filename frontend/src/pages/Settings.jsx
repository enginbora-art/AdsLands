import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api';

export default function Settings() {
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSettings().then(setData); }, []);

  const toggleNotif = async (key) => {
    const updated = { ...data, notifications: { ...data.notifications, [key]: !data.notifications[key] } };
    setData(updated);
    await updateSettings(updated);
  };

  const handleSave = async () => {
    await updateSettings(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!data) return <div className="loading">Yükleniyor...</div>;

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
                { label: 'Ad Soyad', field: 'name' },
                { label: 'E-posta', field: 'email' },
                { label: 'Şirket', field: 'company' },
                { label: 'Rol', field: 'role' },
              ].map(({ label, field }) => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  <input
                    className="sinput"
                    value={data.profile[field] || ''}
                    onChange={e => setData({ ...data, profile: { ...data.profile, [field]: e.target.value } })}
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
                    className={`toggle${data.notifications[key] ? ' on' : ''}`}
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
