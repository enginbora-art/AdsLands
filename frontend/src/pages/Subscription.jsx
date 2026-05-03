import { useState, useEffect } from 'react';
import { getSubscription, cancelSubscription, getPaymentHistory, downloadInvoice } from '../api';
import { useAuth } from '../context/AuthContext';

const PLAN_LABELS = {
  starter:          'Basic',
  growth:           'Pro',
  scale:            'Enterprise',
  brand_basic:      'Basic',
  brand_pro:        'Pro',
  brand_enterprise: 'Enterprise',
  brand_direct:     'Direct',
};

const STATUS_CFG = {
  active:    { label: 'Aktif',       color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  cancelled: { label: 'İptal Edildi', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  past_due:  { label: 'Gecikmiş',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  trialing:  { label: 'Deneme',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
};

const TX_STATUS = {
  pending:  { label: 'Bekliyor',  color: '#F59E0B' },
  success:  { label: 'Başarılı',  color: '#00C9A7' },
  failed:   { label: 'Başarısız', color: '#EF4444' },
  refunded: { label: 'İade',      color: '#A78BFA' },
};

const fmt      = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const fmtMoney = (n) => `₺${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}`;

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - Date.now()) / 86400000);
}

function CancelModal({ onConfirm, onCancel, loading, periodEnd }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '32px 28px', maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 14 }}>⚠️</div>
        <h2 style={{ color: '#f1f5f9', textAlign: 'center', margin: '0 0 12px', fontSize: 18 }}>Aboneliği İptal Et</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
          Aboneliğinizi iptal etmek istediğinize emin misiniz?
          {periodEnd && <><br/><strong style={{ color: '#f1f5f9' }}>{fmt(periodEnd)}</strong> tarihine kadar tüm özelliklere erişiminiz devam eder.</>}
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
  const { user } = useAuth();
  // Ajans tarafından yönetilen marka kullanıcıları abonelik başlatamaz
  const canManageSubscription = !(user?.company_type === 'brand' && user?.is_managed_by_agency);
  const [sub, setSub]               = useState(null);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg]               = useState(null);
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const LIMIT = 5;

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear,  setFilterYear]  = useState(now.getFullYear());
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const totalPages  = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    const monthStr = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
    Promise.all([getSubscription(), getPaymentHistory(monthStr, 1, LIMIT)])
      .then(([s, h]) => { setSub(s); setHistory(h.transactions); setTotal(h.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = async (month, year, p = 1) => {
    setHistLoading(true);
    try {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const h = await getPaymentHistory(monthStr, p, LIMIT);
      setHistory(h.transactions);
      setTotal(h.total);
      setPage(p);
    } catch (_) {}
    finally { setHistLoading(false); }
  };

  const handleMonthChange = (e) => {
    const m = Number(e.target.value);
    setFilterMonth(m);
    loadHistory(m, filterYear, 1);
  };

  const handleYearChange = (e) => {
    const y = Number(e.target.value);
    setFilterYear(y);
    loadHistory(filterMonth, y, 1);
  };

  const handlePage = (p) => loadHistory(filterMonth, filterYear, p);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelSubscription();
      setSub(prev => prev ? { ...prev, cancel_at_period_end: true } : null);
      setCancelModal(false);
      setMsg({ type: 'success', text: 'Aboneliğiniz iptal edildi. Dönem sonuna kadar erişiminiz devam eder.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'İptal işlemi başarısız.' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Yükleniyor...</div>;

  const trialDays    = daysUntil(sub?.trial_ends_at);
  const hasPlan      = sub && sub.plan;
  const isCancelPending = hasPlan && sub.cancel_at_period_end;
  const isEffectivelyActive = hasPlan && (sub.status === 'active' || (sub.status === 'cancelled' && isCancelPending && new Date(sub.current_period_end) > new Date()));
  const statusCfg    = hasPlan ? (isCancelPending ? { label: 'İptal Planlandı', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' } : (STATUS_CFG[sub.status] || STATUS_CFG.active)) : null;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 60px' }}>
      {cancelModal && <CancelModal onConfirm={handleCancel} onCancel={() => setCancelModal(false)} loading={cancelling} periodEnd={sub?.current_period_end} />}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font)', fontSize: 22, color: '#f1f5f9', margin: '0 0 6px' }}>Abonelik</h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Abonelik durumunuzu ve ödeme geçmişinizi buradan yönetin.</p>
      </div>

      {/* Trial uyarı banner */}
      {!hasPlan && trialDays !== null && trialDays > 0 && trialDays <= 7 && (
        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>
            ⏳ Deneme süreniz <strong>{trialDays} gün</strong> sonra bitiyor.
          </span>
          {canManageSubscription && (
            <button
              onClick={() => onNav && onNav('pricing')}
              style={{ padding: '8px 16px', borderRadius: 8, background: '#f59e0b', border: 'none', color: '#0f172a', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Abonelik Başlat →
            </button>
          )}
        </div>
      )}

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
        {hasPlan ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                  {PLAN_LABELS[sub.plan] || sub.plan}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {sub.interval === 'yearly' ? 'Yıllık' : 'Aylık'} · {fmtMoney(sub.amount)} / ay
                </div>
              </div>
              <div style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: statusCfg.bg, color: statusCfg.color }}>
                {statusCfg.label}
              </div>
            </div>

            {/* İptal edildi ama dönem sonu bekliyor uyarısı */}
            {isCancelPending && (
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 13, color: '#fbbf24', lineHeight: 1.6 }}>
                Aboneliğiniz iptal edildi. <strong>{fmt(sub.current_period_end)}</strong> tarihine kadar tüm özellikleri kullanmaya devam edebilirsiniz.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Dönem Başlangıcı', val: fmt(sub.current_period_start) },
                { label: isCancelPending ? 'Erişim Sona Eriyor' : 'Sonraki Ödeme', val: fmt(sub.current_period_end) },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {isEffectivelyActive && !isCancelPending && (
                <button
                  onClick={() => setCancelModal(true)}
                  style={{ padding: '10px 20px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Aboneliği İptal Et
                </button>
              )}
              {canManageSubscription && (isCancelPending || sub.status === 'cancelled') && (
                <button
                  onClick={() => onNav && onNav('pricing')}
                  style={{ padding: '10px 20px', borderRadius: 9, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Aboneliği Yeniden Başlat
                </button>
              )}
              {canManageSubscription && !isCancelPending && sub.status !== 'cancelled' && (
                <button
                  onClick={() => onNav && onNav('pricing')}
                  style={{ padding: '10px 20px', borderRadius: 9, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', color: '#0d9488', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Plan Değiştir
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>Aktif abonelik yok</div>
            {trialDays !== null && trialDays > 0 ? (
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
                Deneme süreniz <strong style={{ color: '#fbbf24' }}>{trialDays} gün</strong> devam ediyor.
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
                Tüm özelliklere erişmek için bir plan seçin.
              </div>
            )}
            {canManageSubscription ? (
              <button
                onClick={() => onNav && onNav('pricing')}
                style={{ padding: '12px 28px', borderRadius: 10, background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
              >
                Planları Görüntüle
              </button>
            ) : (
              <div style={{ fontSize: 13, color: '#64748b', padding: '10px 0' }}>
                Aboneliğiniz ajansınız tarafından yönetilmektedir.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ödeme Geçmişi */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font)', fontSize: 16, color: '#f1f5f9', margin: 0 }}>Ödeme Geçmişi</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filterMonth}
              onChange={handleMonthChange}
              style={{ background: '#1e2535', border: '1px solid #2d3748', borderRadius: 8, color: '#cbd5e1', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
            >
              {MONTHS.map((label, i) => (
                <option key={i + 1} value={i + 1}>{label}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={handleYearChange}
              style={{ background: '#1e2535', border: '1px solid #2d3748', borderRadius: 8, color: '#cbd5e1', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {histLoading ? (
          <div style={{ background: '#161b27', border: '1px solid #1e2535', borderRadius: 12, padding: '28px 24px', color: '#64748b', fontSize: 13, textAlign: 'center' }}>
            Yükleniyor...
          </div>
        ) : history.length === 0 ? (
          <div style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(0,201,167,0.08)', borderRadius: 12, padding: '28px 24px', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            Bu dönemde ödeme kaydı yok.
          </div>
        ) : (
          <div style={{ background: 'rgba(13,27,42,0.6)', border: '1px solid rgba(0,201,167,0.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,201,167,0.05)', borderBottom: '1px solid rgba(0,201,167,0.1)' }}>
                  {['Tarih', 'Plan', 'Tutar', 'Durum', 'İşlem ID', 'Fatura'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, color: 'rgba(0,201,167,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((tx, i) => {
                  const stCfg = TX_STATUS[tx.status] || TX_STATUS.pending;
                  const invoiceUrl = downloadInvoice(tx.id);
                  return (
                    <tr key={tx.id} style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text2)' }}>{fmt(tx.created_at)}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>
                        {PLAN_LABELS[tx.plan] || tx.plan || '—'}
                        {tx.interval && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{tx.interval === 'yearly' ? 'Yıllık' : 'Aylık'}</span>}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#00C9A7', fontWeight: 600 }}>
                        {fmtMoney(tx.amount)}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: stCfg.color, background: `${stCfg.color}26`, border: `1px solid ${stCfg.color}4D`, padding: '3px 10px', borderRadius: 12 }}>
                          {stCfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                        {(tx.order_id || '').slice(0, 8)}…
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {tx.status === 'success' && (
                          <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(13,148,136,0.3)', background: 'rgba(13,148,136,0.07)' }}
                          >
                            PDF İndir
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => handlePage(page - 1)}
                  disabled={page <= 1}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: page <= 1 ? 'var(--text3)' : 'var(--text2)', fontWeight: 600, fontSize: 12, cursor: page <= 1 ? 'default' : 'pointer' }}
                >
                  ← Önceki
                </button>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Sayfa <strong style={{ color: 'var(--text1)' }}>{page}</strong> / {totalPages}
                </span>
                <button
                  onClick={() => handlePage(page + 1)}
                  disabled={page >= totalPages}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: page >= totalPages ? 'var(--text3)' : 'var(--text2)', fontWeight: 600, fontSize: 12, cursor: page >= totalPages ? 'default' : 'pointer' }}
                >
                  Sonraki →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
