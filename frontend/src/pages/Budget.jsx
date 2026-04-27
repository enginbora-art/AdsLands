import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getBudgetPlan, saveBudgetPlan, getBudgetLogs, getBudgetBrands } from '../api';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

// All supported platforms (for the dynamic modal dropdown)
const ALL_PLATFORMS = [
  { platform: 'google_ads', label: 'Google Ads',  color: '#4285F4' },
  { platform: 'meta',       label: 'Meta Ads',    color: '#1877F2' },
  { platform: 'tiktok',     label: 'TikTok Ads',  color: '#69C9D0' },
  { platform: 'linkedin',   label: 'LinkedIn Ads', color: '#0A66C2' },
  { platform: 'adform',     label: 'Adform',      color: '#FF6B00' },
  { platform: 'appsflyer',  label: 'AppsFlyer',   color: '#00B4E6' },
  { platform: 'adjust',     label: 'Adjust',      color: '#00B2FF' },
  { platform: 'other',      label: 'Diğer',       color: '#6B7280' },
];
const PLATFORM_MAP = Object.fromEntries(ALL_PLATFORMS.map(p => [p.platform, p]));

// Legacy columns for backward-compat display of old budget records
const LEGACY_CHANNELS = [
  { key: 'google_ads_budget', platform: 'google_ads' },
  { key: 'meta_ads_budget',   platform: 'meta'       },
  { key: 'tiktok_ads_budget', platform: 'tiktok'     },
];

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

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

  if (log.action === 'created') {
    return `${who}, ${mon} bütçesini ₺${fmt(log.new_value?.total_budget)} olarak belirledi.`;
  }

  // New format: has channels array
  if (Array.isArray(log.new_value?.channels)) {
    const oldTotal = log.old_value?.total_budget;
    const newTotal = log.new_value?.total_budget;
    const changes = [];
    if (oldTotal !== newTotal) changes.push(`Toplam bütçeyi ₺${fmt(oldTotal)} → ₺${fmt(newTotal)}`);
    const oldCh = log.old_value?.channels || [];
    const newCh = log.new_value?.channels || [];
    newCh.forEach(nc => {
      const oc = oldCh.find(c => c.platform === nc.platform);
      if (!oc) changes.push(`${PLATFORM_MAP[nc.platform]?.label || nc.platform} eklendi (₺${fmt(nc.amount)})`);
      else if (oc.amount !== nc.amount) changes.push(`${PLATFORM_MAP[nc.platform]?.label || nc.platform} ₺${fmt(oc.amount)} → ₺${fmt(nc.amount)}`);
    });
    oldCh.forEach(oc => { if (!newCh.find(nc => nc.platform === oc.platform)) changes.push(`${PLATFORM_MAP[oc.platform]?.label || oc.platform} kaldırıldı`); });
    if (!changes.length) return `${who} bütçeyi güncelledi.`;
    if (changes.length === 1) return `${who}, ${changes[0]} olarak güncelledi.`;
    return `${who}, ${mon} bütçesinde ${changes.length} kalem güncelledi.`;
  }

  // Legacy format
  const LEGACY_LABELS = { total_budget: 'Toplam bütçeyi', google_ads_budget: 'Google Ads bütçesini', meta_ads_budget: 'Meta Ads bütçesini', tiktok_ads_budget: 'TikTok Ads bütçesini' };
  const changes = [];
  for (const f of Object.keys(LEGACY_LABELS)) {
    const o = log.old_value?.[f], n = log.new_value?.[f];
    if (o !== n) changes.push(`${LEGACY_LABELS[f]} ₺${fmt(o)} → ₺${fmt(n)}`);
  }
  if (!changes.length) return `${who} bütçeyi güncelledi.`;
  if (changes.length === 1) return `${who}, ${changes[0]} olarak güncelledi.`;
  return `${who}, ${mon} bütçesinde ${changes.length} kalem güncelledi.`;
}

// ── Log Panel ─────────────────────────────────────────────────────────────────
function LogPanel() {
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(false);
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

const fmtInput = (v) => {
  if (v === '' || v == null) return '';
  const n = parseInt(String(v).replace(/\./g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('tr-TR');
};
const parseRaw = (v) => String(v).replace(/\./g, '').replace(/[^0-9]/g, '');

// ── Budget Modal — Dynamic platform rows ──────────────────────────────────────
function BudgetModal({ role, brands, month, year, existing, onSave, onClose, forceBrandId }) {
  const [form, setForm] = useState({
    brand_id: brands?.[0]?.id ?? '',
    month:    existing?.month ?? month,
    year:     existing?.year  ?? year,
    total_budget: existing?.total_budget ? String(Math.round(Number(existing.total_budget))) : '',
  });

  // Initialize channel rows from new format, fall back to legacy columns
  const [channels, setChannels] = useState(() => {
    if (existing?.channels?.length > 0) {
      return existing.channels.map(ch => ({
        platform: ch.platform,
        amount: String(Math.round(Number(ch.amount))),
      }));
    }
    // backward compat: read old columns
    return LEGACY_CHANNELS
      .filter(lc => Number(existing?.[lc.key]) > 0)
      .map(lc => ({ platform: lc.platform, amount: String(Math.round(Number(existing[lc.key]))) }));
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const usedPlatforms = channels.map(c => c.platform).filter(Boolean);
  const availableFor  = (current) => ALL_PLATFORMS.filter(p => p.platform === current || !usedPlatforms.includes(p.platform));

  const addChannel    = () => setChannels(p => [...p, { platform: '', amount: '' }]);
  const removeChannel = (i) => setChannels(p => p.filter((_, idx) => idx !== i));
  const updateChannel = (i, key, val) => setChannels(p => p.map((ch, idx) => idx === i ? { ...ch, [key]: val } : ch));

  const channelSum = channels.reduce((s, ch) => s + (parseInt(ch.amount) || 0), 0);
  const total      = parseInt(form.total_budget) || 0;
  const remaining  = total - channelSum;
  const overBudget = remaining < 0;
  const allAllocated = total > 0 && remaining === 0;
  const canSave    = !!form.total_budget && !saving;

  const handleSave = async () => {
    if (!form.total_budget) return;
    setSaving(true); setError('');
    try {
      const payload = {
        month: parseInt(form.month),
        year:  parseInt(form.year),
        total_budget: parseInt(form.total_budget) || 0,
        channels: channels
          .filter(ch => ch.platform && parseInt(ch.amount) > 0)
          .map(ch => ({ platform: ch.platform, amount: parseInt(ch.amount) })),
      };
      if (role === 'agency') payload.brand_id = forceBrandId || form.brand_id;
      onSave(await saveBudgetPlan(payload));
    } catch (err) {
      setError(err.response?.data?.error || 'Kayıt başarısız. Tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

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
              value={fmtInput(form.total_budget)}
              onChange={e => set('total_budget', parseRaw(e.target.value))} />
          </div>

          <div style={ms.divider} />

          {/* Dynamic channel rows */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ ...ms.label, fontSize: 11 }}>Kanal Bazında Dağılım</span>
              {channels.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{channels.length} platform</span>
              )}
            </div>

            {channels.length === 0 && (
              <div style={{ textAlign: 'center', padding: '12px 0 8px', color: 'var(--text3)', fontSize: 12 }}>
                Henüz platform eklenmedi
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {channels.map((ch, i) => {
                const info = PLATFORM_MAP[ch.platform];
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <select
                      style={{ ...ms.select, color: info ? info.color : 'var(--text3)', fontWeight: info ? 600 : 400 }}
                      value={ch.platform}
                      onChange={e => updateChannel(i, 'platform', e.target.value)}
                    >
                      <option value="">— Platform Seç</option>
                      {availableFor(ch.platform).map(p => (
                        <option key={p.platform} value={p.platform}>{p.label}</option>
                      ))}
                    </select>
                    <input
                      style={ms.input}
                      type="text" inputMode="numeric" placeholder="0"
                      value={fmtInput(ch.amount)}
                      onChange={e => updateChannel(i, 'amount', parseRaw(e.target.value))}
                    />
                    <button
                      onClick={() => removeChannel(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: '4px', lineHeight: 1 }}
                      title="Kaldır"
                    >
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addChannel}
              disabled={channels.length >= ALL_PLATFORMS.length}
              style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 7, color: 'var(--teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}
            >
              + Platform Ekle
            </button>
          </div>

          {/* Allocation summary */}
          {total > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 13px', borderRadius: 8, border: '1px solid',
              background: overBudget ? 'rgba(255,107,90,0.08)' : allAllocated ? 'rgba(52,211,153,0.08)' : 'rgba(0,191,166,0.06)',
              borderColor: overBudget ? 'rgba(255,107,90,0.3)' : allAllocated ? 'rgba(52,211,153,0.35)' : 'rgba(0,191,166,0.2)',
              fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ color: 'var(--text3)' }}>Dağıtılan:</span>
              <span>₺{fmt(channelSum)} / ₺{fmt(total)}</span>
              <span style={{ color: overBudget ? 'var(--coral)' : allAllocated ? 'var(--success)' : 'var(--teal)' }}>
                {overBudget ? `₺${fmt(Math.abs(remaining))} fazla` : allAllocated ? '✓ Tüm bütçe dağıtıldı' : `₺${fmt(remaining)} kaldı`}
              </span>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(255,107,90,0.12)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--coral)', fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}
        </div>
        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>İptal</button>
          <button style={{ ...ms.saveBtn, opacity: canSave ? 1 : 0.6 }} onClick={handleSave} disabled={!canSave}>
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
  const isAgency = user?.company_type === 'agency';
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

  const resolvedForceBrandId   = forceBrandId   || (isAgency ? selectedBrand?.id          : undefined);
  const resolvedForceBrandName = forceBrandName || (isAgency ? selectedBrand?.company_name : undefined);
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [budgetPlan, setBudgetPlan] = useState(undefined);
  const [showModal, setShowModal]   = useState(false);
  const [brands, setBrands]         = useState([]);
  const [selBrandId, setSelBrandId] = useState('');

  const isEmbedded = !!resolvedForceBrandId;

  useEffect(() => {
    if (!isEmbedded && user?.company_type === 'agency') {
      getBudgetBrands().then(list => { setBrands(list); if (list.length > 0) setSelBrandId(list[0].id); });
    }
  }, [user, isEmbedded]);

  const effectiveBrandId = resolvedForceBrandId || (user?.company_type === 'agency' ? selBrandId : undefined);

  const loadPlan = useCallback(() => {
    if (user?.company_type === 'admin') return;
    const brandId = user?.company_type === 'agency' ? effectiveBrandId : undefined;
    if (user?.company_type === 'agency' && !brandId) { setBudgetPlan(null); return; }
    getBudgetPlan(selMonth, selYear, brandId).then(setBudgetPlan);
  }, [selMonth, selYear, effectiveBrandId, user]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const handleSave = (saved) => { setBudgetPlan(saved); setShowModal(false); loadPlan(); };

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

  const totalBudget = budgetPlan ? Number(budgetPlan.total_budget) : null;

  // Build channel display data: prefer new format, fall back to legacy columns
  const channelData = budgetPlan ? (() => {
    if (budgetPlan.channels?.length > 0) {
      return budgetPlan.channels.map(ch => {
        const p = PLATFORM_MAP[ch.platform] || { label: ch.platform, color: '#6B7280' };
        return { name: p.label, color: p.color, budget: Number(ch.amount) };
      });
    }
    // Legacy: show only non-zero old columns
    return LEGACY_CHANNELS
      .filter(lc => Number(budgetPlan[lc.key]) > 0)
      .map(lc => {
        const p = PLATFORM_MAP[lc.platform];
        return { name: p.label, color: p.color, budget: Number(budgetPlan[lc.key]) };
      });
  })() : [];

  const selBrand = resolvedForceBrandName
    ? { company_name: resolvedForceBrandName }
    : brands.find(b => b.id === selBrandId);

  const monthPicker = (
    <div style={s.picker}>
      <button style={s.arrowBtn} onClick={() => { if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1); } else setSelMonth(m => m - 1); }}>‹</button>
      <span style={s.monthLabel}>{MONTHS[selMonth - 1]} {selYear}</span>
      <button style={s.arrowBtn} onClick={() => { if (selMonth === 12) { setSelMonth(1); setSelYear(y => y + 1); } else setSelMonth(m => m + 1); }}>›</button>
    </div>
  );

  const budgetBody = (
    <>
      {budgetPlan === null ? (
        <div className="metrics" style={{ gridTemplateColumns: '1fr' }}>
          <div className="metric-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>📅</div>
            <div className="metric-value" style={{ fontSize: 18, color: 'var(--text3)', marginBottom: 8 }}>Bütçe Belirlenmedi</div>
            <div className="metric-sub" style={{ marginBottom: 20 }}>{MONTHS[selMonth - 1]} {selYear} için henüz bütçe belirlenmedi.</div>
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
              {channelData.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
                  Kanal bazında dağılım girilmemiş.
                </div>
              ) : channelData.map(ch => {
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
                      <div className="budget-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: ch.color, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );

  const modal = showModal && (
    <BudgetModal role={user?.company_type} brands={brands}
      month={selMonth} year={selYear} existing={budgetPlan}
      forceBrandId={resolvedForceBrandId}
      onSave={handleSave} onClose={() => setShowModal(false)} />
  );

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
          {user?.company_type === 'agency' && brands.length > 0 && (
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
        {user?.company_type === 'agency' && selBrand && (
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

// ── Stiller ───────────────────────────────────────────────────────────────────
const s = {
  picker:      { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '5px 10px' },
  arrowBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 18, lineHeight: 1, padding: '0 2px' },
  monthLabel:  { fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' },
  setBudgetBtn:{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--teal)', background: 'none', border: '1px solid var(--teal)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' },
  agencyInfo:  { marginBottom: 16, padding: '8px 14px', background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--teal)' },
};

const ms = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:     { background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, width: 460, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
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
