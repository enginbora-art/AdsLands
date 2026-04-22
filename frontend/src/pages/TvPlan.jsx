import { useEffect, useState } from 'react';
import { getTvBroadcast } from '../api';

export default function TvPlan() {
  const [data, setData] = useState(null);

  useEffect(() => { getTvBroadcast().then(setData); }, []);

  if (!data) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">TV Medya Planı</div>
        <div className="topbar-right">
          <button className="btn-export">Plan Yükle</button>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Nisan 2026 — Plan vs Gerçekleşen</div>
            <div className="card-subtitle">Kanal bazlı yayın uyum analizi</div>
          </div>
          <div className="card-body">
            {data.planVsActual.map(row => (
              <div key={row.channel} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.channel}</span>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)' }}>Planlanan: <span style={{ color: 'var(--text1)', fontFamily: 'var(--mono)' }}>{row.planned}</span></span>
                    <span style={{ color: 'var(--text3)' }}>Gerçekleşen: <span style={{ color: row.status === 'good' ? 'var(--success)' : 'var(--amber)', fontFamily: 'var(--mono)' }}>{row.actual}</span></span>
                    <span style={{ color: row.status === 'good' ? 'var(--success)' : 'var(--amber)', fontWeight: 700 }}>%{row.rate}</span>
                  </div>
                </div>
                <div style={{ height: 12, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(row.rate, 100)}%`, height: '100%', borderRadius: 6, background: row.status === 'good' ? 'var(--success)' : 'var(--amber)', transition: 'width 0.8s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="detection-log">
          <div className="log-header">
            <div>
              <div className="card-title">Yayın planı detayı</div>
              <div className="card-subtitle">Kuşak dağılımı ve uyum durumu</div>
            </div>
          </div>
          <table className="log-table">
            <thead>
              <tr>
                <th>Kanal</th>
                <th>Planlanan</th>
                <th>Gerçekleşen</th>
                <th>Eksik</th>
                <th>Uyum oranı</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {data.planVsActual.map(row => (
                <tr key={row.channel}>
                  <td style={{ fontWeight: 600, color: row.color }}>{row.channel}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{row.planned}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: row.status === 'good' ? 'var(--success)' : 'var(--amber)' }}>{row.actual}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: row.actual < row.planned ? 'var(--danger)' : 'var(--success)' }}>{Math.max(0, row.planned - row.actual)}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>%{row.rate}</td>
                  <td><span className={`log-status ${row.status === 'good' ? 'verified' : 'warn'}`}>{row.status === 'good' ? '✓ Uyumlu' : '⚠ Sapma var'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
