import { useEffect, useState } from 'react';
import { getChannels } from '../api';

export default function Channels() {
  const [data, setData] = useState(null);

  useEffect(() => { getChannels().then(setData); }, []);

  if (!data) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Kanal Analizi</div>
        <div className="topbar-right">
          <button className="btn-export">Dışa aktar</button>
        </div>
      </div>
      <div className="content">
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="metric-card teal">
            <div className="metric-label">Google Ads harcama</div>
            <div className="metric-value">₺{data.google.spend.toLocaleString('tr-TR')}</div>
            <span className="metric-change up">+{data.google.spendChange}%</span>
            <div className="metric-sub">Toplam bütçenin %{data.google.budgetShare}'i</div>
          </div>
          <div className="metric-card purple">
            <div className="metric-label">Meta Ads harcama</div>
            <div className="metric-value">₺{data.meta.spend.toLocaleString('tr-TR')}</div>
            <span className="metric-change up">+{data.meta.spendChange}%</span>
            <div className="metric-sub">Toplam bütçenin %{data.meta.budgetShare}'u</div>
          </div>
          <div className="metric-card amber">
            <div className="metric-label">Bütçe optimizasyon önerisi</div>
            <div className="metric-value" style={{ fontSize: 16, fontFamily: 'var(--font)', letterSpacing: 0 }}>{data.aiRecommendation}</div>
            <span className="metric-change up" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>AI öneri</span>
            <div className="metric-sub">Tahmini ROAS artışı: +{data.estimatedRoasGain}</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Kanal performans karşılaştırması</div>
              <div className="card-subtitle">Aynı dönem, normalize edilmiş metrikler</div>
            </div>
          </div>
          <div className="card-body">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Metrik</th>
                  <th style={{ color: 'var(--blue)' }}>Google Ads</th>
                  <th style={{ color: 'var(--purple)' }}>Meta Ads</th>
                  <th>Fark</th>
                </tr>
              </thead>
              <tbody>
                {data.comparisonTable.map(row => (
                  <tr key={row.metric}>
                    <td>{row.metric}</td>
                    <td style={{ color: 'var(--blue)' }}>{row.google}</td>
                    <td style={{ color: 'var(--purple)' }}>{row.meta}</td>
                    <td style={{ color: 'var(--text2)' }}>{row.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Harcama oranı</div>
              <div className="card-subtitle">Kanallara göre bütçe dağılımı</div>
            </div>
          </div>
          <div className="card-body">
            <div className="channel-table">
              <div className="channel-row">
                <div className="channel-name"><div className="channel-icon google">G</div> Google Ads</div>
                <div className="channel-bar-wrap"><div className="channel-bar-fill" style={{ width: `${data.google.budgetShare}%`, background: 'var(--blue)' }} /></div>
                <div className="channel-value" style={{ color: 'var(--blue)' }}>%{data.google.budgetShare}</div>
              </div>
              <div className="channel-row">
                <div className="channel-name"><div className="channel-icon meta">M</div> Meta Ads</div>
                <div className="channel-bar-wrap"><div className="channel-bar-fill" style={{ width: `${data.meta.budgetShare}%`, background: 'var(--purple)' }} /></div>
                <div className="channel-value" style={{ color: 'var(--purple)' }}>%{data.meta.budgetShare}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
