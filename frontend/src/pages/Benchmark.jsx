import { useEffect, useState } from 'react';
import { getBenchmark } from '../api';

export default function Benchmark() {
  const [data, setData] = useState(null);

  useEffect(() => { getBenchmark().then(setData); }, []);

  if (!data) return <div className="loading">Yükleniyor...</div>;

  const normalize = (val, max) => Math.min((val / max) * 100, 100);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Benchmark</div>
        <div className="topbar-right">
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{data.industry} · {data.period}</span>
        </div>
      </div>
      <div className="content">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Sektör karşılaştırması</div>
              <div className="card-subtitle">{data.industry} sektörü ortalamasına göre konumunuz</div>
            </div>
          </div>
          <div className="card-body">
            {data.metrics.map(m => {
              const maxVal = Math.max(m.yours, m.industryAvg, m.topQuartile);
              const yoursPct = normalize(m.yours, maxVal);
              const avgPct = normalize(m.industryAvg, maxVal);
              const topPct = normalize(m.topQuartile, maxVal);
              const better = m.lowerIsBetter ? m.yours < m.industryAvg : m.yours > m.industryAvg;
              return (
                <div className="benchmark-metric-row" key={m.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ort: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{m.unit === '₺' ? `₺${m.industryAvg}` : `${m.industryAvg}${m.unit}`}</span></span>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Top %25: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{m.unit === '₺' ? `₺${m.topQuartile}` : `${m.topQuartile}${m.unit}`}</span></span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: better ? 'var(--success)' : 'var(--amber)' }}>
                        {m.unit === '₺' ? `₺${m.yours}` : `${m.yours}${m.unit}`}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', width: 60 }}>Sizin</span>
                      <div style={{ flex: 1, height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${yoursPct}%`, height: '100%', background: better ? 'var(--success)' : 'var(--amber)', borderRadius: 5 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', width: 60 }}>Sektör ort.</span>
                      <div style={{ flex: 1, height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${avgPct}%`, height: '100%', background: 'var(--text3)', borderRadius: 5 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', width: 60 }}>Top %25</span>
                      <div style={{ flex: 1, height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${topPct}%`, height: '100%', background: 'var(--blue)', borderRadius: 5 }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
