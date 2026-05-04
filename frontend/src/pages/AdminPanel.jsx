import { useState, useEffect } from 'react';
import { adminGetCompanies, adminCreateCompany, adminUpdateCompany, adminGetAiUsage, adminGetAiQueue, adminClearAiQueue, adminSetAiConcurrency, adminExportReport, adminGetPlanPrices, adminUpdatePlanPrice, adminGetAppSettings, adminUpdateAppSetting, adminGetBenchmarks, adminUpdateBenchmark } from '../api';
import { PLAN_LABELS, PLAN_FILTER_OPTIONS, PLAN_RANK } from '../config/plans';

const fmt = (d) => new Date(d).toLocaleDateString('tr-TR');

const SECTORS = [
  'E-ticaret', 'Perakende', 'Finans & Sigorta', 'Otomotiv',
  'Gıda & İçecek', 'Turizm & Seyahat', 'Teknoloji & SaaS',
  'Sağlık & Güzellik', 'Eğitim', 'Gayrimenkul', 'Medya & Eğlence', 'Diğer',
];

const inp = {
  padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border2)',
  borderRadius: 8, color: 'var(--text1)', fontSize: 14, width: '100%', boxSizing: 'border-box',
};
const fieldLabel = {
  display: 'block', fontSize: 11, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600,
};

function PlanBadge({ status, plan, cancelAtPeriodEnd, periodEnd }) {
  const dateLabel = (status === 'active' || status === 'cancelling') && periodEnd
    ? new Date(periodEnd).toLocaleDateString('tr-TR') + "'ya kadar"
    : null;

  if (status === 'active') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span style={{ background: 'rgba(0,191,166,0.12)', color: 'var(--teal)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          {PLAN_LABELS[plan] || plan || 'Aktif'}
        </span>
        {dateLabel && <span style={{ fontSize: 10, color: 'var(--text3)', paddingLeft: 2 }}>{dateLabel}</span>}
      </div>
    );
  }
  if (status === 'cancelling') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          İptal Süreci
        </span>
        {dateLabel && <span style={{ fontSize: 10, color: 'var(--text3)', paddingLeft: 2 }}>{dateLabel}</span>}
      </div>
    );
  }
  if (status === 'trial') {
    return (
      <span style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
        Deneme
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span style={{ background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
        İptal
      </span>
    );
  }
  return (
    <span style={{ background: 'rgba(148,163,179,0.1)', color: 'var(--text3)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
      Pasif
    </span>
  );
}

function ActivityCell({ months }) {
  const n = parseInt(months) || 0;
  if (n === 0) return <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>;
  return <span style={{ color: 'var(--text2)', fontSize: 12 }}>{n} ay</span>;
}

function CreateModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', type: 'brand', sector: '', admin_email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sector) { setError('Sektör seçimi zorunludur.'); return; }
    setLoading(true);
    setError('');
    try {
      await adminCreateCompany(form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Yeni Şirket Oluştur</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Şirket Adı</label>
            <input style={inp} placeholder="Şirket / Marka adı"
              value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Şirket Tipi</label>
            <select style={inp} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="brand">Marka</option>
              <option value="agency">Ajans</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Sektör <span style={{ color: 'var(--coral)' }}>*</span></label>
            <select style={inp} value={form.sector} onChange={e => set('sector', e.target.value)}>
              <option value="">— Seçiniz —</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={fieldLabel}>Admin E-posta</label>
            <input style={inp} type="email" placeholder="admin@sirket.com"
              value={form.admin_email} onChange={e => set('admin_email', e.target.value)} required />
          </div>
          {error && (
            <div style={{ background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '10px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Oluşturuluyor...' : 'Oluştur & Mail Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectorCell({ company, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [sector, setSector] = useState(company.sector || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdateCompany(company.id, { sector });
      await onUpdate();
      setEditing(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <select value={sector} onChange={e => setSector(e.target.value)}
          style={{ ...inp, padding: '4px 8px', fontSize: 12, width: 'auto' }}>
          <option value="">—</option>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={save} disabled={saving}
          style={{ padding: '3px 8px', background: 'var(--teal)', border: 'none', borderRadius: 5, color: '#0B1219', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          ✓
        </button>
        <button onClick={() => { setEditing(false); setSector(company.sector || ''); }}
          style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
          ✕
        </button>
      </span>
    );
  }

  return (
    <span onClick={() => setEditing(true)}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: sector ? 'var(--text2)' : 'var(--text3)', fontSize: 12 }}>
      {sector || '— ekle'}
      <span style={{ opacity: 0.5, fontSize: 11 }}>✎</span>
    </span>
  );
}

function CompanyRow({ c, indent = false, onUpdate }) {
  return (
    <tr key={c.id}>
      <td style={{ fontWeight: indent ? 500 : 600, paddingLeft: indent ? 32 : 16 }}>
        {indent && <span style={{ color: 'var(--text3)', marginRight: 6, fontSize: 11 }}>↳</span>}
        {c.name}
      </td>
      <td>
        <span style={{ background: c.type === 'agency' ? 'rgba(167,139,250,0.15)' : 'rgba(0,191,166,0.12)', color: c.type === 'agency' ? '#A78BFA' : 'var(--teal)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
          {c.type === 'agency' ? 'Ajans' : 'Marka'}
        </span>
      </td>
      <td><SectorCell company={c} onUpdate={onUpdate} /></td>
      <td style={{ fontSize: 12, color: c.admin_email ? 'var(--text2)' : 'var(--text3)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.admin_email || 'Admin yok'}
      </td>
      <td>
        {indent
          ? <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
          : <PlanBadge status={c.plan_status} plan={c.plan} cancelAtPeriodEnd={c.cancel_at_period_end} periodEnd={c.current_period_end} />
        }
      </td>
      <td><ActivityCell months={c.months_active} /></td>
      <td style={{ color: 'var(--text2)', fontSize: 12 }}>{c.user_count}</td>
      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(c.created_at)}</td>
    </tr>
  );
}

function AgencyGroup({ agency, onUpdate }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasBrands = agency.brands?.length > 0;

  return (
    <>
      <tr style={{ background: 'rgba(167,139,250,0.04)' }}>
        <td style={{ fontWeight: 700, paddingLeft: 16 }}>
          {hasBrands && (
            <button onClick={() => setCollapsed(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', marginRight: 6, fontSize: 12, padding: 0 }}>
              {collapsed ? '▶' : '▼'}
            </button>
          )}
          {agency.name}
          {hasBrands && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
              {agency.brands.length} marka
            </span>
          )}
        </td>
        <td>
          <span style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
            Ajans
          </span>
        </td>
        <td><SectorCell company={agency} onUpdate={onUpdate} /></td>
        <td style={{ fontSize: 12, color: agency.admin_email ? 'var(--text2)' : 'var(--text3)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agency.admin_email || 'Admin yok'}
        </td>
        <td><PlanBadge status={agency.plan_status} plan={agency.plan} cancelAtPeriodEnd={agency.cancel_at_period_end} periodEnd={agency.current_period_end} /></td>
        <td><ActivityCell months={agency.months_active} /></td>
        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{agency.user_count}</td>
        <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(agency.created_at)}</td>
      </tr>
      {!collapsed && hasBrands && agency.brands.map(brand => (
        <CompanyRow key={brand.id} c={brand} indent onUpdate={onUpdate} />
      ))}
    </>
  );
}

const FEATURE_LABELS = {
  channel_analysis: 'Kanal Analizi',
  ai_report:        'AI Rapor',
  kpi_analysis:     'KPI Analizi',
};

function QueueMonitor() {
  const [data, setData]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tick, setTick]             = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing]     = useState(false);
  const [settingConcurrency, setSettingConcurrency] = useState(false);
  const [actionMsg, setActionMsg]   = useState('');

  // Poll every 5 seconds
  useEffect(() => {
    const poll = () => adminGetAiQueue().then(d => { setData(d); setLastUpdated(Date.now()); }).catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // Live 1-second tick for elapsed counters
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const flash = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 5000); };

  const handleClear = async () => {
    setClearing(true);
    try {
      const r = await adminClearAiQueue();
      flash(`✓ ${r.message}`);
      setConfirmClear(false);
      adminGetAiQueue().then(d => { setData(d); setLastUpdated(Date.now()); }).catch(() => {});
    } catch { flash('Queue temizlenemedi.'); }
    finally { setClearing(false); }
  };

  const handleConcurrency = async (n) => {
    setSettingConcurrency(true);
    try {
      const r = await adminSetAiConcurrency(n);
      flash(`✓ ${r.message}`);
      adminGetAiQueue().then(d => { setData(d); setLastUpdated(Date.now()); }).catch(() => {});
    } catch { flash('Kapasite güncellenemedi.'); }
    finally { setSettingConcurrency(false); }
  };

  if (!data) return <div style={{ textAlign: 'center', padding: 32, color: 'var(--text3)', fontSize: 13 }}>Queue bilgisi yükleniyor...</div>;

  const { queue, last_1h, active_requests } = data;
  const waiting     = queue.waiting;
  const fillPct     = queue.concurrency > 0 ? Math.round(queue.processing / queue.concurrency * 100) : 0;
  const waitColor   = waiting >= 8 ? '#EF4444' : waiting >= 3 ? '#F59E0B' : '#10B981';
  const secAgo      = lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) : '—';

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: waitColor, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>Queue Durumu</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Son güncelleme: {secAgo}sn önce</span>
      </div>

      {/* Critical alert */}
      {waiting >= 8 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#EF4444' }}>
          🔴 Queue yoğunluğu kritik seviyede — {waiting} istek bekliyor
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Bekleyen',  value: waiting,        color: waitColor },
          { label: 'İşlenen',   value: queue.processing, color: '#60A5FA' },
          { label: 'Kapasite',  value: queue.concurrency, color: 'var(--text2)' },
          { label: 'Doluluk',   value: `%${fillPct}`,  color: fillPct >= 80 ? '#F59E0B' : 'var(--teal)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Last 1h */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Son 1 Saat</div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Toplam İstek',   value: last_1h.total_requests },
            { label: 'Ort. Bekleme',   value: `${last_1h.avg_wait_time_ms}ms` },
            { label: 'Ort. İşlem',     value: `${last_1h.avg_process_time_ms}ms` },
            { label: 'Hata',           value: last_1h.errors, color: last_1h.errors > 0 ? 'var(--coral)' : undefined },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color || 'var(--text1)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active requests */}
      {active_requests.length > 0 && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border2)', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>
            Aktif İşlemler ({active_requests.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Şirket', 'Özellik', 'Başlangıç', 'Geçen Süre'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text3)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', background: 'var(--bg2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active_requests.map((r, i) => {
                const elapsed = r.elapsed_seconds + (lastUpdated ? Math.floor((Date.now() - lastUpdated) / 1000) : 0);
                const stuck   = elapsed > 60;
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border2)' }}>
                    <td style={{ padding: '7px 12px', fontSize: 13, color: 'var(--text1)' }}>{r.company_name}</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text3)' }}>{FEATURE_LABELS[r.feature] || r.feature}</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text3)' }}>{new Date(r.started_at).toLocaleTimeString('tr-TR')}</td>
                    <td style={{ padding: '7px 12px', fontSize: 13, fontWeight: 700, color: stuck ? 'var(--coral)' : 'var(--teal)' }}>
                      {elapsed}s{stuck ? ' ⚠' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action message */}
      {actionMsg && (
        <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, padding: '7px 12px', marginBottom: 12, fontSize: 13, color: 'var(--teal)' }}>{actionMsg}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} disabled={waiting === 0}
            style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${waiting > 0 ? 'rgba(255,107,90,0.5)' : 'var(--border2)'}`, borderRadius: 7, color: waiting > 0 ? 'var(--coral)' : 'var(--text3)', fontSize: 12, cursor: waiting > 0 ? 'pointer' : 'default' }}>
            Queue'yu Temizle
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{waiting} istek iptal edilecek. Emin misiniz?</span>
            <button onClick={handleClear} disabled={clearing}
              style={{ padding: '5px 12px', background: 'var(--coral)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {clearing ? 'Temizleniyor...' : 'Evet, Temizle'}
            </button>
            <button onClick={() => setConfirmClear(false)}
              style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>
              İptal
            </button>
          </div>
        )}

        <div>
          {queue.concurrency < 10 ? (
            <button onClick={() => handleConcurrency(10)} disabled={settingConcurrency}
              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
              {settingConcurrency ? 'Güncelleniyor...' : 'Kapasiteyi Artır (→10)'}
            </button>
          ) : (
            <button onClick={() => handleConcurrency(5)} disabled={settingConcurrency}
              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 7, color: '#F59E0B', fontSize: 12, cursor: 'pointer' }}>
              {settingConcurrency ? 'Güncelleniyor...' : 'Kapasiteyi Azalt (→5)'}
            </button>
          )}
          {queue.concurrency >= 10 && (
            <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 3 }}>
              ⚠ Yüksek kapasite Anthropic rate limitine takılma riskini artırır
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AiUsageTab() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminGetAiUsage(month)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month]);

  const fmtTry = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtUsd = (v) => `$${Number(v || 0).toFixed(4)}`;

  return (
    <div>
      <QueueMonitor />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)' }}>Ay:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text1)', fontSize: 13 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Veri alınamadı.</div>
      ) : (
        <>
          {/* Özet kartlar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Toplam Maliyet (TL)', value: fmtTry(data.total_cost_try), color: '#00BFA6' },
              { label: 'Toplam Maliyet (USD)', value: fmtUsd(data.total_cost_usd), color: '#60A5FA' },
              { label: 'Toplam İstek', value: (data.total_requests || 0).toLocaleString('tr-TR'), color: '#A78BFA' },
              { label: 'Toplam Input Token', value: (data.total_input_tokens || 0).toLocaleString('tr-TR'), color: 'var(--text2)' },
              { label: 'Toplam Output Token', value: (data.total_output_tokens || 0).toLocaleString('tr-TR'), color: 'var(--text2)' },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Özellik bazında */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Özellik Bazında</div>
            {data.by_feature?.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Bu ay AI kullanımı yok.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Özellik', 'İstek', 'Maliyet (TL)', 'Maliyet (USD)', 'Input Token', 'Output Token'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.by_feature || []).map(row => (
                    <tr key={row.feature} style={{ borderTop: '1px solid var(--border2)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)' }}>{FEATURE_LABELS[row.feature] || row.feature}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{row.requests}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#00BFA6', fontWeight: 600 }}>{fmtTry(row.cost_try)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#60A5FA' }}>{fmtUsd(row.cost_usd)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>{Number(row.input_tokens).toLocaleString('tr-TR')}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>{Number(row.output_tokens).toLocaleString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Şirket bazında */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Şirket Bazında</div>
            {data.by_company?.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Bu ay AI kullanımı yok.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Şirket', 'Tip', 'İstek', 'Maliyet (TL)', 'Maliyet (USD)'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.by_company || []).map(row => (
                    <tr key={row.id} style={{ borderTop: '1px solid var(--border2)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)' }}>{row.company_name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: row.company_type === 'agency' ? 'rgba(167,139,250,0.15)' : 'rgba(96,165,250,0.15)',
                          color: row.company_type === 'agency' ? '#A78BFA' : '#60A5FA' }}>
                          {row.company_type === 'agency' ? 'Ajans' : 'Marka'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{row.requests}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#00BFA6', fontWeight: 600 }}>{fmtTry(row.cost_try)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#60A5FA' }}>{fmtUsd(row.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const now0 = new Date();
const defaultMonth = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}`;

// PLAN_FILTER_OPTIONS — imported from config/plans.js

function matchesPlan(c, planFilter) {
  if (planFilter === 'all') return true;
  if (planFilter === 'trial') return c.plan_status === 'trial';
  if (planFilter === 'pasif') return c.plan_status === 'inactive' || c.plan_status === 'cancelled' || !c.plan_status;
  return c.plan === planFilter;
}

function getSortFn(sortBy) {
  const planRank = PLAN_RANK;
  switch (sortBy) {
    case 'activity': return (a, b) => (parseInt(b.months_active) || 0) - (parseInt(a.months_active) || 0);
    case 'plan':     return (a, b) => (planRank[b.plan] || 0) - (planRank[a.plan] || 0);
    case 'revenue':  return (a, b) => (Number(b.monthly_amount) || 0) - (Number(a.monthly_amount) || 0);
    default:         return (a, b) => new Date(b.created_at) - new Date(a.created_at);
  }
}

// focus-aware Turkish number input: shows 20.000 when blurred, 20000 when focused
function PriceInput({ value, onChange, label, suffix = '₺', max }) {
  // localStr holds the raw string while the input is focused so mid-edit
  // states like '' or '2' don't get parsed/clobbered by the parent re-render.
  const [localStr, setLocalStr] = useState(null); // null = not focused
  const isFocused = localStr !== null;

  const handleFocus = () => {
    // seed local string from current prop, strip formatting chars
    const seed = String(value ?? '').replace(/\./g, '').replace(/[^0-9]/g, '');
    setLocalStr(seed);
  };

  const handleChange = (e) => {
    const cleaned = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    if (max !== undefined && cleaned !== '' && parseInt(cleaned, 10) > max) return;
    setLocalStr(cleaned);
    // propagate as string while typing; parent stores it in edits as-is
    onChange(cleaned === '' ? '' : parseInt(cleaned, 10));
  };

  const handleBlur = () => {
    const parsed = localStr === '' || localStr === null ? 0 : (parseInt(localStr, 10) || 0);
    setLocalStr(null);
    onChange(parsed);
  };

  // Display: while focused show raw string; blurred show TR-formatted number
  const blurredNum = parseInt(String(value ?? '').replace(/\./g, '').replace(/[^0-9]/g, '') || '0', 10);
  const displayed = isFocused
    ? localStr
    : (blurredNum ? blurredNum.toLocaleString('tr-TR') : '');

  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div style={{ position: 'relative' }}>
        {!isFocused && displayed && (
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)', pointerEvents: 'none' }}>{suffix}</span>
        )}
        <input
          inputMode="numeric"
          value={displayed}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          style={{ ...inp, fontFamily: 'monospace', paddingLeft: !isFocused && displayed ? 22 : 9 }}
        />
      </div>
    </div>
  );
}

function PlanPriceCard({ row, edits, onField, onSave, saving, msg }) {
  const key = row.plan_key;
  const dirty = !!(edits[key] && Object.keys(edits[key]).length);
  const isSaving = !!saving[key];

  const getValue = (field) =>
    edits[key]?.[field] !== undefined
      ? edits[key][field]
      : (field === 'yearly_discount_pct' ? Number(row.yearly_discount_pct) : Number(row[field]));

  const fmtDate = (d) => d
    ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div style={{
      background: 'var(--bg)', border: `1px solid ${dirty ? 'rgba(13,148,136,0.4)' : 'var(--border2)'}`,
      borderRadius: 10, padding: '14px 16px',
      transition: 'border-color .2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{PLAN_LABELS[key] || key}</span>
          {!row.is_active && (
            <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>Pasif</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {msg === 'ok' && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>✓ Kaydedildi</span>}
          {msg && msg !== 'ok' && <span style={{ fontSize: 11, color: '#ef4444' }}>{msg}</span>}
          <button
            onClick={() => onSave(key)}
            disabled={!dirty || isSaving}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700,
              cursor: dirty && !isSaving ? 'pointer' : 'not-allowed',
              background: dirty ? 'var(--teal)' : 'var(--bg2)',
              color: dirty ? '#0B1219' : 'var(--text3)',
              transition: 'all .2s', whiteSpace: 'nowrap',
            }}
          >
            {isSaving ? '…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* 3 inputs in one row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
        <PriceInput
          label="Aylık (₺)"
          value={getValue('monthly_price')}
          onChange={v => onField(key, 'monthly_price', v)}
        />
        <PriceInput
          label="Yıllık (₺/ay)"
          value={getValue('yearly_price')}
          onChange={v => onField(key, 'yearly_price', v)}
        />
        <div>
          <label style={fieldLabel}>İndirim %</label>
          <input
            type="number" min="0" max="100" step="1"
            value={getValue('yearly_discount_pct')}
            onChange={e => onField(key, 'yearly_discount_pct', Number(e.target.value))}
            style={{ ...inp, fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text3)' }}>
        {fmtDate(row.updated_at)}{row.updated_by_email ? ` · ${row.updated_by_email}` : ''}
      </div>
    </div>
  );
}

function PlanPricesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs] = useState({});

  useEffect(() => {
    adminGetPlanPrices()
      .then(data => { setRows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const setField = (key, field, val) =>
    setEdits(p => ({ ...p, [key]: { ...(p[key] || {}), [field]: val } }));

  const handleSave = async (planKey) => {
    const patch = edits[planKey];
    if (!patch || !Object.keys(patch).length) return;
    setSaving(p => ({ ...p, [planKey]: true }));
    setMsgs(p => ({ ...p, [planKey]: '' }));
    try {
      const updated = await adminUpdatePlanPrice(planKey, patch);
      setRows(prev => prev.map(r => r.plan_key === planKey ? { ...r, ...updated } : r));
      setEdits(p => { const n = { ...p }; delete n[planKey]; return n; });
      setMsgs(p => ({ ...p, [planKey]: 'ok' }));
      setTimeout(() => setMsgs(p => ({ ...p, [planKey]: '' })), 2500);
    } catch (err) {
      setMsgs(p => ({ ...p, [planKey]: err.response?.data?.error || 'Hata' }));
    } finally {
      setSaving(p => ({ ...p, [planKey]: false }));
    }
  };

  if (loading) return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Yükleniyor…</div>;

  const agencyRows = rows.filter(r => r.plan_key.startsWith('agency_'));
  const brandRows  = rows.filter(r => r.plan_key.startsWith('brand_'));

  const colProps = { edits, onField: setField, onSave: handleSave, saving, msgs };

  const Column = ({ title, accent, plans }) => (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${accent}33` }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map(row => (
          <PlanPriceCard key={row.plan_key} row={row} {...colProps} msg={msgs[row.plan_key]} />
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Plan Fiyatları</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Değişiklikler anında yansır, deploy gerekmez.</div>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Column title="Ajans Planları" accent="#0d9488" plans={agencyRows} />
        <Column title="Marka Planları" accent="#8b5cf6" plans={brandRows} />
      </div>
    </div>
  );
}

function AppSettingsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs] = useState({});

  useEffect(() => {
    adminGetAppSettings()
      .then(data => { setRows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getValue = (row) => edits[row.key] !== undefined ? edits[row.key] : row.value;
  const setField = (key, val) => setEdits(p => ({ ...p, [key]: val }));

  const handleSave = async (key) => {
    if (edits[key] === undefined) return;
    setSaving(p => ({ ...p, [key]: true }));
    setMsgs(p => ({ ...p, [key]: '' }));
    try {
      const updated = await adminUpdateAppSetting(key, edits[key]);
      setRows(prev => prev.map(r => r.key === key ? { ...r, ...updated } : r));
      setEdits(p => { const n = { ...p }; delete n[key]; return n; });
      setMsgs(p => ({ ...p, [key]: 'ok' }));
      setTimeout(() => setMsgs(p => ({ ...p, [key]: '' })), 2000);
    } catch (err) {
      setMsgs(p => ({ ...p, [key]: err.response?.data?.error || 'Hata' }));
    } finally {
      setSaving(p => ({ ...p, [key]: false }));
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Yükleniyor…</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Uygulama Ayarları</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Değişiklikler 5 dakika içinde tüm servislere yansır (JWT hariç — restart gerekir).</div>
      </div>

      <div style={{ border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border2)' }}>
              {['Ayar', 'Değer', 'Açıklama', 'Son Güncelleme', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const dirty = edits[row.key] !== undefined;
              const msg = msgs[row.key];
              return (
                <tr key={row.key} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border2)' : 'none', background: dirty ? 'rgba(13,148,136,0.04)' : 'transparent' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--teal)', whiteSpace: 'nowrap' }}>{row.key}</td>
                  <td style={{ padding: '10px 14px', minWidth: 140 }}>
                    <input
                      value={getValue(row)}
                      onChange={e => setField(row.key, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(row.key); }}
                      style={{ ...inp, width: 130, fontFamily: 'monospace', fontSize: 13 }}
                    />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', maxWidth: 280 }}>{row.description || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {fmtDate(row.updated_at)}
                    {row.updated_by_email && <div style={{ fontSize: 10 }}>{row.updated_by_email}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    {msg === 'ok' && <span style={{ fontSize: 12, color: '#22c55e' }}>✓</span>}
                    {msg && msg !== 'ok' && <span style={{ fontSize: 11, color: '#ef4444' }}>{msg}</span>}
                    <button
                      onClick={() => handleSave(row.key)}
                      disabled={!dirty || saving[row.key]}
                      style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: dirty ? 'pointer' : 'not-allowed', background: dirty ? 'var(--teal)' : 'var(--bg2)', color: dirty ? '#0B1219' : 'var(--text3)', transition: 'all .2s' }}
                    >
                      {saving[row.key] ? '…' : 'Kaydet'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BenchmarksTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs] = useState({});

  useEffect(() => {
    adminGetBenchmarks()
      .then(data => { setRows(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getValue = (row) => edits[row.id] !== undefined ? edits[row.id] : Number(row.value);
  const setField = (id, val) => setEdits(p => ({ ...p, [id]: val }));

  const handleSave = async (id) => {
    if (edits[id] === undefined) return;
    setSaving(p => ({ ...p, [id]: true }));
    setMsgs(p => ({ ...p, [id]: '' }));
    try {
      const updated = await adminUpdateBenchmark(id, edits[id]);
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
      setEdits(p => { const n = { ...p }; delete n[id]; return n; });
      setMsgs(p => ({ ...p, [id]: 'ok' }));
      setTimeout(() => setMsgs(p => ({ ...p, [id]: '' })), 2000);
    } catch (err) {
      setMsgs(p => ({ ...p, [id]: err.response?.data?.error || 'Hata' }));
    } finally {
      setSaving(p => ({ ...p, [id]: false }));
    }
  };

  const METRIC_LABELS = { roas: 'ROAS (x)', cpa: 'CPA (₺)', ctr: 'CTR (%)', conv_rate: 'Dönüşüm (%)' };
  const METRIC_ORDER  = ['roas', 'cpa', 'ctr', 'conv_rate'];
  const fmtDate = (d) => d ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>Yükleniyor…</div>;

  // Group by sector
  const sectors = [...new Set(rows.map(r => r.sector))].sort();

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Sektör Benchmarkları</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Benchmark analizi ve PPT raporlarında kullanılan sektör ortalama değerleri.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sectors.map(sector => {
          const sectorRows = METRIC_ORDER.map(m => rows.find(r => r.sector === sector && r.metric === m)).filter(Boolean);
          return (
            <div key={sector} style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 12 }}>{sector}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {sectorRows.map(row => {
                  const dirty = edits[row.id] !== undefined;
                  const msg = msgs[row.id];
                  return (
                    <div key={row.id} style={{ background: dirty ? 'rgba(13,148,136,0.06)' : 'var(--bg2)', borderRadius: 8, padding: '10px 12px', border: `1px solid ${dirty ? 'rgba(13,148,136,0.3)' : 'var(--border2)'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        {METRIC_LABELS[row.metric] || row.metric}
                      </div>
                      <input
                        type="number" step="0.01" min="0"
                        value={getValue(row)}
                        onChange={e => setField(row.id, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(row.id); }}
                        style={{ ...inp, fontFamily: 'monospace', fontSize: 14, fontWeight: 700, marginBottom: 6, padding: '6px 8px' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleSave(row.id)}
                          disabled={!dirty || saving[row.id]}
                          style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 700, cursor: dirty ? 'pointer' : 'not-allowed', background: dirty ? 'var(--teal)' : 'var(--bg)', color: dirty ? '#0B1219' : 'var(--text3)', transition: 'all .2s' }}
                        >
                          {saving[row.id] ? '…' : 'Kaydet'}
                        </button>
                        {msg === 'ok' && <span style={{ fontSize: 11, color: '#22c55e' }}>✓</span>}
                        {msg && msg !== 'ok' && <span style={{ fontSize: 11, color: '#ef4444' }}>!</span>}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>{fmtDate(row.updated_at)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPanel({ onLogout }) {
  const [data, setData] = useState({ agencies: [], independent_brands: [] });
  const [tab, setTab] = useState('companies');
  const [filter, setFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showCreate, setShowCreate] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportMonth, setExportMonth] = useState(defaultMonth);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    return adminGetCompanies()
      .then(d => setData(d && d.agencies ? d : { agencies: [], independent_brands: [] }))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await adminExportReport(exportMonth);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AdsLands_Rapor_${exportMonth.replace('-', '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export hatası:', err);
    } finally {
      setExporting(false);
    }
  };

  const sortFn = getSortFn(sortBy);
  const filteredAgencies = data.agencies.filter(a => matchesPlan(a, planFilter)).sort(sortFn);
  const filteredBrands   = data.independent_brands.filter(b => matchesPlan(b, planFilter)).sort(sortFn);

  const totalAgencies = data.agencies.length;
  const totalBrands = data.agencies.reduce((s, a) => s + (a.brands?.length || 0), 0) + data.independent_brands.length;
  const totalAll = totalAgencies + totalBrands;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text1)' }}>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            setSuccessMsg('Şirket oluşturuldu ve setup maili gönderildi.');
            setTimeout(() => setSuccessMsg(''), 5000);
            load();
          }}
        />
      )}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <svg width="28" height="28" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
                <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
              </svg>
              <span style={{ fontSize: 20, fontWeight: 700 }}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Yönetimi</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
              style={{ padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--text1)', fontSize: 13 }} />
            <button onClick={handleExport} disabled={exporting}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--teal)', borderRadius: 8, color: 'var(--teal)', fontWeight: 600, fontSize: 13, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {exporting ? '⏳ İndiriliyor...' : '↓ Excel İndir'}
            </button>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '8px 18px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Şirket Ekle
            </button>
            <button onClick={onLogout}
              style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
              Çıkış
            </button>
          </div>
        </div>

        {successMsg && (
          <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 20 }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Ana sekmeler */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border2)', paddingBottom: 0 }}>
          {[
            { key: 'companies',    label: 'Şirketler' },
            { key: 'ai',           label: 'AI Kullanımı' },
            { key: 'plan-prices',  label: 'Plan Fiyatları' },
            { key: 'app-settings', label: 'Uygulama Ayarları' },
            { key: 'benchmarks',   label: 'Sektör Benchmarkları' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '8px 18px', borderRadius: '6px 6px 0 0', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === key ? 'var(--bg2)' : 'transparent',
                color: tab === key ? 'var(--text1)' : 'var(--text3)',
                borderBottom: tab === key ? '2px solid var(--teal)' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'ai' ? (
          <AiUsageTab />
        ) : tab === 'plan-prices' ? (
          <PlanPricesTab />
        ) : tab === 'app-settings' ? (
          <AppSettingsTab />
        ) : tab === 'benchmarks' ? (
          <BenchmarksTab />
        ) : (
          <>
        {/* Şirket filtre sekmeleri */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'all',    label: 'Tümü',  count: totalAll },
            { key: 'agency', label: 'Ajans', count: totalAgencies },
            { key: 'brand',  label: 'Marka', count: totalBrands },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === key ? 'var(--teal)' : 'var(--bg2)', color: filter === key ? '#0B1219' : 'var(--text3)' }}>
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Plan filtresi + Sıralama */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginRight: 4 }}>Plan:</span>
          {PLAN_FILTER_OPTIONS.map(({ key, label }) => (
            <button key={key} onClick={() => setPlanFilter(key)}
              style={{ padding: '4px 11px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: planFilter === key ? 'rgba(0,191,166,0.2)' : 'var(--bg2)',
                color: planFilter === key ? 'var(--teal)' : 'var(--text3)',
                outline: planFilter === key ? '1px solid rgba(0,191,166,0.4)' : 'none' }}>
              {label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' }}>Sırala:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: '4px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
              <option value="date">Kayıt Tarihi</option>
              <option value="activity">Aktiflik</option>
              <option value="plan">Plan</option>
              <option value="revenue">Gelir</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
        ) : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflowX: 'auto' }}>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Şirket</th>
                  <th style={{ minWidth: 90 }}>Tip</th>
                  <th style={{ minWidth: 100 }}>Sektör</th>
                  <th style={{ minWidth: 200, maxWidth: 220 }}>Admin E-posta</th>
                  <th style={{ minWidth: 80 }}>Plan</th>
                  <th style={{ minWidth: 80 }}>Aktiflik</th>
                  <th style={{ minWidth: 80 }}>Kullanıcı</th>
                  <th style={{ minWidth: 110 }}>Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {filter === 'all' && filteredAgencies.length === 0 && filteredBrands.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Şirket bulunamadı.</td></tr>
                )}

                {/* Ajans + bağlı markalar */}
                {filter !== 'brand' && filteredAgencies.map(agency => (
                  <AgencyGroup key={agency.id} agency={agency} onUpdate={load} />
                ))}

                {/* Bağımsız markalar (all view) */}
                {filter === 'all' && filteredBrands.length > 0 && (
                  <>
                    {filteredAgencies.length > 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', background: 'var(--bg)', borderTop: '1px solid var(--border2)' }}>
                          Bağımsız Markalar
                        </td>
                      </tr>
                    )}
                    {filteredBrands.map(brand => (
                      <CompanyRow key={brand.id} c={brand} onUpdate={load} />
                    ))}
                  </>
                )}

                {/* Ajans filtresi — boş durum */}
                {filter === 'agency' && filteredAgencies.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Ajans bulunamadı.</td></tr>
                )}

                {/* Marka filtresi: tüm markalar (bağlı + bağımsız) */}
                {filter === 'brand' && (() => {
                  const allBrands = [
                    ...data.agencies.flatMap(a => a.brands || []),
                    ...filteredBrands,
                  ].filter(b => matchesPlan(b, planFilter)).sort(sortFn);
                  if (allBrands.length === 0) {
                    return <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Marka bulunamadı.</td></tr>;
                  }
                  return allBrands.map(brand => (
                    <CompanyRow key={brand.id} c={brand} onUpdate={load} />
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
