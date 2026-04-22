import { useEffect, useState } from 'react';
import { getMetrics, getWeeklySpend, getRoas, getSparklines, getAnomalies } from '../api';
import InviteModal from '../components/InviteModal';

function Sparkline({ values, color = 'var(--teal)' }) {
  if (!values?.length) return null;
  const max = Math.max(...values);
  return (
    <div className="sparkline">
      {values.map((v, i) => (
        <div
          key={i}
          className={`spark-bar${i === values.length - 1 ? ' last' : ''}`}
          style={{ height: `${(v / max) * 100}%`, background: color }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [spend, setSpend] = useState([]);
  const [roas, setRoas] = useState(null);
  const [sparks, setSparks] = useState(null);
  const [anomaly, setAnomaly] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    getMetrics().then(setMetrics);
    getWeeklySpend().then(setSpend);
    getRoas().then(setRoas);
    getSparklines().then(setSparks);
    getAnomalies().then(d => setAnomaly(d[0]));
  }, []);

  const maxSpend = spend.length ? Math.max(...spend.map(d => d.google + d.meta)) : 1;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <div className="topbar-right">
          <div className="date-picker">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            7 – 13 Nisan 2026
          </div>
          <button style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--teal)', background: 'transparent', color: 'var(--teal)' }} onClick={() => setShowInvite(true)}>
            + Davet Gönder
          </button>
          <button className="btn-export">Dışa aktar</button>
        </div>
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      <div className="content">
        {anomaly && (
          <div className="alert-card">
            <div className="alert-icon">!</div>
            <div className="alert-content">
              <div className="alert-title">{anomaly.title}</div>
              <div className="alert-desc">{anomaly.description}</div>
              <div className="alert-time">{anomaly.time}</div>
            </div>
            <button className="alert-action">Detayları gör</button>
          </div>
        )}

        {metrics && (
          <div className="metrics">
            <div className="metric-card teal">
              <div className="metric-label">Toplam harcama</div>
              <div className="metric-value">₺{metrics.totalSpend.toLocaleString('tr-TR')}</div>
              <span className="metric-change up">+{metrics.totalSpendChange}%</span>
              <div className="metric-sub">Geçen haftaya göre</div>
              <Sparkline values={sparks?.spend} />
            </div>
            <div className="metric-card purple">
              <div className="metric-label">ROAS</div>
              <div className="metric-value">{metrics.roas}</div>
              <span className="metric-change up">+{metrics.roasChange}</span>
              <div className="metric-sub">Sektör ort: {metrics.roasIndustryAvg}</div>
              <Sparkline values={sparks?.roas} color="var(--purple)" />
            </div>
            <div className="metric-card amber">
              <div className="metric-label">Dönüşüm</div>
              <div className="metric-value">{metrics.conversions.toLocaleString('tr-TR')}</div>
              <span className="metric-change up">+{metrics.conversionsChange}%</span>
              <div className="metric-sub">CPA: ₺{metrics.cpa}</div>
              <Sparkline values={sparks?.conversions} color="var(--amber)" />
            </div>
            <div className="metric-card coral">
              <div className="metric-label">Tıklama oranı (CTR)</div>
              <div className="metric-value">{metrics.ctr}%</div>
              <span className="metric-change down">{metrics.ctrChange}%</span>
              <div className="metric-sub">Geçen hafta: {metrics.ctrPrevWeek}%</div>
              <Sparkline values={sparks?.ctr} color="var(--coral)" />
            </div>
          </div>
        )}

        <div className="charts-row">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Haftalık harcama dağılımı</div>
                <div className="card-subtitle">Kanal bazlı günlük harcama</div>
              </div>
              <div className="chart-legend">
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--blue)' }}></div>Google Ads</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--purple)' }}></div>Meta Ads</div>
              </div>
            </div>
            <div className="card-body">
              <div className="chart-area">
                {spend.map(d => (
                  <div className="chart-bar-group" key={d.day}>
                    <div className="chart-bar google" style={{ height: `${(d.google / maxSpend) * 180}px` }} />
                    <div className="chart-bar meta" style={{ height: `${(d.meta / maxSpend) * 180}px` }} />
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {spend.map(d => <span key={d.day}>{d.day}</span>)}
              </div>
            </div>
          </div>

          {roas && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">ROAS karşılaştırma</div>
                  <div className="card-subtitle">Kanal bazlı getiri</div>
                </div>
              </div>
              <div className="card-body">
                <div className="roas-grid">
                  <div className="roas-item">
                    <div className="roas-channel">Google Ads</div>
                    <div className="roas-val" style={{ color: 'var(--blue)' }}>{roas.google.roas}</div>
                    <div className="roas-label">ROAS</div>
                  </div>
                  <div className="roas-item">
                    <div className="roas-channel">Meta Ads</div>
                    <div className="roas-val" style={{ color: 'var(--purple)' }}>{roas.meta.roas}</div>
                    <div className="roas-label">ROAS</div>
                  </div>
                  <div className="roas-item">
                    <div className="roas-channel">Google CPA</div>
                    <div className="roas-val" style={{ color: 'var(--blue)' }}>₺{roas.google.cpa}</div>
                    <div className="roas-label">Dönüşüm maliyeti</div>
                  </div>
                  <div className="roas-item">
                    <div className="roas-channel">Meta CPA</div>
                    <div className="roas-val" style={{ color: 'var(--purple)' }}>₺{roas.meta.cpa}</div>
                    <div className="roas-label">Dönüşüm maliyeti</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
