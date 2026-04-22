import { useEffect, useState } from 'react';
import { getAnomalies } from '../api';

export default function Anomalies() {
  const [data, setData] = useState([]);

  useEffect(() => { getAnomalies().then(setData); }, []);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">Anomaliler</div>
        <div className="topbar-right">
          <span className="nav-badge">{data.length}</span>
        </div>
      </div>
      <div className="content">
        {data.map(a => (
          <div key={a.id} className="alert-card" style={{ marginBottom: 16 }}>
            <div className="alert-icon" style={{ background: a.severity === 'high' ? 'var(--coral-dim)' : 'var(--amber-dim)', color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)' }}>!</div>
            <div className="alert-content">
              <div className="alert-title" style={{ color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)' }}>{a.title}</div>
              <div className="alert-desc">{a.description}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Kanal: <span style={{ color: 'var(--text1)' }}>{a.channel}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Metrik: <span style={{ color: 'var(--text1)' }}>{a.metric}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Baz: <span style={{ color: 'var(--text1)', fontFamily: 'var(--mono)' }}>₺{a.baseline}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mevcut: <span style={{ color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)', fontFamily: 'var(--mono)' }}>₺{a.current}</span></div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Sapma: <span style={{ color: a.deviation > 0 ? 'var(--danger)' : 'var(--amber)' }}>{a.deviation > 0 ? '+' : ''}{a.deviation}%</span></div>
              </div>
              <div className="alert-time">{a.time}</div>
            </div>
            <button className="alert-action" style={{ borderColor: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)', color: a.severity === 'high' ? 'var(--coral)' : 'var(--amber)' }}>
              İncele
            </button>
          </div>
        ))}
        {data.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div>Aktif anomali bulunmuyor</div>
          </div>
        )}
      </div>
    </div>
  );
}
