import { useEffect, useState } from 'react';
import { getTvBroadcast } from '../api';

export default function TvBroadcast() {
  const [data, setData] = useState(null);

  useEffect(() => { getTvBroadcast().then(setData); }, []);

  if (!data) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">TV Ad Verification</div>
        <div className="topbar-right">
          <div className="ai-badge"><div className="ai-dot" />&nbsp;Canlı izleme</div>
          <button className="btn-export">Rapor İndir</button>
        </div>
      </div>
      <div className="content">
        <div className="reclaim-banner">
          <div className="reclaim-content">
            <h3>Tazminat hakkı tespit edildi</h3>
            <p>Bu ay planlanan 487 yayından {data.reclaimMissed}'ü eksik yayınlandı, {data.reclaimWrongSlot}'sı yanlış kuşakta yer aldı. Tahmini geri kazanım:</p>
          </div>
          <div className="reclaim-amount">₺{data.reclaimAmount.toLocaleString('tr-TR')}</div>
        </div>

        <div className="tv-metrics">
          <div className="metric-card pink">
            <div className="metric-label">Bu ay toplam yayın</div>
            <div className="metric-value">{data.totalBroadcasts}</div>
            <span className="metric-change up">+23 plan üstü</span>
            <div className="metric-sub">5 kanal izleniyor</div>
          </div>
          <div className="metric-card teal">
            <div className="metric-label">Yayın uyumluluğu</div>
            <div className="metric-value">%{data.complianceRate}</div>
            <span className="metric-change up">+{data.complianceChange}%</span>
            <div className="metric-sub">Plan vs gerçek</div>
          </div>
          <div className="metric-card coral">
            <div className="metric-label">Eksik yayın</div>
            <div className="metric-value">{data.missedBroadcasts}</div>
            <span className="metric-change down">uyarı</span>
            <div className="metric-sub">Tazminat talep edilebilir</div>
          </div>
          <div className="metric-card amber">
            <div className="metric-label">Prime time payı</div>
            <div className="metric-value">%{data.primeTimeShare}</div>
            <span className="metric-change up">+{data.primeTimeChange}%</span>
            <div className="metric-sub">Yüksek izlenme kuşağı</div>
          </div>
        </div>

        <div className="channel-monitor">
          <div className="channel-monitor-title">
            Kanal monitör durumu
            <span className="live-status"><span className="live-dot" /> 5/5 kanal canlı takip ediliyor</span>
          </div>
          <div className="channel-grid">
            {data.channels.map(ch => (
              <div className="channel-card" key={ch.name} style={{ borderLeft: `3px solid ${ch.borderColor}` }}>
                <div className="channel-card-header">
                  <div className="channel-card-name">{ch.name}</div>
                  <div className="status-dot" />
                </div>
                {ch.currentAd ? (
                  <>
                    <div className="channel-card-status" style={{ color: 'var(--teal)' }}>● REKLAM YAYINDA</div>
                    <div className="channel-card-time">{ch.lastAdTime} · {ch.duration} sn</div>
                    <div className="channel-card-detail">Ses eşleşmesi: <span style={{ color: 'var(--success)', fontWeight: 600 }}>%{ch.matchRate}</span></div>
                  </>
                ) : (
                  <>
                    <div className="channel-card-status" style={{ color: 'var(--text2)' }}>Program akışı</div>
                    <div className="channel-card-time">Son reklam: {ch.lastAdTime}</div>
                    <div className="channel-card-detail">Bugün: <span style={{ color: 'var(--text1)', fontWeight: 600 }}>{ch.todayCount} tespit</span></div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="plan-vs-actual">
          <div className="plan-card">
            <div className="card-title" style={{ marginBottom: 12 }}>Plan vs Gerçek — Nisan 2026</div>
            <div className="card-subtitle" style={{ marginBottom: 16 }}>Kanal bazlı yayın performansı</div>
            {data.planVsActual.map(row => (
              <div className="plan-channel-row" key={row.channel}>
                <div className="plan-ch-name" style={{ color: row.color }}>{row.channel}</div>
                <div className="plan-bar">
                  <div className={`plan-actual ${row.status}`} style={{ width: `${Math.min(row.rate, 100)}%` }} />
                </div>
                <div className="plan-stats" style={{ color: row.status === 'good' ? 'var(--success)' : 'var(--amber)' }}>
                  {row.actual} / {row.planned}
                </div>
              </div>
            ))}
          </div>

          <div className="competitor-card">
            <div className="card-title" style={{ marginBottom: 12 }}>Rakip yayın takibi</div>
            <div className="card-subtitle" style={{ marginBottom: 16 }}>Moda sektörü · Son 30 gün</div>
            {data.competitors.map(comp => (
              <div className="comp-row" key={comp.name}>
                <div className="comp-brand">
                  <div className="comp-avatar" style={{ background: comp.color }}>{comp.initials}</div>
                  {comp.name}
                </div>
                <div className="comp-stats">
                  <div className="comp-stat">
                    <div className="comp-stat-val">{comp.broadcasts}</div>
                    <div className="comp-stat-lbl">yayın</div>
                  </div>
                  <div className="comp-stat">
                    <div className="comp-stat-val">{comp.estimatedSpend}</div>
                    <div className="comp-stat-lbl">tahmini</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="detection-log">
          <div className="log-header">
            <div>
              <div className="card-title">Son yayın tespitleri</div>
              <div className="card-subtitle">Otomatik ses parmak izi + görüntü eşleştirme</div>
            </div>
            <div className="ai-badge"><div className="ai-dot" />&nbsp;Canlı akış</div>
          </div>
          <table className="log-table">
            <thead>
              <tr>
                <th>Önizleme</th>
                <th>Kanal</th>
                <th>Saat</th>
                <th>Kuşak</th>
                <th>Süre</th>
                <th>Eşleşme</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {data.detectionLog.map(row => (
                <tr key={row.id}>
                  <td><div className="log-thumb">TM</div></td>
                  <td><span className={`log-channel-badge ${row.channelClass}`}>{row.channel}</span></td>
                  <td className="log-time">{row.time}</td>
                  <td><span className={`log-slot ${row.slot}`}>{row.slot === 'prime' ? 'Prime' : 'Gündüz'}</span></td>
                  <td>{row.duration}</td>
                  <td className="log-match">%{row.match}</td>
                  <td><span className={`log-status ${row.status}`}>{row.status === 'verified' ? '✓ Doğrulandı' : '⚠ Kontrol et'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
