import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import MediaPlanImport from './MediaPlanImport';
import {
  getBudgetPlan, saveBudgetPlan, getBudgetBrands,
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getCampaign, addCampaignChannel, removeCampaignChannel,
  getPlatformCampaigns,
} from '../api';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const PAGE_SIZE = 6;

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

// ── Helper Components ─────────────────────────────────────────────────────────
function ProgressBar({ pct, color = '#00C9A7' }) {
  const [w, setW] = useState(0);
  const p = Math.min(Math.max(pct || 0, 0), 100);
  const c = p >= 100 ? '#EF4444' : p >= 80 ? '#F59E0B' : color;
  useEffect(() => { const t = setTimeout(() => setW(p), 40); return () => clearTimeout(t); }, [p]);
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: c, borderRadius: 3, transition: 'width 0.8s ease-out, background 0.3s ease' }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    active:    { label: 'Aktif',      bg: 'rgba(0,201,167,0.12)',  color: '#00C9A7', dot: '#00C9A7', border: '1px solid transparent' },
    draft:     { label: 'Taslak',     bg: 'rgba(245,158,11,0.08)', color: '#F59E0B', dot: '#F59E0B', border: '1px dashed rgba(245,158,11,0.55)' },
    completed: { label: 'Tamamlandı', bg: 'rgba(99,102,241,0.12)', color: '#818CF8', dot: '#818CF8', border: '1px solid transparent' },
  };
  const s = cfg[status] || cfg.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, background: s.bg, border: s.border, fontSize: 11, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, ...(status === 'active' && { animation: 'badgeDotPulse 1.8s ease-in-out infinite' }) }} />
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

// ── Currency Input (format on blur, raw on focus) ────────────────────────────
function CurrencyInput({ value, onChange, style, placeholder, ...rest }) {
  const [focused, setFocused] = useState(false);
  const raw = String(value || '').replace(/\./g, '').replace(/[^0-9]/g, '');
  const displayed = focused ? raw : (raw ? parseInt(raw).toLocaleString('tr-TR') : '');
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={displayed}
      style={style}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const cleaned = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
        onChange(cleaned);
      }}
    />
  );
}

// ── Budget Modal (only total budget) ─────────────────────────────────────────
function BudgetModal({ role, brands, month, year, existing, onSave, onClose, forceBrandId }) {
  const [form, setForm] = useState({
    brand_id:     brands?.[0]?.id ?? '',
    month:        existing?.month ?? month,
    year:         existing?.year  ?? year,
    total_budget: existing?.total_budget ? String(Math.round(Number(existing.total_budget))) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.total_budget) return;
    setSaving(true); setError('');
    try {
      // Preserve existing channel allocation; only total_budget is edited here
      const existingChannels = existing?.channels?.length > 0
        ? existing.channels
        : LEGACY_CHANNELS.filter(lc => Number(existing?.[lc.key]) > 0)
            .map(lc => ({ platform: lc.platform, amount: Number(existing[lc.key]), kpi: {} }));
      const payload = {
        month: parseInt(form.month), year: parseInt(form.year),
        total_budget: parseInt(form.total_budget) || 0,
        channels: existingChannels,
      };
      if (role === 'agency') payload.brand_id = forceBrandId || form.brand_id;
      onSave(await saveBudgetPlan(payload));
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt başarısız.');
    } finally { setSaving(false); }
  };

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={{ ...ms.modal, maxHeight: '60vh' }} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <span style={ms.title}>Aylık Bütçeyi Düzenle</span>
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
            <CurrencyInput value={form.total_budget} onChange={v => set('total_budget', v)}
              style={ms.input} placeholder="örn: 150.000" />
          </div>
          {error && <div style={{ background: 'rgba(255,107,90,0.12)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--coral)', fontWeight: 600 }}>⚠ {error}</div>}
        </div>
        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>İptal</button>
          <button style={{ ...ms.saveBtn, opacity: form.total_budget && !saving ? 1 : 0.6 }} onClick={handleSave} disabled={!form.total_budget || saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
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
          <CurrencyInput value={budget} onChange={setBudget} placeholder="örn: 50.000" style={inp} />
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

// ── Add / Edit Channel Modal ───────────────────────────────────────────────────
function AddChannelModal({ campaignId, campaignName, existingPlatforms, existing, onClose, onSave }) {
  const isEdit = !!existing;
  const [platform, setPlatform]       = useState(existing?.platform || '');
  const [extId, setExtId]             = useState(existing?.external_campaign_id || '');
  const [extName, setExtName]         = useState(existing?.external_campaign_name || '');
  const [allocBudget, setAllocBudget] = useState(
    existing?.allocated_budget > 0 ? String(Math.round(Number(existing.allocated_budget))) : ''
  );
  const [kpiValues, setKpiValues]   = useState(() => {
    if (!existing) return {};
    return {
      roas:       existing.kpi_roas       != null ? String(existing.kpi_roas)       : '',
      cpa:        existing.kpi_cpa        != null ? String(existing.kpi_cpa)        : '',
      ctr:        existing.kpi_ctr        != null ? String(existing.kpi_ctr)        : '',
      impression: existing.kpi_impression != null ? String(existing.kpi_impression) : '',
      conversion: existing.kpi_conversion != null ? String(existing.kpi_conversion) : '',
    };
  });
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [showSugg, setShowSugg]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const searchTimer                   = useRef(null);
  // For add mode: exclude already-added platforms; for edit mode: all platforms available (platform is locked anyway)
  const available = isEdit
    ? ALL_CAMPAIGN_PLATFORMS
    : ALL_CAMPAIGN_PLATFORMS.filter(p => !existingPlatforms.includes(p));

  useEffect(() => {
    if (isEdit) return; // don't reset when editing
    setExtId(''); setExtName(''); setSuggestions([]); setKpiValues({});
  }, [platform]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExtIdChange = (val) => {
    setExtId(val);
    setShowSugg(true);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { setSuggestions((await getPlatformCampaigns(campaignId, platform, val)) || []); } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const selectSuggestion = (s) => {
    setExtId(s.id || s.external_id || s.campaign_id || s.extId || '');
    setExtName(s.name || s.campaign_name || s.extName || '');
    setShowSugg(false); setSuggestions([]);
  };

  const setKpi = (key, val) => setKpiValues(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!platform) return setError('Platform seçin.');
    if (!extId.trim()) return setError('Kampanya ID zorunludur.');
    if (!allocBudget || Number(allocBudget) <= 0) return setError('Ayrılan bütçe zorunludur.');
    setError(''); setSaving(true);
    const kpi = {};
    for (const [key, val] of Object.entries(kpiValues)) {
      if (val && String(val).trim()) kpi[key] = val;
    }
    try {
      await onSave({ platform, external_campaign_id: extId.trim(), external_campaign_name: extName.trim() || null, allocated_budget: Number(allocBudget), kpi });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || 'Kanal eklenemedi.');
    } finally { setSaving(false); }
  };

  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' };
  const kpiFields = platform ? getKpiFields(platform) : [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1010, padding: '24px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 16, padding: '28px', maxWidth: 480, width: '100%', marginTop: 24, marginBottom: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{isEdit ? 'Kanal Düzenle' : 'Kanal Ekle'}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>{campaignName}</div>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{error}</div>}

        {/* Platform */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Platform</div>
          {isEdit ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: `${PLATFORM_COLORS[platform]}22`, border: `1px solid ${PLATFORM_COLORS[platform]}88`, color: PLATFORM_COLORS[platform] }}>
              {PLATFORM_LABELS[platform]}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {available.map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: platform === p ? `${PLATFORM_COLORS[p]}22` : 'var(--bg3)', border: `1px solid ${platform === p ? PLATFORM_COLORS[p] + '88' : 'var(--border2)'}`, color: platform === p ? PLATFORM_COLORS[p] : 'var(--text2)' }}>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
              {available.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Tüm platformlar eklenmiş.</div>}
            </div>
          )}
        </div>

        {platform && (
          <>
            {/* Campaign ID with fuzzy search */}
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Kampanya ID</div>
              <input value={extId} onChange={e => handleExtIdChange(e.target.value)}
                placeholder={`${PLATFORM_LABELS[platform]} kampanya ID'si`}
                style={inp}
                onBlur={() => setTimeout(() => setShowSugg(false), 160)} />
              {searching && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Aranıyor...</div>}
              {showSugg && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, zIndex: 20, maxHeight: 160, overflowY: 'auto', marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                  {suggestions.map((s, i) => (
                    <div key={i} onClick={() => selectSuggestion(s)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border2)' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,201,167,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>{s.name || s.campaign_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{s.id || s.external_id || s.campaign_id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Campaign Name */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Kampanya Adı</div>
              <input value={extName} onChange={e => setExtName(e.target.value)}
                placeholder="Platform üzerindeki kampanya adı" style={inp} />
            </div>

            {/* Budget */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Ayrılan Bütçe (₺)</div>
              <CurrencyInput value={allocBudget} onChange={setAllocBudget}
                placeholder="örn: 25.000" style={inp} />
            </div>

            {/* Inline KPI fields */}
            {kpiFields.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>KPI Hedefleri</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {kpiFields.map(({ key, label, placeholder, step }) => (
                    <div key={key}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
                      <input type="number" step={step} min="0" placeholder={placeholder}
                        value={kpiValues[key] || ''}
                        onChange={e => setKpi(key, e.target.value)}
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '7px 10px', color: 'var(--text1)', fontSize: 12, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>İptal</button>
          <button onClick={handleSave} disabled={saving || !platform || available.length === 0}
            style={{ flex: 2, padding: '11px 0', background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 10, color: '#00C9A7', fontWeight: 700, fontSize: 13, cursor: saving || !platform ? 'default' : 'pointer', fontFamily: 'var(--font)', opacity: (!platform || saving) ? 0.5 : 1 }}>
            {saving ? (isEdit ? 'Güncelleniyor...' : 'Ekleniyor...') : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); } catch { setLoading(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: '28px 28px 24px', maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text1)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, cursor: 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontWeight: 600, fontFamily: 'var(--font)' }}>İptal</button>
          <button onClick={handleConfirm} disabled={loading}
            style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontFamily: 'var(--font)', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Siliniyor...' : 'Evet, Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Campaign Detail Modal ─────────────────────────────────────────────────────
function CampaignDetailModal({ campaignId, brandId, onClose, onEdit, onRefresh, onDelete }) {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [showAddCh, setShowAddCh]     = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [removing, setRemoving]       = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getCampaign(campaignId).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleAddChannel = async (channelData) => {
    await addCampaignChannel(campaignId, { ...channelData, brand_id: brandId });
    load(); onRefresh();
  };
  const handleRemoveChannel = async (channelId) => {
    setRemoving(channelId);
    try { await removeCampaignChannel(campaignId, channelId); load(); onRefresh(); } catch {}
    finally { setRemoving(null); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '24px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#141922', border: '1px solid var(--border2)', borderRadius: 16, maxWidth: 640, width: '100%', marginTop: 24, marginBottom: 24 }} onClick={e => e.stopPropagation()}>
        {showAddCh && data && (
          <AddChannelModal
            campaignId={campaignId} campaignName={data.name}
            existingPlatforms={(data.channels || []).map(c => c.platform)}
            existing={editingChannel}
            onClose={() => { setShowAddCh(false); setEditingChannel(null); }}
            onSave={handleAddChannel} />
        )}

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{data?.name || '...'}</div>
            {data && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{fmtDate(data.start_date)} — {fmtDate(data.end_date)}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data && <StatusBadge status={data.status} />}
            {data?.status === 'draft' && (
              <button onClick={() => onDelete(campaignId, data.name)}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontFamily: 'var(--font)' }}>Sil</button>
            )}
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
            <div>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => { setEditingChannel(ch); setShowAddCh(true); }}
                            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--teal)', fontFamily: 'var(--font)' }}>
                            Düzenle
                          </button>
                          <button onClick={() => handleRemoveChannel(ch.id)} disabled={removing === ch.id}
                            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontFamily: 'var(--font)', opacity: removing === ch.id ? 0.5 : 1 }}>
                            Kaldır
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

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

  const isDraft     = campaign.status === 'draft';
  const isCompleted = campaign.status === 'completed';
  const accentColor = isDraft ? '#64748B' : isCompleted ? '#818CF8' : '#00C9A7';
  const borderBase  = isCompleted ? 'rgba(99,102,241,0.2)' : campaign.status === 'active' ? 'rgba(0,201,167,0.18)' : 'rgba(100,116,139,0.2)';
  const cardOpacity = isCompleted ? 0.62 : isDraft ? 0.76 : 1;

  return (
    <div onClick={onClick}
      style={{ background: 'var(--bg2)', border: `1px solid ${borderBase}`, borderLeft: `3px solid ${accentColor}`, borderRadius: 14, padding: '18px 20px', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.15s ease', position: 'relative', opacity: cardOpacity }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = `0 10px 28px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}44`;
        e.currentTarget.style.opacity = '1';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.opacity = String(cardOpacity);
      }}
    >
      {/* Completed: soft purple overlay tint */}
      {isCompleted && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 13, background: 'rgba(99,102,241,0.05)', pointerEvents: 'none' }} />
      )}

      {campaign.has_anomaly && (
        <div title="Aktif uyarı" style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 0 3px rgba(245,158,11,0.2)' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)', lineHeight: 1.3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: campaign.has_anomaly ? 16 : 0 }}>
          {campaign.name}
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      <div style={{ marginBottom: 12, opacity: isDraft ? 0.7 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>
          <span>₺{fmt(campaign.total_spend)}</span>
          <span style={{ fontWeight: 600, color: pct >= 80 ? '#F59E0B' : 'var(--text2)' }}>%{Math.round(pct)}</span>
          <span>₺{fmt(campaign.total_budget)}</span>
        </div>
        <ProgressBar pct={pct} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14, opacity: isDraft ? 0.7 : 1 }}>
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
        {isDraft ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F59E0B', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 6 }}>
            ⚠ Kanal bağlanmadı
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{campaign.channel_count} kanal</span>
        )}
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
  const [createModal, setCreateModal]     = useState(false);
  const [importModal, setImportModal]     = useState(false);
  const [editModal, setEditModal]         = useState(null);
  const [detailId, setDetailId]           = useState(null);
  const [deleting, setDeleting]           = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }
  const autoCreatedRef                    = useRef(false);

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
  const handleCampaignDelete = (id, name) => setConfirmDelete({ id, name });
  const doDeleteCampaign = async () => {
    const id = confirmDelete.id;
    setDeleting(id);
    try { await deleteCampaign(id); loadCampaigns(); } catch {}
    finally { setDeleting(null); }
  };

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

  // Campaign filtering + pagination — hide the auto-created "Genel Bütçe" placeholder
  const campList      = (campaigns || []).filter(c => c.name !== 'Genel Bütçe');
  const totalSpent    = campList.reduce((s, c) => s + Number(c.total_spend || 0), 0);
  const remaining     = totalBudget != null ? totalBudget - totalSpent : null;
  const spentPct      = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const remainColor   = totalBudget != null && totalSpent > totalBudget ? '#EF4444' : spentPct >= 80 ? '#F59E0B' : '#00C9A7';
  const remainBg      = remainColor === '#EF4444' ? 'rgba(239,68,68,0.06)' : remainColor === '#F59E0B' ? 'rgba(245,158,11,0.05)' : 'rgba(0,201,167,0.04)';
  const activeList    = campList.filter(c => c.status === 'active' || c.status === 'draft');
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
          <div className="metric-card teal" style={{
            background: 'linear-gradient(var(--bg2), var(--bg2)) padding-box, linear-gradient(135deg, rgba(0,201,167,0.55) 0%, rgba(10,102,194,0.25) 100%) border-box',
            border: '1px solid transparent',
            boxShadow: '0 0 18px rgba(0,201,167,0.07), 0 2px 6px rgba(0,0,0,0.25)',
          }}>
            <div className="metric-label">Toplam Bütçe</div>
            <div className="metric-value">₺{fmt(totalBudget)}</div>
            <div className="metric-sub">{MONTHS[selMonth - 1]} {selYear}</div>
          </div>
          <div className="metric-card" style={{
            background: `linear-gradient(${remainBg}, ${remainBg}) padding-box, linear-gradient(135deg, ${remainColor}88 0%, ${remainColor}22 100%) border-box`,
            border: '1px solid transparent',
            boxShadow: `0 0 18px ${remainColor}11, 0 2px 6px rgba(0,0,0,0.25)`,
          }}>
            <div className="metric-label" style={{ color: remainColor }}>Kalan Bütçe</div>
            <div className="metric-value" style={{ color: remainColor, fontSize: 22 }}>
              {remaining != null ? (remaining < 0 ? '-' : '') + '₺' + fmt(Math.abs(remaining)) : '—'}
            </div>
            <div style={{ margin: '8px 0 4px' }}>
              <ProgressBar pct={spentPct} color={remainColor} />
            </div>
            <div className="metric-sub">Harcanan: ₺{fmt(totalSpent)} · %{Math.round(spentPct)}</div>
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
          {campList.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {filtered.length > PAGE_SIZE
                ? `${filtered.length} kampanyadan ${(campPage - 1) * PAGE_SIZE + 1}–${Math.min(campPage * PAGE_SIZE, filtered.length)} gösteriliyor`
                : `${campList.length} kampanya`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setImportModal(true)}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15 }}>📊</span> Excel'den İçe Aktar
          </button>
          <button onClick={() => setCreateModal(true)}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0,201,167,0.22), 0 4px 12px rgba(0,201,167,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219', fontFamily: 'var(--font)', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}>
            + Yeni Kampanya
          </button>
        </div>
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
          { id: 'active',    label: 'Aktif',      count: activeList.length },
          { id: 'completed', label: 'Tamamlandı', count: completedList.length },
        ].map(t => (
          <button key={t.id} onClick={() => { setCampTab(t.id); setCampPage(1); }}
            style={{ padding: '8px 16px', background: 'none', border: 'none', fontFamily: 'var(--font)', borderBottom: campTab === t.id ? '2px solid var(--teal)' : '2px solid transparent', color: campTab === t.id ? 'var(--teal)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7 }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: campTab === t.id ? '#00C9A7' : 'rgba(148,163,184,0.15)', color: campTab === t.id ? '#0B1219' : 'var(--text3)', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, lineHeight: '16px' }}>
                {t.count}
              </span>
            )}
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
                {c.status === 'draft' && (
                  <button onClick={(e) => { e.stopPropagation(); handleCampaignDelete(c.id, c.name); }} disabled={deleting === c.id} title="Sil"
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
      {confirmDelete && (
        <ConfirmModal
          title="Kampanyayı Sil"
          message={`"${confirmDelete.name}" kampanyasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          onConfirm={doDeleteCampaign}
          onClose={() => setConfirmDelete(null)}
        />
      )}
      {showBudgetModal && (
        <BudgetModal role={user?.company_type} brands={brands} month={selMonth} year={selYear}
          existing={budgetPlan} forceBrandId={resolvedBrandId}
          onSave={handleBudgetSave} onClose={() => setShowBudgetModal(false)} />
      )}
      {createModal && (
        <CampaignFormModal brandId={effectiveBrandId || user?.company_id}
          onClose={() => setCreateModal(false)} onSave={handleCampaignCreate} />
      )}
      {importModal && (
        <MediaPlanImport
          brandId={effectiveBrandId || user?.company_id}
          onClose={() => setImportModal(false)}
          onCampaignCreated={(id) => { setImportModal(false); loadCampaigns(); setDetailId(id); }}
        />
      )}
      {editModal && (
        <CampaignFormModal existing={editModal} brandId={effectiveBrandId || user?.company_id}
          onClose={() => setEditModal(null)} onSave={handleCampaignEdit} />
      )}
      {detailId && (
        <CampaignDetailModal
          campaignId={detailId}
          brandId={effectiveBrandId || user?.company_id}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const c = campList.find(x => x.id === detailId);
            if (c) { setDetailId(null); setEditModal(c); }
          }}
          onDelete={(id, name) => { setDetailId(null); handleCampaignDelete(id, name); }}
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

