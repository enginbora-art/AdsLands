import { useEffect, useState, useCallback } from 'react';
import { getBudget, getBudgetPlan, saveBudgetPlan } from '../api';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const CHANNELS = [
  { key: 'google_ads_budget', label: 'Google Ads', color: '#4285F4' },
  { key: 'meta_ads_budget',   label: 'Meta Ads',   color: '#1877F2' },
  { key: 'tiktok_ads_budget', label: 'TikTok Ads', color: '#00BFA6' },
];

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const parseTR = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

function alertLevel(burnRate) {
  if (burnRate >= 100) return 'red';
  if (burnRate >= 90) return 'yellow';
  return 'green';
}

function BudgetModal({ month, year, existing, onSave, onClose }) {
  const [form, setForm] = useState({
    month: existing?.month ?? month,
    year: existing?.year ?? year,
    total_budget: existing?.total_budget ?? '',
    google_ads_budget: existing?.google_ads_budget ?? '',
    meta_ads_budget: existing?.meta_ads_budget ?? '',
    tiktok_ads_budget: existing?.tiktok_ads_budget ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.total_budget) return;
    setSaving(true);
    try {
      const saved = await saveBudgetPlan({
        month: parseInt(form.month),
        year: parseInt(form.year),
        total_budget: parseTR(form.total_budget),
        google_ads_budget: parseTR(form.google_ads_budget),
        meta_ads_budget: parseTR(form.meta_ads_budget),
        tiktok_ads_budget: parseTR(form.tiktok_ads_budget),
      });
      onSave(saved);
    } finally {
      setSaving(false);
    }
  };

  const channelSum = CHANNELS.reduce((s, c) => s + parseTR(form[c.key]), 0);
  const total = parseTR(form.total_budget);
  const unallocated = total - channelSum;

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <span style={ms.title}>Bütçe Belirle</span>
          <button onClick={onClose} style={ms.close}>✕</button>
        </div>

        <div style={ms.body}>
          <div style={ms.row}>
            <div style={ms.field}>
              <label style={ms.label}>Ay</label>
              <select style={ms.select} value={form.month} onChange={e => set('month', e.target.value)}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div style={ms.field}>
              <label style={ms.label}>Yıl</label>
              <select style={ms.select} value={form.year} onChange={e => set('year', e.target.value)}>
                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div style={ms.field}>
            <label style={ms.label}>Toplam Bütçe (₺)</label>
            <input
              style={ms.input}
              type="number"
              min="0"
              placeholder="örn: 150000"
              value={form.total_budget}
              onChange={e => set('total_budget', e.target.value)}
            />
          </div>

          <div style={ms.divider} />
          <div style={{ ...ms.label, marginBottom: 12 }}>Kanal Bazında Dağılım</div>

          {CHANNELS.map(ch => (
            <div key={ch.key} style={ms.field}>
              <label style={{ ...ms.label, color: ch.color }}>{ch.label} (₺)</label>
              <input
                style={ms.input}
                type="number"
                min="0"
                placeholder="0"
                value={form[ch.key]}
                onChange={e => set(ch.key, e.target.value)}
              />
            </div>
          ))}

          {total > 0 && (
            <div style={{
              ...ms.allocInfo,
              background: unallocated < 0 ? 'rgba(255,107,90,0.1)' : 'rgba(0,191,166,0.08)',
              borderColor: unallocated < 0 ? 'rgba(255,107,90,0.3)' : 'rgba(0,191,166,0.2)',
            }}>
              <span>Dağıtılan:</span>
              <span>₺{fmt(channelSum)} / ₺{fmt(total)}</span>
              <span style={{ color: unallocated < 0 ? 'var(--coral)' : 'var(--teal)', fontWeight: 700 }}>
                {unallocated < 0 ? `₺${fmt(Math.abs(unallocated))} fazla` : `₺${fmt(unallocated)} kaldı`}
              </span>
            </div>
          )}
        </div>

        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>İptal</button>
          <button
            style={{ ...ms.saveBtn, opacity: saving || !form.total_budget ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving || !form.total_budget}
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Budget() {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [mockData, setMockData] = useState(null);
  const [budgetPlan, setBudgetPlan] = useState(undefined); // undefined=yükleniyor, null=yok, obj=var
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { getBudget().then(setMockData); }, []);

  const loadPlan = useCallback(() => {
    getBudgetPlan(selMonth, selYear).then(setBudgetPlan);
  }, [selMonth, selYear]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const handleSave = (saved) => {
    setBudgetPlan(saved);
    setShowModal(false);
  };

  if (!mockData) return <div className="loading">Yükleniyor...</div>;

  // Gerçek harcama verisi mock'tan, bütçe DB'den
  const totalBudget = budgetPlan ? Number(budgetPlan.total_budget) : null;
  const spent = mockData.spent;
  const remaining = totalBudget !== null ? totalBudget - spent : null;
  const burnRate = totalBudget ? Math.round((spent / totalBudget) * 100 * 10) / 10 : null;
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const dayOfMonth = selMonth === now.getMonth() + 1 && selYear === now.getFullYear()
    ? now.getDate() : daysInMonth;
  const forecast = dayOfMonth > 0 && totalBudget
    ? Math.round((spent / dayOfMonth) * daysInMonth)
    : null;

  const level = burnRate !== null ? alertLevel(burnRate) : null;

  // Kanal harcamaları (mock'tan) + kanal bütçeleri (DB'den)
  const channelData = mockData.channels.map(ch => {
    const planKey = ch.name === 'Google Ads' ? 'google_ads_budget'
      : ch.name === 'Meta Ads' ? 'meta_ads_budget'
      : 'tiktok_ads_budget';
    const chBudget = budgetPlan ? Number(budgetPlan[planKey]) : ch.budget;
    return { ...ch, budget: chBudget };
  });

  return (
    <div className="fade-in">
      {showModal && (
        <BudgetModal
          month={selMonth}
          year={selYear}
          existing={budgetPlan}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="topbar">
        <div className="topbar-title">Bütçe Planlama</div>
        <div className="topbar-right" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Ay seçici */}
          <div style={s.monthPicker}>
            <button style={s.arrowBtn} onClick={() => {
              if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1); }
              else setSelMonth(m => m - 1);
            }}>‹</button>
            <span style={s.monthLabel}>{MONTHS[selMonth - 1]} {selYear}</span>
            <button style={s.arrowBtn} onClick={() => {
              if (selMonth === 12) { setSelMonth(1); setSelYear(y => y + 1); }
              else setSelMonth(m => m + 1);
            }}>›</button>
          </div>
          <button className="btn-export" onClick={() => setShowModal(true)}>
            {budgetPlan ? 'Bütçeyi Düzenle' : '+ Bütçe Belirle'}
          </button>
        </div>
      </div>

      <div className="content">
        {/* Metrik kartları */}
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {/* Toplam bütçe */}
          <div className="metric-card teal">
            <div className="metric-label">Toplam Bütçe</div>
            {totalBudget !== null ? (
              <>
                <div className="metric-value">₺{fmt(totalBudget)}</div>
                <div className="metric-sub">{MONTHS[selMonth - 1]} {selYear}</div>
              </>
            ) : (
              <>
                <div className="metric-value" style={{ fontSize: 16, color: 'var(--text3)' }}>Belirlenmedi</div>
                <button
                  onClick={() => setShowModal(true)}
                  style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--teal)',
                    background: 'none', border: '1px solid var(--teal)', borderRadius: 6,
                    padding: '3px 10px', cursor: 'pointer' }}
                >
                  Bütçe Belirle
                </button>
              </>
            )}
          </div>

          {/* Harcanan */}
          <div className="metric-card purple">
            <div className="metric-label">Harcanan</div>
            <div className="metric-value">₺{fmt(spent)}</div>
            {burnRate !== null && (
              <span
                className="metric-change down"
                style={{ color: level === 'red' ? 'var(--coral)' : level === 'yellow' ? 'var(--amber)' : undefined }}
              >
                %{burnRate} kullanıldı
                {level === 'red' && ' ⚠'}
              </span>
            )}
          </div>

          {/* Kalan */}
          <div
            className="metric-card amber"
            style={level === 'red' ? { borderColor: 'rgba(255,107,90,0.4)', background: 'rgba(255,107,90,0.06)' }
              : level === 'yellow' ? { borderColor: 'rgba(255,181,71,0.4)' } : {}}
          >
            <div className="metric-label">Kalan</div>
            {remaining !== null ? (
              <>
                <div
                  className="metric-value"
                  style={{ color: remaining < 0 ? 'var(--coral)' : undefined }}
                >
                  {remaining < 0 ? '-' : ''}₺{fmt(Math.abs(remaining))}
                </div>
                <div className="metric-sub" style={{ color: level === 'red' ? 'var(--coral)' : level === 'yellow' ? 'var(--amber)' : undefined }}>
                  {level === 'red' ? '⚠ Bütçe aşıldı' : level === 'yellow' ? '⚠ Bütçe doluyor' : 'Ay sonuna kalan'}
                </div>
              </>
            ) : (
              <div className="metric-value" style={{ fontSize: 16, color: 'var(--text3)' }}>—</div>
            )}
          </div>

          {/* Ay sonu tahmini */}
          <div
            className="metric-card coral"
            style={forecast !== null && totalBudget && forecast > totalBudget
              ? { borderColor: 'rgba(255,107,90,0.4)', background: 'rgba(255,107,90,0.06)' } : {}}
          >
            <div className="metric-label">Ay Sonu Tahmini</div>
            {forecast !== null ? (
              <>
                <div
                  className="metric-value"
                  style={{ color: totalBudget && forecast > totalBudget ? 'var(--coral)' : undefined }}
                >
                  ₺{fmt(forecast)}
                </div>
                <span
                  className="metric-change up"
                  style={{ color: totalBudget && forecast > totalBudget ? 'var(--coral)' : 'var(--success)' }}
                >
                  {totalBudget && forecast > totalBudget
                    ? `₺${fmt(forecast - totalBudget)} aşım bekleniyor`
                    : 'Bütçe dahilinde'}
                </span>
              </>
            ) : (
              <div className="metric-value" style={{ fontSize: 16, color: 'var(--text3)' }}>—</div>
            )}
          </div>
        </div>

        {/* Uyarı banner */}
        {level === 'red' && (
          <div style={{ ...s.alertBanner, background: 'rgba(255,107,90,0.1)', borderColor: 'rgba(255,107,90,0.35)', color: 'var(--coral)' }}>
            ⚠ Bütçeniz aşıldı! {MONTHS[selMonth - 1]} bütçesini revize etmeyi düşünün.
          </div>
        )}
        {level === 'yellow' && (
          <div style={{ ...s.alertBanner, background: 'rgba(255,181,71,0.1)', borderColor: 'rgba(255,181,71,0.35)', color: 'var(--amber)' }}>
            ⚠ Bütçenizin %{burnRate}'i kullanıldı. Harcama hızını izleyin.
          </div>
        )}

        {/* Kanal bütçe durumu */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Kanal Bütçe Durumu</div>
            {!budgetPlan && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                Bütçe girilmemiş — mock değerler gösteriliyor
              </span>
            )}
          </div>
          <div className="card-body">
            {channelData.map(ch => {
              const pct = ch.budget > 0 ? (ch.spent / ch.budget) * 100 : 0;
              const chLevel = alertLevel(pct);
              return (
                <div key={ch.name} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ch.color }}>{ch.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                      ₺{fmt(ch.spent)} / ₺{fmt(ch.budget)}
                      {chLevel !== 'green' && (
                        <span style={{ marginLeft: 8, color: chLevel === 'red' ? 'var(--coral)' : 'var(--amber)', fontWeight: 700 }}>
                          %{Math.round(pct)} {chLevel === 'red' ? '⚠' : ''}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="budget-bar-wrap">
                    <div
                      className="budget-bar-fill"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: chLevel === 'red' ? 'var(--coral)' : chLevel === 'yellow' ? 'var(--amber)' : ch.color,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                  {chLevel === 'green' && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      %{Math.round(pct)} kullanıldı
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kampanya tablosu */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Kampanya Detayları</div>
            <div className="card-subtitle">Tüm aktif kampanyalar</div>
          </div>
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Kampanya</th><th>Kanal</th><th>Bütçe</th>
                <th>Harcanan</th><th>ROAS</th><th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {mockData.campaigns.map(c => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td style={{ color: c.channel === 'Google' ? 'var(--blue)' : 'var(--purple)' }}>{c.channel}</td>
                  <td>₺{fmt(c.budget)}</td>
                  <td>₺{fmt(c.spent)}</td>
                  <td style={{ color: c.roas >= 4 ? 'var(--success)' : c.roas >= 3 ? 'var(--amber)' : 'var(--danger)' }}>{c.roas}x</td>
                  <td>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: c.status === 'active' ? 'rgba(52,211,153,0.15)' : 'rgba(255,181,71,0.15)',
                      color: c.status === 'active' ? 'var(--success)' : 'var(--amber)',
                    }}>
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

const s = {
  monthPicker: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '5px 10px',
  },
  arrowBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text2)', fontSize: 18, lineHeight: 1, padding: '0 2px',
  },
  monthLabel: { fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' },
  alertBanner: {
    marginBottom: 20, borderRadius: 10, border: '1px solid',
    padding: '10px 16px', fontSize: 13, fontWeight: 600,
  },
};

const ms = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--bg1)', border: '1px solid var(--border2)',
    borderRadius: 14, width: 420, maxWidth: '95vw',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)',
  },
  title: { fontSize: 16, fontWeight: 700 },
  close: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' },
  body: { padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 },
  footer: {
    padding: '14px 22px 18px', borderTop: '1px solid var(--border2)',
    display: 'flex', gap: 10, justifyContent: 'flex-end',
  },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: {
    padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 8, color: 'var(--text1)', fontSize: 14, outline: 'none',
  },
  select: {
    padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 8, color: 'var(--text1)', fontSize: 14, outline: 'none',
  },
  divider: { borderTop: '1px solid var(--border2)', margin: '2px 0' },
  allocInfo: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', borderRadius: 8, border: '1px solid',
    fontSize: 12, fontWeight: 600,
  },
  cancelBtn: {
    padding: '8px 20px', background: 'transparent', border: '1px solid var(--border2)',
    borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 24px', background: 'var(--teal)', border: 'none',
    borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
};
