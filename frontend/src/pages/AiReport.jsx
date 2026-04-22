import { useEffect, useState } from 'react';
import { getAiReport } from '../api';

export default function AiReport() {
  const [data, setData] = useState(null);

  useEffect(() => { getAiReport().then(setData); }, []);

  if (!data) return <div className="loading">Yükleniyor...</div>;

  const maxRoas = Math.max(...data.roasTrend);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">AI Raporlar</div>
        <div className="topbar-right">
          <button className="btn-export">PDF İndir</button>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Haftalık performans özeti</div>
              <div className="card-subtitle">{data.period} · Otomatik oluşturuldu</div>
            </div>
            <div className="ai-badge"><div className="ai-dot" />&nbsp;AI tarafından oluşturuldu</div>
          </div>
          <div className="card-body">
            <div className="ai-text">
              <p dangerouslySetInnerHTML={{ __html: data.summary.replace(/₺[\d,]+/g, m => `<strong>${m}</strong>`).replace(/%[\d.]+/g, m => `<span class="ai-highlight">${m}</span>`) }} />
              <p dangerouslySetInnerHTML={{ __html: data.googleInsight.replace(/CPC ₺[\d.]+/g, m => `<span class="ai-warn">${m}</span>`).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
              <p dangerouslySetInnerHTML={{ __html: data.metaInsight.replace(/%[\d]+/g, m => `<span class="ai-highlight">${m}</span>`) }} />
              <p><strong>Öneri:</strong> {data.recommendation.split('3.84')[0]}<span className="ai-highlight">3.84</span>{data.recommendation.split('3.84')[1]?.split('4.44')[0]}<span className="ai-highlight">4.44</span>{data.recommendation.split('4.44')[1]}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Önceki raporlar</div>
                <div className="card-subtitle">Son 4 hafta</div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.previousReports.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.period}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>ROAS: {r.roas} · Harcama: ₺{r.spend.toLocaleString('tr-TR')}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Haftalık ROAS trendi</div>
                <div className="card-subtitle">Son 8 hafta</div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 24, paddingTop: 16 }}>
                {data.roasTrend.map((v, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{v}</div>
                    <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: i === data.roasTrend.length - 1 ? 'var(--teal)' : 'var(--bg4)', height: `${(v / maxRoas) * 130}px`, transition: 'height 0.5s ease' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
