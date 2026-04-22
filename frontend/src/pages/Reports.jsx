import { useEffect, useState } from 'react';
import { getReports } from '../api';

const typeLabel = { weekly: 'Haftalık', tv: 'TV Yayın', competitor: 'Rakip', budget: 'Bütçe' };
const typeColor = { weekly: 'var(--teal)', tv: 'var(--pink)', competitor: 'var(--purple)', budget: 'var(--amber)' };

export default function Reports() {
  const [data, setData] = useState([]);

  useEffect(() => { getReports().then(setData); }, []);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Rapor Oluştur</div>
        <div className="topbar-right">
          <button className="btn-export">+ Yeni Rapor</button>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mevcut raporlar</div>
            <div className="card-subtitle">{data.length} rapor hazır</div>
          </div>
          {data.map(r => (
            <div className="report-row" key={r.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${typeColor[r.type]}20`, color: typeColor[r.type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                  {typeLabel[r.type]?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{typeLabel[r.type]} · {r.createdAt}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="sbadge-success">Hazır</span>
                <button style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>İndir</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">Yeni rapor oluştur</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {Object.entries(typeLabel).map(([key, label]) => (
                <div key={key} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = typeColor[key]}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}>
                  <div style={{ fontSize: 24, marginBottom: 8, color: typeColor[key] }}>
                    {key === 'weekly' ? '📊' : key === 'tv' ? '📺' : key === 'competitor' ? '🎯' : '💰'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{label} Rapor</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
