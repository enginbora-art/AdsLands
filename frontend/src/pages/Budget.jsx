import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import {
  getBudgetPlan, saveBudgetPlan, getBudgetLogs, getBudgetBrands,
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getCampaign, addCampaignChannel, removeCampaignChannel,
} from '../api';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const PAGE_SIZE = 9;

const BUDGET_PLATFORMS = [
  { platform: 'google_ads', label: 'Google Ads',   color: '#4285F4' },
  { platform: 'meta',       label: 'Meta Ads',     color: '#1877F2' },
  { platform: 'tiktok',     label: 'TikTok Ads',   color: '#69C9D0' },
  { platform: 'linkedin',   label: 'LinkedIn Ads', color: '#0A66C2' },
  { platform: 'adform',     label: 'Adform',       color: '#FF6B00' },
];
const PLATFORM_MAP   = Object.fromEntries(BUDGET_PLATFORMS.map(p => [p.platform, p]));

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};
const PLATFORM_COLORS = {
  google_ads: '#4285F4', meta: '#1877F2', tiktok: '#69C9D0',
  linkedin: '#0A66C2', adform: '#E84B37', appsflyer: '#00B4D8', adjust: '#EC407A',
};
const ALL_CAMPAIGN_PLATFORMS = ['google_ads','meta','tiktok','linkedin','adform','appsflyer','adjust'];

const CHANNEL_KPIS = {
  google_ads: ['roas','cpa','ctr','impression','conversion'],
  meta:       ['roas','cpa','ctr','impression','conversion'],
  tiktok:     ['cpa','ctr','impression','conversion'],
  linkedin:   ['cpa','ctr','impression','conversion'],
  appsflyer:  ['cpa','conversion','roas'],
  adjust:     ['cpa','conversion'],
  adform:     ['ctr','impression','cpa'],
};
const KPI_DEFAULTS = {
  roas:       { label: 'Hedef ROAS',       placeholder: '4.0',    step: '0.1' },
  cpa:        { label: 'Hedef CPA (₺)',     placeholder: '150',    step: '1'   },
  ctr:        { label: 'Hedef CTR (%)',     placeholder: '2.5',    step: '0.1' },
  impression: { label: 'Hedef İmpresyon',  placeholder: '500000', step: '1000'},
  conversion: { label: 'Hedef Dönüşüm',    placeholder: '1000',   step: '1'   },
};
const KPI_OVERRIDES = {
  appsflyer: { cpa: { placeholder: '50' }, conversion: { label: 'Hedef Install', placeholder: '10000' }, roas: { placeholder: '2.0' } },
  adjust:    { cpa: { placeholder: '50' }, conversion: { label: 'Hedef Install', placeholder: '10000' } },
  adform:    { ctr: { placeholder: '0.1' }, impression: { placeholder: '1000000' }, cpa: { placeholder: '200' } },
};
function getKpiFields(platform) {
  return (CHANNEL_KPIS[platform] || Object.keys(KPI_DEFAULTS)).map(key => ({
    key, ...KPI_DEFAULTS[key], ...(KPI_OVERRIDES[platform]?.[key] || {}),
  }));
}

const LEGACY_CHANNELS = [
  { key: 'google_ads_budget', platform: 'google_ads' },
  { key: 'meta_ads_budget',   platform: 'meta'       },
  { key: 'tiktok_ads_budget', platform: 'tiktok'     },
];

const fmt      = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const fmtDateInput = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
const todayStr = () => new Date().toISOString().split('T')[0];
const fmtInput = (v) => {
  if (v === '' || v == null) return '';
  const n = parseInt(String(v).replace(/\./g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('tr-TR');
};
const parseRaw = (v) => String(v).replace(/\./g, '').replace(/[^0-9]/g, '');

function timeAgo(ts) {
  if (!ts) return 'Bilinmiyor';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return 'Bilinmiyor';
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function logMessage(log) {
  const actor = log.user_name || log.actor_company_name || '—';
  const brand = log.brand_name;
  const isSelf = log.actor_company_name === brand;
  const who = isSelf ? actor : `${actor} (${brand} adına)`;
  const mon = `${MONTHS[(log.month || 1) - 1]} ${log.year}`;
  if (log.action === 'created') return `${who}, ${mon} bütçesini ₺${fmt(log.new_value?.total_budget)} olarak belirledi.`;
  if (Array.isArray(log.new_value?.channels)) {
    const changes = [];
    const oldTotal = log.old_value?.total_budget, newTotal = log.new_value?.total_budget;
    if (oldTotal !== newTotal) changes.push(`Toplam bütçeyi ₺${fmt(oldTotal)} → ₺${fmt(newTotal)}`);
    const oldCh = log.old_value?.channels || [], newCh = log.new_value?.channels || [];
    newCh.forEach(nc => {
      const oc = oldCh.find(c => c.platform === nc.platform);
      if (!oc) changes.push(`${PLATFORM_MAP[nc.platform]?.label || nc.platform} eklendi`);
      else if (oc.amount !== nc.amount) changes.push(`${PLATFORM_MAP[nc.platform]?.label || nc.platform} ₺${fmt(oc.amount)} → ₺${fmt(nc.amount)}`);
    });
    oldCh.forEach(oc => { if (!newCh.find(nc => nc.platform === oc.platform)) changes.push(`${PLATFORM_MAP[oc.platform]?.label || oc.platform} kaldırıldı`); });
    if (!changes.length) return `${who} bütçeyi güncelledi.`;
    if (changes.length === 1) return `${who}, ${changes[0]} olarak güncelledi.`;
    return `${who}, ${mon} bütçesinde ${changes.length} kalem güncelledi.`;
  }
  const LEGACY_LABELS = { total_budget: 'Toplam bütçeyi', google_ads_budget: 'Google Ads bütçesini', meta_ads_budget: 'Meta bütçesini', tiktok_ads_budget: 'TikTok bütçesini' };
  const changes = [];
  for (const f of Object.keys(LEGACY_LABELS)) {
    const o = log.old_value?.[f], n = log.new_value?.[f];
    if (o !== n) changes.push(`${LEGACY_LABELS[f]} ₺${fmt(o)} → ₺${fmt(n)}`);
  }
  if (!changes.length) return `${who} bütçeyi güncelledi.`;
  if (changes.length === 1) return `${who}, ${changes[0]} olarak güncelledi.`;
  return `${who}, ${mon} bütçesinde ${changes.length} kalem güncelledi.`;
}

// ── Helper Components ─────────────────────────────────────────────────────────
function ProgressBar({ pct, color = '#00C9A7' }) {
  const p = Math.min(Math.max(pct || 0, 0), 100);
  const c = p >= 90 ? '#EF4444' : p >= 70 ? '#F59E0B' : color;
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${p}%`, background: c, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    active:    { label: 'Aktif',      bg: 'rgba(0,201,167,0.12)',  color: '#00C9A7', dot: '#00C9A7' },
    draft:     { label: 'Kanal yok',  bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', dot: '#94a3b8' },
    completed: { label: 'Tamamlandı', bg: 'rgba(99,102,241,0.12)', color: '#818CF8', dot: '#818CF8' },
  };
  const s = cfg[status] || cfg.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, background: s.bg, fontSize: 11, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}

function PlatformIcon({ platform, size = 20 }) {
  const color = PLATFORM_COLORS[platform] || '#6B7280';
  const label = (PLATFORM_LABELS[platform] || platform).slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: size / 4, background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color, flexShrink: 0 }}>
      {label}
    </div>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────────
function LogPanel() {
  const [logs, setLogs]     = useState([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    try { setLoading(true); setLogs(await getBudgetLogs(10)); } catch (_) {}
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);
  return (
    <div style={lp.wrap}>
      <button style={lp.toggle} onClick={() => setOpen(o => !o)}>
        <span>📋</span><span>Değişiklik Logu</span>
        {logs.length > 0 && <span style={lp.badge}>{logs.length}</span>}
        {loading && <span style={{ fontSize: 10, opacity: 0.6 }}>↻</span>}
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{open ? '▼' : '▲'}</span>
      </button>
      {open && (
        <div style={lp.panel}>
          {logs.length === 0
            ? <div style={lp.empty}>Henüz değişiklik kaydı yok.</div>
            : logs.map(log => (
              <div key={log.id} style={lp.row}>
                <div style={lp.msg}>{logMessage(log)}</div>
                <div style={lp.time}>{timeAgo(log.created_at)}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Budget Modal (simplified — no KPI) ───────────────────────────────────────
function BudgetModal({ role, brands, month, year, existing, onSave, onClose, forceBrandId }) {
  const [form, setForm] = useState({
    brand_id:     brands?.[0]?.id ?? '',
    month:        existing?.month ?? month,
    year:         existing?.year  ?? year,
    total_budget: existing?.total_budget ? String(Math.round(Number(existing.total_budget))) : '',
  });
  const [channels, setChannels] = useState(() => {
    if (existing?.channels?.length > 0) {
      return existing.channels.map(ch => ({ platform: ch.platform, amount: String(Math.round(Number(ch.amount))) }));
    }
    return LEGACY_CHANNELS.filter(lc => Number(existing?.[lc.key]) > 0)
      .map(lc => ({ platform: lc.platform, amount: String(Math.round(Number(existing[lc.key]))) }));
  });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const set         = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const usedPlats   = channels.map(c => c.platform).filter(Boolean);
  const availableFor = (cur) => BUDGET_PLATFORMS.filter(p => p.platform === cur || !usedPlats.includes(p.platform));
  const addChannel  = () => setChannels(p => [...p, { platform: '', amount: '' }]);
  const removeChannel = (i) => setChannels(p => p.filter((_, idx) => idx !== i));
  const updateCh    = (i, k, v) => setChannels(p => p.map((ch, idx) => idx === i ? { ...ch, [k]: v } : ch));

  const channelSum = channels.reduce((s, ch) => s + (parseInt(ch.amount) || 0), 0);
  const total      = parseInt(form.total_budget) || 0;
  const remaining  = total - channelSum;
  const overBudget = remaining < 0;
  const allOk      = total > 0 && remaining === 0;

  const doSave = async (totalOverride) => {
    setSaving(true); setError(''); setShowConfirm(false);
    try {
      const payload = {
        month: parseInt(form.month), year: parseInt(form.year),
        total_budget: totalOverride ?? total,
        channels: channels.filter(ch => ch.platform && parseInt(ch.amount) > 0)
          .map(ch => ({ platform: ch.platform, amount: parseInt(ch.amount), kpi: {} })),
      };
      if (role === 'agency') payload.brand_id = forceBrandId || form.brand_id;
      onSave(await saveBudgetPlan(payload));
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt başarısız.');
    } finally { setSaving(false); }
  };

  const handleSave = () => {
    if (!form.total_budget) return;
    const ttl = parseInt(form.total_budget) || 0;
    const sum = channels.reduce((s, ch) => s + (parseInt(ch.amount) || 0), 0);
    if (sum > ttl && sum > 0) { setShowConfirm(true); return; }
    doSave();
  };

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <span style={ms.title}>Bütçeyi Düzenle</span>
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
            <label style={ms.label}>Toplam Aylık Bütçe (₺)</label>
            <input style={ms.input} type="text" inputMode="numeric" placeholder="örn: 150.000"
              value={fmtInput(form.total_budget)} onChange={e => set('total_budget', parseRaw(e.target.value))} />
          </div>
          <div style={ms.divider} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ ...ms.label, fontSize: 11 }}>Kanal Bazında Dağılım <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none' }}>(opsiyonel)</span></span>
            </div>
            {channels.length === 0 && (
              <div style={{ textAlign: 'center', padding: '10px 0 8px', color: 'var(--text3)', fontSize: 12 }}>Henüz platform eklenmedi</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {channels.map((ch, i) => {
                const info = PLATFORM_MAP[ch.platform];
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <select style={{ ...ms.select, color: info ? 'var(--teal)' : 'var(--text3)', fontWeight: info ? 600 : 400 }}
                      value={ch.platform} onChange={e => updateCh(i, 'platform', e.target.value)}>
                      <option value="">— Platform Seç</option>
                      {availableFor(ch.platform).map(p => <option key={p.platform} value={p.platform}>{p.label}</option>)}
                    </select>
                    <input style={ms.input} type="text" inputMode="numeric" placeholder="0"
                      value={fmtInput(ch.amount)} onChange={e => updateCh(i, 'amount', parseRaw(e.target.value))} />
                    <button onClick={() => removeChannel(i)} title="Kaldır"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: '4px', lineHeight: 1 }}>🗑</button>
                  </div>
                );
              })}
            </div>
            <button onClick={addChannel} disabled={channels.length >= BUDGET_PLATFORMS.length}
              style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 7, color: 'var(--teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              + Platform Ekle
            </button>
          </div>
          {total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 13px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600,
              background: overBudget ? 'rgba(255,107,90,0.08)' : allOk ? 'rgba(52,211,153,0.08)' : 'rgba(0,191,166,0.06)',
              borderColor: overBudget ? 'rgba(255,107,90,0.3)' : allOk ? 'rgba(52,211,153,0.35)' : 'rgba(0,191,166,0.2)' }}>
              <span style={{ color: 'var(--text3)' }}>Dağıtılan:</span>
              <span>₺{fmt(channelSum)} / ₺{fmt(total)}</span>
              <span style={{ color: overBudget ? 'var(--coral)' : allOk ? 'var(--success)' : 'var(--teal)' }}>
                {overBudget ? `₺${fmt(Math.abs(remaining))} fazla` : allOk ? '✓ Tüm bütçe dağıtıldı' : `₺${fmt(remaining)} kaldı`}
              </span>
            </div>
          )}
          {error && <div style={{ background: 'rgba(255,107,90,0.12)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--coral)', fontWeight: 600 }}>⚠ {error}</div>}
        </div>
        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>İptal</button>
          <button style={{ ...ms.saveBtn, opacity: form.total_budget && !saving ? 1 : 0.6 }} onClick={handleSave} disabled={!form.total_budget || saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
        {showConfirm && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 14 }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1a1f2e', border: '1px solid rgba(245,158,11,0.5)', borderRadius: 14, padding: 28, width: 340, maxWidth: '90%' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>⚠️ Bütçe Aşımı</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 24 }}>
                Dağıtılan toplam (<strong>₺{fmt(channelSum)}</strong>), belirlenen bütçeyi (<strong>₺{fmt(total)}</strong>) aşıyor. Ne yapmak istersiniz?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <button onClick={() => doSave(channelSum)} style={{ padding: '10px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  Bütçeyi ₺{fmt(channelSum)} Olarak Güncelle
                </button>
                <button onClick={() => setShowConfirm(false)} style={{ padding: '10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  Kanalları Düzenle
                </button>
                <button onClick={onClose} style={{ padding: '10px', background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>İptal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Campaign Form Modal ───────────────────────────────────────────────────────
function CampaignFormModal({ existing, onClose, onSave, brandId }) {
  const [name, setName]     = useState(existing?.name || '');
  const [budget, setBudget] = useState(existing?.total_budget || '');
  const [start, setStart]   = useState(fmtDateInput(existing?.start_date) || todayStr());
  const [end, setEnd]       = useState(fmtDateInput(existing?.end_date) || '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    if (!name.trim()) return setError('Kampanya adı zorunludur.');
    if (!budget || Number(budget) <= 0) return setError('Geçerli bir bütçe girin.');
    if (!start || !end) return setError('Tarih aralığı zorunludur.');
    if (new Date(end) <= new Date(start)) return setError('Bitiş tarihi başlangıçtan sonra olmalıdır.');
    setError(''); setSaving(true);
    try {
      await onSave({ name: name.trim(), total_budget: Number(budget), start_date: start, end_date: end, brand_id: brandId });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || 'Kaydedilemedi.');
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 16, padding: '32px 28px', maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 24 }}>{existing ? 'Kampanya Düzenle' : 'Yeni Kampanya'}</div>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{error}</div>}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Kampanya Adı</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ör. Yaz Kampanyası 2025" style={inp} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Toplam Bütçe (₺)</div>
          <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="ör. 50000" style={inp} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Başlangıç</div>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inp} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Bitiş</div>
            <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} style={inp} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>İptal</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px 0', background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 10, color: '#00C9A7', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font)', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Channel Modal ─────────────────────────────────────────────────────────
function AddChannelModal({ campaignId, campaignName, existingPlatforms, onClose, onSave }) {
  const [platform, setPlatform]   = useState('');
  const [extId, setExtId]         = useState('');
  const [extName, setExtName]     = useState('');
  const [allocBudget, setAllocBudget] = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const available = ALL_CAMPAIGN_PLATFORMS.filter(p => !existingPlatforms.includes(p));

  const handleSave = async () => {
    if (!platform) return setError('Platform seçin.');
    setError(''); setSaving(true);
    try {
      await onSave({ platform, external_campaign_id: extId || null, external_campaign_name: extName || null, allocated_budget: Number(allocBudget) || 0 });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || 'Kanal eklenemedi.');
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 16, padding: '32px 28px', maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Kanal Ekle</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>{campaignName}</div>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Platform</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {available.map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: platform === p ? `${PLATFORM_COLORS[p]}22` : 'var(--bg3)', border: `1px solid ${platform === p ? PLATFORM_COLORS[p] + '88' : 'var(--border2)'}`, color: platform === p ? PLATFORM_COLORS[p] : 'var(--text2)' }}>
                {PLATFORM_LABELS[p]}
              </button>
            ))}
            {available.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Tüm platformlar eklenmiş.</div>}
          </div>
        </div>
        {platform && (
          <>
            <div style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.15)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              💡 {PLATFORM_LABELS[platform]} panelinden kampanya ID'sini alıp aşağıya yapıştırın.
            </div>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Kampanya ID (opsiyonel)</div>
              <input value={extId} onChange={e => setExtId(e.target.value)} placeholder="Platform kampanya ID'si" style={inp} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Kampanya Adı (opsiyonel)</div>
              <input value={extName} onChange={e => setExtName(e.target.value)} placeholder="Platform üzerindeki kampanya adı" style={inp} />
            </label>
            <label style={{ display: 'block', marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Ayrılan Bütçe ₺ (opsiyonel)</div>
              <input type="number" min="0" value={allocBudget} onChange={e => setAllocBudget(e.target.value)} placeholder="0" style={inp} />
            </label>
          </>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>İptal</button>
          <button onClick={handleSave} disabled={saving || !platform || available.length === 0}
            style={{ flex: 2, padding: '11px 0', background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 10, color: '#00C9A7', fontWeight: 700, fontSize: 13, cursor: saving || !platform ? 'default' : 'pointer', fontFamily: 'var(--font)', opacity: (!platform || saving) ? 0.5 : 1 }}>
            {saving ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Campaign Detail Modal (with KPI section) ──────────────────────────────────
function CampaignDetailModal({ campaignId, brandId, onClose, onEdit, onRefresh, budgetPlan, onKpiSave }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showAddCh, setShowAddCh] = useState(false);
  const [removing, setRemoving]   = useState(null);
  const [kpiEdit, setKpiEdit]     = useState(false);
  const [kpiValues, setKpiValues] = useState({});
  const [kpiSaving, setKpiSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getCampaign(campaignId).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Pre-fill KPI values from budget plan when campaign data arrives
  useEffect(() => {
    if (!data || !budgetPlan?.channels) return;
    const initial = {};
    for (const ch of data.channels || []) {
      const planCh = budgetPlan.channels.find(c => c.platform === ch.platform);
      if (planCh) {
        initial[ch.platform] = {
          roas:       planCh.kpi_roas       != null ? String(planCh.kpi_roas)       : '',
          cpa:        planCh.kpi_cpa        != null ? String(planCh.kpi_cpa)        : '',
          ctr:        planCh.kpi_ctr        != null ? String(planCh.kpi_ctr)        : '',
          impression: planCh.kpi_impression != null ? String(planCh.kpi_impression) : '',
          conversion: planCh.kpi_conversion != null ? String(planCh.kpi_conversion) : '',
        };
      }
    }
    setKpiValues(initial);
  }, [data, budgetPlan]);

  const handleAddChannel = async (channelData) => {
    await addCampaignChannel(campaignId, { ...channelData, brand_id: brandId });
    load(); onRefresh();
  };
  const handleRemoveChannel = async (channelId) => {
    setRemoving(channelId);
    try { await removeCampaignChannel(campaignId, channelId); load(); onRefresh(); } catch {}
    finally { setRemoving(null); }
  };

  const handleKpiSave = async () => {
    if (!onKpiSave) return;
    setKpiSaving(true);
    try {
      const updated = (budgetPlan?.channels || []).map(c => ({ ...c }));
      for (const [platform, kpi] of Object.entries(kpiValues)) {
        const idx = updated.findIndex(c => c.platform === platform);
        const kpiClean = {};
        if (kpi.roas?.trim())       kpiClean.roas       = kpi.roas;
        if (kpi.cpa?.trim())        kpiClean.cpa        = kpi.cpa;
        if (kpi.ctr?.trim())        kpiClean.ctr        = kpi.ctr;
        if (kpi.impression?.trim()) kpiClean.impression = kpi.impression;
        if (kpi.conversion?.trim()) kpiClean.conversion = kpi.conversion;
        if (idx >= 0) updated[idx] = { ...updated[idx], kpi: kpiClean };
        else updated.push({ platform, amount: 0, kpi: kpiClean });
      }
      await onKpiSave(updated);
      setKpiEdit(false);
    } catch {}
    finally { setKpiSaving(false); }
  };

  const setKpiField = (platform, key, val) =>
    setKpiValues(prev => ({ ...prev, [platform]: { ...(prev[platform] || {}), [key]: val } }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '24px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#141922', border: '1px solid var(--border2)', borderRadius: 16, maxWidth: 640, width: '100%', marginTop: 24, marginBottom: 24 }} onClick={e => e.stopPropagation()}>
        {showAddCh && data && (
          <AddChannelModal campaignId={campaignId} campaignName={data.name}
            existingPlatforms={(data.channels || []).map(c => c.platform)}
            onClose={() => setShowAddCh(false)} onSave={handleAddChannel} />
        )}

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{data?.name || '...'}</div>
            {data && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{fmtDate(data.start_date)} — {fmtDate(data.end_date)}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data && <StatusBadge status={data.status} />}
            {data?.status !== 'completed' && (
              <button onClick={onEdit} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Düzenle</button>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Yükleniyor...</div>
        ) : !data ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>Kampanya yüklenemedi.</div>
        ) : (
          <div style={{ padding: 24 }}>
            {/* Summary metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Harcanan',  value: `₺${fmt(data.total_spend)}` },
                { label: 'Bütçe',     value: `₺${fmt(data.total_budget)}` },
                { label: 'ROAS',      value: `${Number(data.avg_roas || 0).toFixed(2)}x` },
                { label: 'Dönüşüm',   value: fmt(data.total_conversions) },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border2)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text1)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Budget progress */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                <span>Bütçe Kullanımı</span>
                <span style={{ color: data.budget_used_pct >= 80 ? '#F59E0B' : 'var(--text2)', fontWeight: 600 }}>%{data.budget_used_pct?.toFixed(1) || '0'}</span>
              </div>
              <ProgressBar pct={data.budget_used_pct} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                <span>₺{fmt(data.total_spend)}</span>
                <span>{data.days_remaining > 0 ? `${data.days_remaining} gün kaldı` : 'Süre doldu'}</span>
                <span>₺{fmt(data.total_budget)}</span>
              </div>
            </div>

            {/* Channels */}
            <div style={{ marginBottom: (data.channels || []).length > 0 && onKpiSave ? 24 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Kanallar ({(data.channels || []).length})</div>
                {data.status !== 'completed' && (data.channels || []).length < ALL_CAMPAIGN_PLATFORMS.length && (
                  <button onClick={() => setShowAddCh(true)}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219', fontFamily: 'var(--font)' }}>
                    + Kanal Ekle
                  </button>
                )}
              </div>
              {(data.channels || []).length === 0 ? (
                <div style={{ background: 'rgba(148,163,184,0.05)', border: '1px dashed rgba(148,163,184,0.2)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Henüz kanal eklenmedi.</div>
                  <button onClick={() => setShowAddCh(true)}
                    style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,201,167,0.4)', background: 'rgba(0,201,167,0.08)', color: '#00C9A7', fontFamily: 'var(--font)' }}>
                    + İlk Kanalı Ekle
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.channels.map(ch => (
                    <div key={ch.id} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <PlatformIcon platform={ch.platform} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{PLATFORM_LABELS[ch.platform]}</div>
                        {ch.external_campaign_name && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.external_campaign_name}</div>}
                        {ch.external_campaign_id && <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>ID: {ch.external_campaign_id}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>₺{fmt(ch.metrics?.spend)}</div>
                        {ch.metrics?.roas > 0 && <div style={{ fontSize: 11, color: '#00C9A7' }}>{Number(ch.metrics.roas).toFixed(2)}x ROAS</div>}
                        {ch.allocated_budget > 0 && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ayrılan: ₺{fmt(ch.allocated_budget)}</div>}
                      </div>
                      {data.status !== 'completed' && (
                        <button onClick={() => handleRemoveChannel(ch.id)} disabled={removing === ch.id}
                          style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontFamily: 'var(--font)', opacity: removing === ch.id ? 0.5 : 1 }}>
                          Kaldır
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KPI Hedefleri — only shown when there are channels and a budget plan */}
            {(data.channels || []).length > 0 && onKpiSave && (
              <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>KPI Hedefleri</div>
                  {!kpiEdit ? (
                    <button onClick={() => setKpiEdit(true)}
                      style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--teal)', fontFamily: 'var(--font)' }}>
                      Düzenle
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setKpiEdit(false)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text3)', fontFamily: 'var(--font)' }}>İptal</button>
                      <button onClick={handleKpiSave} disabled={kpiSaving} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219', fontFamily: 'var(--font)', opacity: kpiSaving ? 0.7 : 1 }}>
                        {kpiSaving ? 'Kaydediliyor...' : 'Kaydet'}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {data.channels.map(ch => {
                    const fields = getKpiFields(ch.platform);
                    const vals = kpiValues[ch.platform] || {};
                    const hasAny = fields.some(f => vals[f.key]);
                    if (!kpiEdit && !hasAny) return null;
                    return (
                      <div key={ch.platform} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <PlatformIcon platform={ch.platform} size={18} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: PLATFORM_COLORS[ch.platform] || 'var(--text2)' }}>{PLATFORM_LABELS[ch.platform]}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                          {fields.map(({ key, label, placeholder, step }) => (
                            <div key={key}>
                              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
                              {kpiEdit ? (
                                <input type="number" step={step} min="0" placeholder={placeholder}
                                  value={vals[key] || ''}
                                  onChange={e => setKpiField(ch.platform, key, e.target.value)}
                                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 10px', color: 'var(--text1)', fontSize: 12, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                              ) : (
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>
                                  {vals[key] ? vals[key] : <span style={{ color: 'var(--text3)' }}>—</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {!kpiEdit && !data.channels.some(ch => (getKpiFields(ch.platform).some(f => (kpiValues[ch.platform] || {})[f.key]))) && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '4px 0 8px' }}>KPI hedefi girilmemiş. "Düzenle" ile ekleyebilirsiniz.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Campaign Card ─────────────────────────────────────────────────────────────
function CampaignCard({ campaign, onClick }) {
  const pct = campaign.total_budget > 0 ? (campaign.total_spend / campaign.total_budget) * 100 : 0;
  const now = new Date();
  const daysLeft = Math.max(Math.ceil((new Date(campaign.end_date) - now) / 86400000), 0);

  return (
    <div onClick={onClick}
      style={{ background: 'var(--bg2)', border: `1px solid ${campaign.status === 'active' ? 'rgba(0,201,167,0.2)' : 'var(--border2)'}`, borderRadius: 14, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', position: 'relative', opacity: campaign.status === 'draft' ? 0.75 : 1 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C9A7'; e.currentTarget.style.background = 'rgba(0,201,167,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = campaign.status === 'active' ? 'rgba(0,201,167,0.2)' : 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)'; }}
    >
      {campaign.has_anomaly && (
        <div title="Aktif uyarı" style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 0 3px rgba(245,158,11,0.2)' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)', lineHeight: 1.3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: campaign.has_anomaly ? 16 : 0 }}>
          {campaign.name}
        </div>
        <StatusBadge status={campaign.status} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>
          <span>₺{fmt(campaign.total_spend)}</span>
          <span style={{ fontWeight: 600, color: pct >= 80 ? '#F59E0B' : 'var(--text2)' }}>%{Math.round(pct)}</span>
          <span>₺{fmt(campaign.total_budget)}</span>
        </div>
        <ProgressBar pct={pct} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>ROAS</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{Number(campaign.avg_roas || 0).toFixed(2)}x</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>Dönüşüm</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(campaign.total_conversions)}</div>
        </div>
        {campaign.status === 'active' && (
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Kalan</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: daysLeft <= 3 ? '#EF4444' : daysLeft <= 7 ? '#F59E0B' : 'var(--text1)' }}>{daysLeft}g</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {campaign.channel_count === 0 ? 'Kanal bağlanmadı' : `${campaign.channel_count} kanal`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {fmtDate(campaign.start_date)} — {fmtDate(campaign.end_date)}
        </span>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Budget({ forceBrandId, forceBrandName } = {}) {
  const { user }            = useAuth();
  const { selectedBrand }   = useSelectedBrand();
  const isAgency            = user?.company_type === 'agency';
  const now                 = new Date();

  // All hooks must be before any early return
  const [selMonth, setSelMonth]     = useState(now.getMonth() + 1);
  const [selYear,  setSelYear]      = useState(now.getFullYear());
  const [budgetPlan, setBudgetPlan] = useState(undefined);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [brands, setBrands]         = useState([]);
  const [selBrandId, setSelBrandId] = useState('');

  const [campaigns, setCampaigns]   = useState(null);
  const [campSearch, setCampSearch] = useState('');
  const [campTab, setCampTab]       = useState('active');
  const [campPage, setCampPage]     = useState(1);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]   = useState(null);
  const [detailId, setDetailId]     = useState(null);
  const [deleting, setDeleting]     = useState(null);
  const autoCreatedRef              = useRef(false);

  const isEmbedded         = !!forceBrandId || (isAgency && !!selectedBrand);
  const resolvedBrandId    = forceBrandId   || (isAgency ? selectedBrand?.id          : undefined);
  const resolvedBrandName  = forceBrandName || (isAgency ? selectedBrand?.company_name : undefined);
  const effectiveBrandId   = resolvedBrandId || (isAgency ? selBrandId : undefined);

  // Load agency brands list (non-embedded agency view)
  useEffect(() => {
    if (!isEmbedded && isAgency) {
      getBudgetBrands().then(list => {
        setBrands(list);
        if (list.length > 0) setSelBrandId(list[0].id);
      });
    }
  }, [isAgency, isEmbedded]);

  // Load budget plan
  const loadPlan = useCallback(() => {
    if (user?.company_type === 'admin') return;
    const brandId = isAgency ? effectiveBrandId : undefined;
    if (isAgency && !brandId) { setBudgetPlan(null); return; }
    getBudgetPlan(selMonth, selYear, brandId).then(setBudgetPlan);
  }, [selMonth, selYear, effectiveBrandId, isAgency, user]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // Load campaigns
  const loadCampaigns = useCallback(() => {
    const brandId = effectiveBrandId || null;
    if (isAgency && !brandId) { setCampaigns([]); return; }
    getCampaigns({ brand_id: brandId })
      .then(list => { setCampaigns(list); setCampPage(1); })
      .catch(() => setCampaigns([]));
  }, [effectiveBrandId, isAgency]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Auto-create "Genel Bütçe" campaign for users with no campaigns
  useEffect(() => {
    if (autoCreatedRef.current) return;
    if (campaigns === null || campaigns.length > 0) return;
    if (budgetPlan === undefined) return;
    autoCreatedRef.current = true;
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    createCampaign({
      name: 'Genel Bütçe',
      total_budget: budgetPlan ? Number(budgetPlan.total_budget) || 0 : 0,
      start_date: firstDay,
      end_date: lastDayStr,
      brand_id: effectiveBrandId || undefined,
    }).then(loadCampaigns).catch(() => {});
  }, [campaigns, budgetPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBudgetSave = (saved) => { setBudgetPlan(saved); setShowBudgetModal(false); };

  const handleCampaignCreate = async (data) => { await createCampaign(data); loadCampaigns(); };
  const handleCampaignEdit   = async (data) => { await updateCampaign(editModal.id, data); loadCampaigns(); };
  const handleCampaignDelete = async (id) => {
    if (!window.confirm('Kampanyayı silmek istediğinizden emin misiniz?')) return;
    setDeleting(id);
    try { await deleteCampaign(id); loadCampaigns(); } catch {}
    finally { setDeleting(null); }
  };

  const handleKpiSave = useCallback(async (updatedChannels) => {
    const saved = await saveBudgetPlan({
      month: selMonth, year: selYear,
      total_budget: Number(budgetPlan?.total_budget || 0),
      channels: updatedChannels,
      ...(isAgency ? { brand_id: effectiveBrandId } : {}),
    });
    setBudgetPlan(saved);
  }, [budgetPlan, selMonth, selYear, effectiveBrandId, isAgency]);

  // ── Early returns ──
  if (isAgency && !isEmbedded && !selectedBrand && brands.length === 0 && budgetPlan === undefined) {
    return (
      <div className="fade-in">
        <div className="topbar"><div className="topbar-title">Bütçe Planlama</div></div>
        <div className="content">
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Önce bir müşteri seçin</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sol menüden <strong>Müşteri Yönetimi</strong>'ne giderek bir marka seçin.</div>
          </div>
        </div>
      </div>
    );
  }

  if (budgetPlan === undefined && user?.company_type !== 'admin') return <div className="loading">Yükleniyor...</div>;

  if (user?.company_type === 'admin') {
    return (
      <div className="fade-in">
        <div className="topbar"><div className="topbar-title">Bütçe Planlama</div></div>
        <div className="content">
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 48, textAlign: 'center', marginTop: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Erişim Yok</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Admin hesapları bütçe işlemi yapamaz.</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived data ──
  const totalBudget  = budgetPlan ? Number(budgetPlan.total_budget) : null;
  const channelData  = budgetPlan ? (() => {
    if (budgetPlan.channels?.length > 0) {
      return budgetPlan.channels.map(ch => {
        const p = PLATFORM_MAP[ch.platform] || { label: ch.platform, color: '#6B7280' };
        return { name: p.label, color: p.color, budget: Number(ch.amount) };
      });
    }
    return LEGACY_CHANNELS.filter(lc => Number(budgetPlan[lc.key]) > 0).map(lc => {
      const p = PLATFORM_MAP[lc.platform];
      return { name: p.label, color: p.color, budget: Number(budgetPlan[lc.key]) };
    });
  })() : [];

  const selBrand = resolvedBrandName
    ? { company_name: resolvedBrandName }
    : brands.find(b => b.id === selBrandId);

  // Campaign filtering + pagination
  const campList     = campaigns || [];
  const activeList   = campList.filter(c => c.status === 'active' || c.status === 'draft');
  const completedList = campList.filter(c => c.status === 'completed');
  const tabList      = campTab === 'active' ? activeList : completedList;
  const filtered     = campSearch.trim()
    ? tabList.filter(c => c.name.toLowerCase().includes(campSearch.toLowerCase()))
    : tabList;
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageList     = filtered.slice((campPage - 1) * PAGE_SIZE, campPage * PAGE_SIZE);

  const monthPicker = (
    <div style={s.picker}>
      <button style={s.arrowBtn} onClick={() => { if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1); } else setSelMonth(m => m - 1); }}>‹</button>
      <span style={s.monthLabel}>{MONTHS[selMonth - 1]} {selYear}</span>
      <button style={s.arrowBtn} onClick={() => { if (selMonth === 12) { setSelMonth(1); setSelYear(y => y + 1); } else setSelMonth(m => m + 1); }}>›</button>
    </div>
  );

  const budgetSection = (
    <>
      {budgetPlan === null ? (
        <div className="metrics" style={{ gridTemplateColumns: '1fr' }}>
          <div className="metric-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>📅</div>
            <div className="metric-value" style={{ fontSize: 18, color: 'var(--text3)', marginBottom: 8 }}>Bütçe Belirlenmedi</div>
            <div className="metric-sub" style={{ marginBottom: 20 }}>{MONTHS[selMonth - 1]} {selYear} için henüz bütçe belirlenmedi.</div>
            <button onClick={() => setShowBudgetModal(true)} style={s.setBudgetBtn}>+ Bütçe Belirle</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="metric-card teal">
            <div className="metric-label">Toplam Bütçe</div>
            <div className="metric-value">₺{fmt(totalBudget)}</div>
            <div className="metric-sub">{MONTHS[selMonth - 1]} {selYear}</div>
          </div>
          {channelData.length > 0 && channelData.slice(0, 3).map(ch => {
            const pct = totalBudget > 0 ? (ch.budget / totalBudget) * 100 : 0;
            return (
              <div key={ch.name} className="metric-card">
                <div className="metric-label" style={{ color: ch.color }}>{ch.name}</div>
                <div className="metric-value" style={{ fontSize: 18 }}>₺{fmt(ch.budget)}</div>
                <div style={{ marginTop: 6 }}>
                  <div className="budget-bar-wrap">
                    <div className="budget-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: ch.color }} />
                  </div>
                  <div className="metric-sub" style={{ marginTop: 4 }}>%{Math.round(pct)} payı</div>
                </div>
              </div>
            );
          })}
          {channelData.length === 0 && (
            <div className="metric-card">
              <div className="metric-label">Kanal Dağılımı</div>
              <div className="metric-value" style={{ fontSize: 14, color: 'var(--text3)' }}>Girilmemiş</div>
              <div className="metric-sub">Bütçeyi Düzenle'den ekleyebilirsiniz</div>
            </div>
          )}
        </div>
      )}
    </>
  );

  const campaignSection = (
    <div style={{ marginTop: 8 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>Kampanyalar</div>
          {campList.length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{campList.length} kampanya</div>}
        </div>
        <button onClick={() => setCreateModal(true)}
          style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219', fontFamily: 'var(--font)' }}>
          + Yeni Kampanya
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 340 }}>
        <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={campSearch} onChange={e => { setCampSearch(e.target.value); setCampPage(1); }}
          placeholder="Kampanya ara..."
          style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 36, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box', outline: 'none' }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'active',    label: `Aktif${activeList.length > 0 ? ` (${activeList.length})` : ''}` },
          { id: 'completed', label: `Tamamlandı${completedList.length > 0 ? ` (${completedList.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => { setCampTab(t.id); setCampPage(1); }}
            style={{ padding: '8px 20px', background: 'none', border: 'none', fontFamily: 'var(--font)', borderBottom: campTab === t.id ? '2px solid var(--teal)' : '2px solid transparent', color: campTab === t.id ? 'var(--teal)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {campaigns === null ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', fontSize: 13 }}>Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 40px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            {campSearch ? 'Aramanıza uygun kampanya yok' : campTab === 'active' ? 'Henüz kampanya yok' : 'Tamamlanmış kampanya yok'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
            {campSearch ? 'Farklı bir kelime deneyin.' : 'Yeni bir kampanya oluşturun ve kanal bütçelerinizi yönetin.'}
          </div>
          {!campSearch && campTab === 'active' && (
            <button onClick={() => setCreateModal(true)}
              style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,201,167,0.4)', background: 'rgba(0,201,167,0.08)', color: '#00C9A7', fontFamily: 'var(--font)' }}>
              + Yeni Kampanya Oluştur
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            {pageList.map(c => (
              <div key={c.id} style={{ position: 'relative' }}>
                <CampaignCard campaign={c} onClick={() => setDetailId(c.id)} />
                {c.status !== 'completed' && (
                  <button onClick={(e) => { e.stopPropagation(); handleCampaignDelete(c.id); }} disabled={deleting === c.id} title="Sil"
                    style={{ position: 'absolute', bottom: 14, right: 14, width: 24, height: 24, borderRadius: 6, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.5)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting === c.id ? 0.5 : 1 }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <button onClick={() => setCampPage(p => Math.max(1, p - 1))} disabled={campPage === 1}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: campPage === 1 ? 'default' : 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: campPage === 1 ? 'var(--text3)' : 'var(--text2)', fontFamily: 'var(--font)', opacity: campPage === 1 ? 0.4 : 1 }}>
                ‹ Önceki
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCampPage(p)}
                  style={{ width: 32, height: 32, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${campPage === p ? 'var(--teal)' : 'var(--border2)'}`, background: campPage === p ? 'rgba(0,201,167,0.1)' : 'transparent', color: campPage === p ? 'var(--teal)' : 'var(--text2)', fontFamily: 'var(--font)' }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setCampPage(p => Math.min(totalPages, p + 1))} disabled={campPage === totalPages}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: campPage === totalPages ? 'default' : 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: campPage === totalPages ? 'var(--text3)' : 'var(--text2)', fontFamily: 'var(--font)', opacity: campPage === totalPages ? 0.4 : 1 }}>
                Sonraki ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const modals = (
    <>
      {showBudgetModal && (
        <BudgetModal role={user?.company_type} brands={brands} month={selMonth} year={selYear}
          existing={budgetPlan} forceBrandId={resolvedBrandId}
          onSave={handleBudgetSave} onClose={() => setShowBudgetModal(false)} />
      )}
      {createModal && (
        <CampaignFormModal brandId={effectiveBrandId || user?.company_id}
          onClose={() => setCreateModal(false)} onSave={handleCampaignCreate} />
      )}
      {editModal && (
        <CampaignFormModal existing={editModal} brandId={effectiveBrandId || user?.company_id}
          onClose={() => setEditModal(null)} onSave={handleCampaignEdit} />
      )}
      {detailId && (
        <CampaignDetailModal
          campaignId={detailId}
          brandId={effectiveBrandId || user?.company_id}
          budgetPlan={budgetPlan}
          onKpiSave={budgetPlan ? handleKpiSave : null}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const c = campList.find(x => x.id === detailId);
            if (c) { setDetailId(null); setEditModal(c); }
          }}
          onRefresh={loadCampaigns}
        />
      )}
    </>
  );

  // ── Embedded (agency brand sub-view) ──
  if (isEmbedded) {
    return (
      <>
        {modals}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          {monthPicker}
          <button className="btn-export" onClick={() => setShowBudgetModal(true)}>
            {budgetPlan ? 'Bütçeyi Düzenle' : '+ Bütçe Belirle'}
          </button>
        </div>
        {budgetSection}
        {campaignSection}
        <LogPanel />
      </>
    );
  }

  // ── Full page ──
  return (
    <div className="fade-in">
      {modals}
      <div className="topbar">
        <div className="topbar-title">Bütçe Planlama</div>
        <div className="topbar-right" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {isAgency && brands.length > 0 && (
            <select style={{ ...s.picker, minWidth: 160 }} value={selBrandId} onChange={e => setSelBrandId(e.target.value)}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.company_name}</option>)}
            </select>
          )}
          {monthPicker}
          <button className="btn-export" onClick={() => setShowBudgetModal(true)}>
            {budgetPlan ? 'Bütçeyi Düzenle' : '+ Bütçe Belirle'}
          </button>
        </div>
      </div>
      <div className="content">
        {isAgency && selBrand && (
          <div style={s.agencyInfo}>
            <span>📌 {selBrand.company_name} için bütçe görüntülüyorsunuz</span>
          </div>
        )}
        {budgetSection}
        <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 28, marginTop: 8 }}>
          {campaignSection}
        </div>
      </div>
      <LogPanel />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  picker:       { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '5px 10px' },
  arrowBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 18, lineHeight: 1, padding: '0 2px' },
  monthLabel:   { fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' },
  setBudgetBtn: { marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--teal)', background: 'none', border: '1px solid var(--teal)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' },
  agencyInfo:   { marginBottom: 16, padding: '8px 14px', background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--teal)' },
};

const ms = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:     { background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, width: 460, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflowY: 'auto', position: 'relative' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 14px', borderBottom: '1px solid var(--border2)', position: 'sticky', top: 0, background: '#1a1f2e', zIndex: 1 },
  title:     { fontSize: 16, fontWeight: 700 },
  close:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)' },
  body:      { padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 },
  footer:    { padding: '14px 22px 18px', borderTop: '1px solid var(--border2)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#1a1f2e' },
  row:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field:     { display: 'flex', flexDirection: 'column', gap: 5 },
  label:     { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input:     { padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text1)', fontSize: 14, outline: 'none', fontFamily: 'var(--font)' },
  select:    { padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text1)', fontSize: 14, outline: 'none', fontFamily: 'var(--font)' },
  divider:   { borderTop: '1px solid var(--border2)', margin: '2px 0' },
  cancelBtn: { padding: '8px 20px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' },
  saveBtn:   { padding: '8px 24px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' },
};

const lp = {
  wrap:   { position: 'fixed', bottom: 24, right: 24, zIndex: 500, width: 360, maxWidth: 'calc(100vw - 48px)' },
  toggle: { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text1)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
  badge:  { background: 'var(--teal)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 },
  panel:  { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '0 0 10px 10px', borderTop: 'none', maxHeight: 320, overflowY: 'auto' },
  row:    { padding: '10px 14px', borderBottom: '1px solid var(--border2)', display: 'flex', flexDirection: 'column', gap: 3 },
  msg:    { fontSize: 12, color: 'var(--text1)', lineHeight: 1.4 },
  time:   { fontSize: 11, color: 'var(--text3)' },
  empty:  { padding: '20px 14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' },
};
