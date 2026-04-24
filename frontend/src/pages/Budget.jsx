import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getBudgetPlan, saveBudgetPlan, getBudgetLogs, getBudgetBrands } from '../api';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const CHANNELS = [
  { key: 'google_ads_budget', label: 'Google Ads', color: '#4285F4' },
  { key: 'meta_ads_budget',   label: 'Meta Ads',   color: '#1877F2' },
  { key: 'tiktok_ads_budget', label: 'TikTok Ads', color: '#00BFA6' },
];

const CHANNEL_LABELS = { google_ads_budget: 'Google Ads', meta_ads_budget: 'Meta Ads', tiktok_ads_budget: 'TikTok Ads' };

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

function alertLevel(r) { return r >= 100 ? 'red' : r >= 90 ? 'yellow' : 'green'; }

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

function logMessage(log) {
  const actor = log.company_name;
  const brand = log.brand_name;
  const isSelf = actor === brand;
  const who = isSelf ? actor : `${actor} (${brand} adına)`;
  const mon = `${MONTHS[(log.month || 1) - 1]} ${log.year}`;

  if (log.action === 'created') {
    return `${who}, ${mon} bütçesini ₺${fmt(log.new_value?.total_budget)} olarak belirledi.`;
  }

  const changes = [];
  const fields = ['total_budget', 'google_ads_budget', 'meta_ads_budget', 'tiktok_ads_budget'];
  for (const f of fields) {
    const o = log.old_value?.[f], n = log.new_value?.[f];
    if (o !== n) {
      const label = f === 'total_budget' ? 'Toplam bütçeyi' : `${CHANNEL_LABELS[f]} bütçesini`;
      changes.push(`${label} ₺${fmt(o)} → ₺${fmt(n)}`);
    }
  }
  if (!changes.length) return `${who} bütçeyi güncelledi.`;
  if (changes.length === 1) return `${who}, ${changes[0]} olarak güncelledi.`;
  return `${who}, ${mon} bütçesinde ${changes.length} kalem güncelledi.`;
}

// ── Log Panel ────────────────────────────────────────────────────────────────
function LogPanel() {
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBudgetLogs(10);
      setLogs(data);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [fetch]);

  return (
    <div style={lp.wrap}>
      <button style={lp.toggle} onClick={() => setOpen(o => !o)}>
        <span>📋</span>
        <span>Değişiklik Logu</span>
        {logs.length > 0 && <span style={lp.badge}>{logs.length}</span>}
        {loading && <span style={{ fontSize: 10, opacity: 0.6 }}>↻</span>}
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div style={lp.panel}>
          {logs.length === 0 ? (
            <div style={lp.empty}>Henüz değişiklik kaydı yok.</div>
          ) : logs.map(log => (
            <div key={log.id} style={lp.row}>
              <div style={lp.msg}>{logMessage(log)}</div>
              <div style={lp.time}>{timeAgo(log.changed_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Binlik ayraçlı Türk formatı: "50000" → "50.000"
const fmtInput = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = parseInt(String(v).replace(/\./g, ''), 10);
  if (isNaN(n)) return '';
  return n.toLocaleString('tr-TR');
};

// Formatlı değeri raw rakama dönüştür: "50.000" → "50000"
const parseRaw = (v) => String(v).replace(/\./g, '').replace(/[^0-9]/g, '');

// ── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ role, brands, month, year, existing, onSave, onClose, forceBrandId }) {
  const toRaw = (v) => v ? String(Math.round(Number(v))) : '';

  const [form, setForm] = useState({
    brand_id: brands?.[0]?.id ?? '',
    month: existing?.month ?? month,
    year: existing?.year ?? year,
    total_budget: toRaw(existing?.total_budget),
    google_ads_budget: toRaw(existing?.google_ads_budget),
    meta_ads_budget: toRaw(existing?.meta_ads_budget),
    tiktok_ads_budget: toRaw(existing?.tiktok_ads_budget),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNumberChange = (key) => (e) => {
    set(key, parseRaw(e.target.value));
  };

  const handleSave = async () => {
    if (!form.total_budget) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        month: parseInt(form.month),
        year: parseInt(form.year),
        total_budget: parseInt(form.total_budget) || 0,
        google_ads_budget: parseInt(form.google_ads_budget) || 0,
        meta_ads_budget: parseInt(form.meta_ads_budget) || 0,
        tiktok_ads_budget: parseInt(form.tiktok_ads_budget) || 0,
      };
      if (role === 'agency') payload.brand_id = forceBrandId || form.brand_id;
      console.log('Budget save payload:', payload);
      const saved = await saveBudgetPlan(payload);
      console.log('Budget save success:', saved);
      onSave(saved);
    } catch (err) {
      console.error('Budget save error:', err);
      setError(err.response?.data?.error || 'Kayıt başarısız. Tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const channelSum = CHANNELS.reduce((s, c) => s + (parseInt(form[c.key]) || 0), 0);
  const total = parseInt(form.total_budget) || 0;
  const unallocated = total - channelSum;
  const canSave = !!form.total_budget && !saving;

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <span style={ms.title}>Bütçe Belirle</span>
          <button onClick={onClose} style={ms.close}>✕</button>
        </div>
        <div style={ms.body}>
          {role === 'agency' && !forceBrandId && brands?.length > 0 && (
            <div style={ms.field}>
              <label style={ms.label}>Marka</label>
              <select style={ms.select} value={form.brand_id} onChange={e => set('brand_id', e.target.value)}>
                {brands.map(b => <option key={b.id} value={b.id}>{b.company_name}</option>)}
              </select>
            </div>
          )}

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
            <input style={ms.input} type="text" inputMode="numeric" placeholder="örn: 150.000"
              value={fmtInput(form.total_budget)} onChange={handleNumberChange('total_budget')} />
          </div>

          <div style={ms.divider} />
          <div style={{ ...ms.label, marginBottom: 12 }}>Kanal Bazında Dağılım</div>

          {CHANNELS.map(ch => (
            <div key={ch.key} style={ms.field}>
              <label style={{ ...ms.label, color: ch.color }}>{ch.label} (₺)</label>
              <input style={ms.input} type="text" inputMode="numeric" placeholder="0"
                value={fmtInput(form[ch.key])} onChange={handleNumberChange(ch.key)} />
            </div>
          ))}

          {total > 0 && (
            <div style={{ ...ms.allocInfo,
              background: unallocated < 0 ? 'rgba(255,107,90,0.1)' : 'rgba(0,191,166,0.08)',
              borderColor: unallocated < 0 ? 'rgba(255,107,90,0.3)' : 'rgba(0,191,166,0.2)' }}>
              <span>Dağıtılan:</span>
              <span>₺{fmt(channelSum)} / ₺{fmt(total)}</span>
              <span style={{ color: unallocated < 0 ? 'var(--coral)' : 'var(--teal)', fontWeight: 700 }}>
                {unallocated < 0 ? `₺${fmt(Math.abs(unallocated))} fazla` : `₺${fmt(unallocated)} kaldı`}
              </span>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(255,107,90,0.12)', border: '1px solid rgba(255,107,90,0.3)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--coral)', fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}
        </div>
        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>İptal</button>
          <button style={{ ...ms.saveBtn, opacity: canSave ? 1 : 0.6 }}
            onClick={handleSave} disabled={!canSave}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Budget({ forceBrandId, forceBrandName } = {}) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.role === 'agency';
  const now = new Date();

  if (isAgency && !forceBrandId && !selectedBrand) {
    return (
      <div className="fade-in">
        <div className="topbar"><div className="topbar-title">Bütçe Planlama</div></div>
        <div className="content">
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Önce bir müşteri seçin</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Sol menüden <strong>Müşteri Yönetimi</strong>'ne giderek bir marka seçin.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resolvedForceBrandId = forceBrandId || (isAgency ? selectedBrand?.id : undefined);
  const resolvedForceBrandName = forceBrandName || (isAgency ? selectedBrand?.company_name : undefined);
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [budgetPlan, setBudgetPlan] = useState(undefined);
  const [showModal, setShowModal] = useState(false);
  const [brands, setBrands] = useState([]);
  const [selBrandId, setSelBrandId] = useState('');

  const isEmbedded = !!resolvedForceBrandId;

  useEffect(() => {
    if (!isEmbedded && user?.role === 'agency') {
      getBudgetBrands().then(list => {
        setBrands(list);
        if (list.length > 0) setSelBrandId(list[0].id);
      });
    }
  }, [user, isEmbedded]);

  const effectiveBrandId = resolvedForceBrandId || (user?.role === 'agency' ? selBrandId : undefined);

  const loadPlan = useCallback(() => {
    if (user?.role === 'admin') return;
    const brandId = user?.role === 'agency' ? effectiveBrandId : undefined;
    if (user?.role === 'agency' && !brandId) { setBudgetPlan(null); return; }
    getBudgetPlan(selMonth, selYear, brandId).then(setBudgetPlan);
  }, [selMonth, selYear, effectiveBrandId, user]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const handleSave = (saved) => { setBudgetPlan(saved); setShowModal(false); loadPlan(); };

  if (budgetPlan === undefined && user?.role !== 'admin') return <div className="loading">Yükleniyor...</div>;

  // Admin erişim engeli
  if (user?.role === 'admin') {
    return (
      <div className="fade-in">
        <div className="topbar"><div className="topbar-title">Bütçe Planlama</div></div>
        <div className="content">
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12,
            padding: 48, textAlign: 'center', marginTop: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Erişim Yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Admin hesapları bütçe işlemi yapamaz.</div>
          </div>
        </div>
      </div>
    );
  }

  // Hesaplamalar
  const totalBudget = budgetPlan ? Number(budgetPlan.total_budget) : null;

  const channelData = budgetPlan ? CHANNELS.map(ch => ({
    key: ch.key,
    name: ch.label,
    color: ch.color,
    budget: Number(budgetPlan[ch.key]),
    spent: 0,
  })) : [];

  const selBrand = resolvedForceBrandName
    ? { company_name: resolvedForceBrandName }
    : brands.find(b => b.id === selBrandId);

  const monthPicker = (
    <div style={s.picker}>
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
  );

  const budgetBody = (
    <>
      {budgetPlan === null ? (
        <div className="metrics" style={{ gridTemplateColumns: '1fr' }}>
          <div className="metric-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>📅</div>
            <div className="metric-value" style={{ fontSize: 18, color: 'var(--text3)', marginBottom: 8 }}>Bütçe Belirlenmedi</div>
            <div className="metric-sub" style={{ marginBottom: 20 }}>
              {MONTHS[selMonth - 1]} {selYear} için henüz bütçe belirlenmedi.
            </div>
            <button onClick={() => setShowModal(true)} style={s.setBudgetBtn}>+ Bütçe Belirle</button>
          </div>
        </div>
      ) : (
        <>
          <div className="metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="metric-card teal">
              <div className="metric-label">Toplam Bütçe</div>
              <div className="metric-value">₺{fmt(totalBudget)}</div>
              <div className="metric-sub">{MONTHS[selMonth - 1]} {selYear}</div>
            </div>
            <div className="metric-card purple">
              <div className="metric-label">Harcanan</div>
              <div className="metric-value" style={{ fontSize: 16, color: 'var(--text3)' }}>—</div>
              <div className="metric-sub">Entegrasyon verisi bekleniyor</div>
            </div>
            <div className="metric-card amber">
              <div className="metric-label">Kalan</div>
              <div className="metric-value" style={{ fontSize: 16, color: 'var(--text3)' }}>—</div>
              <div className="metric-sub">Harcama verisi yok</div>
            </div>
            <div className="metric-card coral">
              <div className="metric-label">Ay Sonu Tahmini</div>
              <div className="metric-value" style={{ fontSize: 16, color: 'var(--text3)' }}>—</div>
              <div className="metric-sub">Harcama verisi yok</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">Kanal Bütçe Dağılımı</div>
              <div className="card-subtitle">Planlanan kanal bazında dağılım</div>
            </div>
            <div className="card-body">
              {channelData.map(ch => {
                const pct = totalBudget > 0 ? (ch.budget / totalBudget) * 100 : 0;
                return (
                  <div key={ch.name} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: ch.color }}>{ch.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                        ₺{fmt(ch.budget)} — %{Math.round(pct)}
                      </span>
                    </div>
                    <div className="budget-bar-wrap">
                      <div className="budget-bar-fill" style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: ch.color,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
              {channelData.every(ch => ch.budget === 0) && (
                <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
                  Kanal bazında dağılım girilmemiş.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  const modal = showModal && (
    <BudgetModal role={user?.role} brands={brands}
      month={selMonth} year={selYear} existing={budgetPlan}
      forceBrandId={resolvedForceBrandId}
      onSave={handleSave} onClose={() => setShowModal(false)} />
  );

  // Embedded mod: Agency Layer 2 içinde, kendi topbar'ı yok
  if (isEmbedded) {
    return (
      <>
        {modal}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          {monthPicker}
          <button className="btn-export" onClick={() => setShowModal(true)}>
            {budgetPlan ? 'Bütçeyi Düzenle' : '+ Bütçe Belirle'}
          </button>
        </div>
        {budgetBody}
        <LogPanel />
      </>
    );
  }

  return (
    <div className="fade-in">
      {modal}
      <div className="topbar">
        <div className="topbar-title">Bütçe Planlama</div>
        <div className="topbar-right" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'agency' && brands.length > 0 && (
            <select style={{ ...s.picker, minWidth: 160 }} value={selBrandId} onChange={e => setSelBrandId(e.target.value)}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.company_name}</option>)}
            </select>
          )}
          {monthPicker}
          <button className="btn-export" onClick={() => setShowModal(true)}>
            {budgetPlan ? 'Bütçeyi Düzenle' : '+ Bütçe Belirle'}
          </button>
        </div>
      </div>
      <div className="content">
        {user?.role === 'agency' && selBrand && (
          <div style={s.agencyInfo}>
            <span>📌 {selBrand.company_name} için bütçe görüntülüyorsunuz</span>
          </div>
        )}
        {budgetBody}
      </div>
      <LogPanel />
    </div>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────────
const s = {
  picker: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '5px 10px' },
  arrowBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 18, lineHeight: 1, padding: '0 2px' },
  monthLabel: { fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' },
  alertBanner: { marginBottom: 20, borderRadius: 10, border: '1px solid', padding: '10px 16px', fontSize: 13, fontWeight: 600 },
  setBudgetBtn: { marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--teal)', background: 'none', border: '1px solid var(--teal)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' },
  agencyInfo: { marginBottom: 16, padding: '8px 14px', background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--teal)' },
};

const ms = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, width: 420, maxWidth: '95vw', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)' },
  title: { fontSize: 16, fontWeight: 700 },
  close: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' },
  body: { padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 },
  footer: { padding: '14px 22px 18px', borderTop: '1px solid var(--border2)', display: 'flex', gap: 10, justifyContent: 'flex-end' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text1)', fontSize: 14, outline: 'none' },
  select: { padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text1)', fontSize: 14, outline: 'none' },
  divider: { borderTop: '1px solid var(--border2)', margin: '2px 0' },
  allocInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600 },
  cancelBtn: { padding: '8px 20px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer' },
  saveBtn: { padding: '8px 24px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};

const lp = {
  wrap: { position: 'fixed', bottom: 24, right: 24, zIndex: 500, width: 360, maxWidth: 'calc(100vw - 48px)' },
  toggle: { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text1)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
  badge: { background: 'var(--teal)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 },
  panel: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '0 0 10px 10px', borderTop: 'none', maxHeight: 320, overflowY: 'auto' },
  row: { padding: '10px 14px', borderBottom: '1px solid var(--border2)', display: 'flex', flexDirection: 'column', gap: 3 },
  msg: { fontSize: 12, color: 'var(--text1)', lineHeight: 1.4 },
  time: { fontSize: 11, color: 'var(--text3)' },
  empty: { padding: '20px 14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' },
};
