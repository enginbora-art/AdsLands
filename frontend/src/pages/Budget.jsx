import { useEffect, useState } from 'react';
import { getBudget } from '../api';

export default function Budget() {
  const [data, setData] = useState(null);

  useEffect(() => { getBudget().then(setData); }, []);

  if (!data) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Bütçe Planlama</div>
        <div className="topbar-right">
          <button className="btn-export">Dışa aktar</button>
        </div>
      </div>
      <div className="content">
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="metric-card teal">
            <div className="metric-label">Toplam bütçe</div>
            <div className="metric-value">₺{data.totalBudget.toLocaleString('tr-TR')}</div>
            <div className="metric-sub">Nisan 2026</div>
          </div>
          <div className="metric-card purple">
            <div className="metric-label">Harcanan</div>
            <div className="metric-value">₺{data.spent.toLocaleString('tr-TR')}</div>
            <span className="metric-change down">%{data.burnRate} kullanıldı</span>
          </div>
          <div className="metric-card amber">
            <div className="metric-label">Kalan</div>
            <div className="metric-value">₺{data.remaining.toLocaleString('tr-TR')}</div>
            <div className="metric-sub">Ay sonuna kalan</div>
          </div>
          <div className="metric-card coral">
            <div className="metric-label">Ay sonu tahmini</div>
            <div className="metric-value">₺{data.forecastEndOfMonth.toLocaleString('tr-TR')}</div>
            <span className="metric-change up">Bütçe dahilinde</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Kanal bütçe durumu</div>
          </div>
          <div className="card-body">
            {data.channels.map(ch => (
              <div key={ch.name} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: ch.color }}>{ch.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                    ₺{ch.spent.toLocaleString('tr-TR')} / ₺{ch.budget.toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="budget-bar-wrap">
                  <div className="budget-bar-fill" style={{ width: `${(ch.spent / ch.budget) * 100}%`, background: ch.color }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>%{Math.round((ch.spent / ch.budget) * 100)} kullanıldı</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Kampanya detayları</div>
            <div className="card-subtitle">Tüm aktif kampanyalar</div>
          </div>
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Kampanya</th>
                <th>Kanal</th>
                <th>Bütçe</th>
                <th>Harcanan</th>
                <th>ROAS</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map(c => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td style={{ color: c.channel === 'Google' ? 'var(--blue)' : 'var(--purple)' }}>{c.channel}</td>
                  <td>₺{c.budget.toLocaleString('tr-TR')}</td>
                  <td>₺{c.spent.toLocaleString('tr-TR')}</td>
                  <td style={{ color: c.roas >= 4 ? 'var(--success)' : c.roas >= 3 ? 'var(--amber)' : 'var(--danger)' }}>{c.roas}x</td>
                  <td>
                    <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: c.status === 'active' ? 'rgba(52,211,153,0.15)' : 'rgba(255,181,71,0.15)',
                      color: c.status === 'active' ? 'var(--success)' : 'var(--amber)' }}>
                      {c.status === 'active' ? 'Aktif' : 'Uyarı'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
