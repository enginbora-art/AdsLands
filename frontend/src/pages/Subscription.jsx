import { useState, useEffect } from 'react';
import { getSubscription, cancelSubscription, getPaymentHistory } from '../api';

const PLAN_LABELS = {
  starter:      'Ajans Starter',
  growth:       'Ajans Growth',
  scale:        'Ajans Scale',
  brand_direct: 'Marka Direkt',
};

const STATUS_CFG = {
  active:    { label: 'Aktif',       color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  cancelled: { label: 'İptal Edildi', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  past_due:  { label: 'Gecikmiş',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  trialing:  { label: 'Deneme',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
};

const TX_STATUS = {
  pending:  { label: 'Bekliyor', color: '#f59e0b' },
  success:  { label: 'Başarılı', color: '#10b981' },
  failed:   { label: 'Başarısız', color: '#ef4444' },
  refunded: { label: 'İade',      color: '#8b5cf6' },
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const fmtAmount = (n) => `₺${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}`;

function CancelModal({ onConfirm, onCancel, loading }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '32px 28px', maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 14 }}>⚠️</div>
        <h2 style={{ color: '#f1f5f9', textAlign: 'center', margin: '0 0 12px', fontSize: 18 }}>Aboneliği İptal Et</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
          Aboneliğinizi iptal etmek istediğinize emin misiniz? Mevcut dönem sonuna kadar erişiminiz devam eder.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={loading} style={{ flex: 1, padding: '11px 0', background: 'transparent', border: '1px solid #1e2535', borderRadius: 10, color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>
            Vazgeç
          </button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '11px 0', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#ef4444', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'İptal ediliyor...' : 'İptal Et'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Subscription({ onNav }) {
  const [sub, setSub]               = useState(null);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg]               = useState(null);

  useEffect(() => {
    Promise.all([getSubscription(), getPaymentHistory()])
      .then(([s, h]) => { setSub(s); setHistory(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelSubscription();
      setSub(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setCancelModal(false);
      setMsg({ type: 'success', text: 'Aboneliğiniz iptal edildi. Dönem sonuna kadar erişiminiz devam eder.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'İptal işlemi başarısız.' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Yükleniyor...</div>;
  }

  const statusCfg = sub ? (STATUS_CFG[sub.status] || STATUS_CFG.active) : null;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 60px' }}>
      {cancelModal && <CancelModal onConfirm={handleCancel} onCancel={() => setCancelModal(false)} loading={cancelling} />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font)', fontSize: 22, color: '#f1f5f9', margin: '0 0 6px' }}>Abonelik</h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Abonelik durumunuzu ve ödeme geçmişinizi buradan yönetin.</p>
      </div>

      {msg && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: msg.type === 'success' ? '#10b981' : '#ef4444',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Aktif Plan Kartı */}
      <div style={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 16, padding: '24px 28px', marginBottom: 24 }}>
        {sub ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                  {PLAN_LABELS[sub.plan] || sub.plan}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {sub.interval === 'yearly' ? 'Yıllık' : 'Aylık'} · {fmtAmount(sub.amount)} / ay
                </div>
              </div>
              <div style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: statusCfg.bg, color: statusCfg.color,
              }}>
                {statusCfg.label}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Dönem Başlangıcı', val: fmt(sub.current_period_start) },
                { label: 'Sonraki Ödeme',    val: fmt(sub.current_period_end) },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {sub.status === 'active' && (
                <button
                  onClick={() => setCancelModal(true)}
                  style={{ padding: '10px 20px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Aboneliği İptal Et
                </button>
              )}
              <button
                onClick={() => { if (onNav) onNav('pricing'); }}
                style={{ padding: '10px 20px', borderRadius: 9, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', color: '#0d9488', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Plan Değiştir
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>Aktif abonelik yok</div>
            <div style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              Tüm özelliklere erişmek için bir plan seçin.
            </div>
            <button
              onClick={() => { if (onNav) onNav('pricing'); }}
              style={{ padding: '12px 28px', borderRadius: 10, background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
            >
              Planları Görüntüle
            </button>
          </div>
        )}
      </div>

      {/* Ödeme Geçmişi */}
      <div>
        <h2 style={{ fontFamily: 'var(--font)', fontSize: 16, color: '#f1f5f9', margin: '0 0 16px' }}>Ödeme Geçmişi</h2>

        {history.length === 0 ? (
          <div style={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 12, padding: '28px 24px', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
            Henüz ödeme kaydı yok.
          </div>
        ) : (
          <div style={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2535' }}>
                  {['Tarih', 'Plan', 'Tutar', 'Durum', 'İşlem ID'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((tx, i) => {
                  const stCfg = TX_STATUS[tx.status] || TX_STATUS.pending;
                  return (
                    <tr key={tx.id} style={{ borderBottom: i < history.length - 1 ? '1px solid #1e2535' : 'none' }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#cbd5e1' }}>{fmt(tx.created_at)}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>
                        {PLAN_LABELS[tx.plan] || tx.plan || '—'}
                        {tx.interval && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>{tx.interval === 'yearly' ? 'Yıllık' : 'Aylık'}</span>}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                        {fmtAmount(tx.amount)}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: stCfg.color, background: `${stCfg.color}18`, padding: '3px 10px', borderRadius: 12 }}>
                          {stCfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                        {(tx.order_id || '').slice(0, 8)}…
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
