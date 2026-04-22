import { useEffect, useState } from 'react';
import { getAgency } from '../api';

export default function Agency() {
  const [data, setData] = useState(null);

  useEffect(() => { getAgency().then(setData); }, []);

  if (!data) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Ajans Yönetimi</div>
        <div className="topbar-right">
          <button className="btn-export">+ Üye Ekle</button>
        </div>
      </div>
      <div className="content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Ekip üyeleri</div>
              <div className="card-subtitle">{data.team.length} üye</div>
            </div>
            {data.team.map(m => (
              <div className="team-row" key={m.id}>
                <div className="team-avatar" style={{ background: m.color }}>{m.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.role}</div>
                </div>
                <span className="sbadge-success">Aktif</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Entegrasyonlar</div>
              <div className="card-subtitle">{data.integrations.filter(i => i.status === 'connected').length}/{data.integrations.length} bağlı</div>
            </div>
            {data.integrations.map(intg => (
              <div className="integration-row" key={intg.name}>
                <div className="int-icon" style={{ background: `${intg.color}20`, color: intg.color }}>{intg.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{intg.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {intg.status === 'connected' ? `Son sync: ${intg.lastSync}` : 'Bağlı değil'}
                  </div>
                </div>
                <span className={intg.status === 'connected' ? 'sbadge-success' : 'sbadge-default'}>
                  {intg.status === 'connected' ? 'Bağlı' : 'Bağla'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
