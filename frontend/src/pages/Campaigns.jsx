import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import SubscriptionBanner from '../components/SubscriptionBanner';
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getCampaign, addCampaignChannel, removeCampaignChannel,
} from '../api';

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};
const PLATFORM_COLORS = {
  google_ads: '#4285F4', meta: '#1877F2', tiktok: '#69C9D0',
  linkedin: '#0A66C2', adform: '#E84B37', appsflyer: '#00B4D8', adjust: '#EC407A',
};
const ALL_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'linkedin', 'adform', 'appsflyer', 'adjust'];

const fmt    = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
const fmtInput = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
const today  = () => new Date().toISOString().split('T')[0];

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
    active:    { label: 'Aktif',       bg: 'rgba(0,201,167,0.12)',  color: '#00C9A7', dot: '#00C9A7' },
    draft:     { label: 'Kanal yok',   bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', dot: '#94a3b8' },
    completed: { label: 'Tamamlandı',  bg: 'rgba(99,102,241,0.12)', color: '#818CF8', dot: '#818CF8' },
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

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function CampaignFormModal({ existing, onClose, onSave, brandId }) {
  const [name, setName]       = useState(existing?.name || '');
  const [budget, setBudget]   = useState(existing?.total_budget || '');
  const [start, setStart]     = useState(fmtInput(existing?.start_date) || today());
  const [end, setEnd]         = useState(fmtInput(existing?.end_date) || '');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#1a1f2e', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 16, padding: '32px 28px', maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 24 }}>{existing ? 'Kampanya Düzenle' : 'Yeni Kampanya'}</div>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{error}</div>}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Kampanya Adı</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ör. Yaz Kampanyası 2025"
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Toplam Bütçe (₺)</div>
          <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="ör. 50000"
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Başlangıç</div>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Bitiş</div>
            <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
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
  const [platform, setPlatform]         = useState('');
  const [extId, setExtId]               = useState('');
  const [extName, setExtName]           = useState('');
  const [allocBudget, setAllocBudget]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const available = ALL_PLATFORMS.filter(p => !existingPlatforms.includes(p));

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
              <input value={extId} onChange={e => setExtId(e.target.value)} placeholder="Platform kampanya ID'si"
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Kampanya Adı (opsiyonel)</div>
              <input value={extName} onChange={e => setExtName(e.target.value)} placeholder="Platform üzerindeki kampanya adı"
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Ayrılan Bütçe ₺ (opsiyonel)</div>
              <input type="number" min="0" value={allocBudget} onChange={e => setAllocBudget(e.target.value)} placeholder="0"
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
            </label>
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text3)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>İptal</button>
          <button onClick={handleSave} disabled={saving || !platform || available.length === 0} style={{ flex: 2, padding: '11px 0', background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 10, color: '#00C9A7', fontWeight: 700, fontSize: 13, cursor: saving || !platform ? 'default' : 'pointer', fontFamily: 'var(--font)', opacity: (!platform || saving) ? 0.5 : 1 }}>
            {saving ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Campaign Detail Modal ─────────────────────────────────────────────────────

function CampaignDetailModal({ campaignId, brandId, onClose, onEdit, onRefresh }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showAddCh, setShowAddCh] = useState(false);
  const [removing, setRemoving]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getCampaign(campaignId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleAddChannel = async (channelData) => {
    await addCampaignChannel(campaignId, { ...channelData, brand_id: brandId });
    load(); onRefresh();
  };

  const handleRemoveChannel = async (channelId) => {
    setRemoving(channelId);
    try { await removeCampaignChannel(campaignId, channelId); load(); onRefresh(); }
    catch {}
    finally { setRemoving(null); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '24px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#141922', border: '1px solid var(--border2)', borderRadius: 16, maxWidth: 640, width: '100%', marginTop: 24 }} onClick={e => e.stopPropagation()}>
        {showAddCh && data && (
          <AddChannelModal
            campaignId={campaignId}
            campaignName={data.name}
            existingPlatforms={(data.channels || []).map(c => c.platform)}
            onClose={() => setShowAddCh(false)}
            onSave={handleAddChannel}
          />
        )}

        {/* Header */}
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
                { label: 'Harcanan', value: `₺${fmt(data.total_spend)}` },
                { label: 'Bütçe', value: `₺${fmt(data.total_budget)}` },
                { label: 'ROAS', value: `${Number(data.avg_roas || 0).toFixed(2)}x` },
                { label: 'Dönüşüm', value: fmt(data.total_conversions) },
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
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Kanallar ({(data.channels || []).length})</div>
                {data.status !== 'completed' && (data.channels || []).length < ALL_PLATFORMS.length && (
                  <button onClick={() => setShowAddCh(true)}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219', fontFamily: 'var(--font)' }}>
                    + Kanal Ekle
                  </button>
                )}
              </div>

              {(data.channels || []).length === 0 ? (
                <div style={{ background: 'rgba(148,163,184,0.05)', border: '1px dashed rgba(148,163,184,0.2)', borderRadius: 10, padding: '24px', textAlign: 'center' }}>
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
    <div onClick={onClick} style={{ background: 'var(--bg2)', border: `1px solid ${campaign.status === 'active' ? 'rgba(0,201,167,0.2)' : 'var(--border2)'}`, borderRadius: 14, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C9A7'; e.currentTarget.style.background = 'rgba(0,201,167,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = campaign.status === 'active' ? 'rgba(0,201,167,0.2)' : 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)'; }}
    >
      {campaign.has_anomaly && (
        <div title="Aktif uyarı" style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 0 3px rgba(245,158,11,0.2)' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)', lineHeight: 1.3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: campaign.has_anomaly ? 16 : 0 }}>{campaign.name}</div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Budget progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>
          <span>₺{fmt(campaign.total_spend)}</span>
          <span style={{ fontWeight: 600, color: pct >= 80 ? '#F59E0B' : 'var(--text2)' }}>%{Math.round(pct)}</span>
          <span>₺{fmt(campaign.total_budget)}</span>
        </div>
        <ProgressBar pct={pct} />
      </div>

      {/* Metrics row */}
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

      {/* Channel icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {campaign.channel_count === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Kanal bağlanmadı</span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{campaign.channel_count} kanal</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{fmtDate(campaign.start_date)} — {fmtDate(campaign.end_date)}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Campaigns({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.company_type === 'agency';
  const brandId  = isAgency ? selectedBrand?.id : null;

  const [tab, setTab]         = useState('active');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]   = useState(null);
  const [detailId, setDetailId]     = useState(null);
  const [deleting, setDeleting]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getCampaigns({ brand_id: brandId })
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  const active    = campaigns.filter(c => c.status === 'active' || c.status === 'draft');
  const completed = campaigns.filter(c => c.status === 'completed');
  const shown     = tab === 'active' ? active : completed;

  const handleCreate = async (data) => {
    await createCampaign(data);
    load();
  };

  const handleEdit = async (data) => {
    await updateCampaign(editModal.id, data);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Kampanyayı silmek istediğinizden emin misiniz?')) return;
    setDeleting(id);
    try { await deleteCampaign(id); load(); } catch {}
    finally { setDeleting(null); }
  };

  return (
    <div className="fade-in">
      {createModal && (
        <CampaignFormModal brandId={brandId || user?.company_id} onClose={() => setCreateModal(false)} onSave={handleCreate} />
      )}
      {editModal && (
        <CampaignFormModal existing={editModal} brandId={brandId || user?.company_id} onClose={() => setEditModal(null)} onSave={handleEdit} />
      )}
      {detailId && (
        <CampaignDetailModal
          campaignId={detailId}
          brandId={brandId || user?.company_id}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const c = campaigns.find(x => x.id === detailId);
            if (c) { setDetailId(null); setEditModal(c); }
          }}
          onRefresh={load}
        />
      )}

      <div className="topbar">
        <div className="topbar-title">Kampanyalar</div>
        <div className="topbar-right">
          <button onClick={() => setCreateModal(true)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219', fontFamily: 'var(--font)' }}>
            + Yeni Kampanya
          </button>
        </div>
      </div>

      <div className="content">
        <SubscriptionBanner onNav={onNav} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
          {[
            { id: 'active',    label: `Aktif${active.length > 0 ? ` (${active.length})` : ''}` },
            { id: 'completed', label: `Tamamlandı${completed.length > 0 ? ` (${completed.length})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 20px', background: 'none', border: 'none', fontFamily: 'var(--font)', borderBottom: tab === t.id ? '2px solid var(--teal)' : '2px solid transparent', color: tab === t.id ? 'var(--teal)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', fontSize: 13 }}>Yükleniyor...</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>
              {tab === 'active' ? 'Henüz kampanya yok' : 'Tamamlanmış kampanya yok'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
              {tab === 'active' ? 'Yeni bir kampanya oluşturun ve kanal bütçelerinizi yönetin.' : 'Biten kampanyalar burada görünür.'}
            </div>
            {tab === 'active' && (
              <button onClick={() => setCreateModal(true)}
                style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,201,167,0.4)', background: 'rgba(0,201,167,0.08)', color: '#00C9A7', fontFamily: 'var(--font)' }}>
                + Yeni Kampanya Oluştur
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {shown.map(c => (
              <div key={c.id} style={{ position: 'relative' }}>
                <CampaignCard campaign={c} onClick={() => setDetailId(c.id)} />
                {c.status !== 'completed' && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} disabled={deleting === c.id}
                    title="Sil"
                    style={{ position: 'absolute', bottom: 14, right: 14, width: 24, height: 24, borderRadius: 6, background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.5)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting === c.id ? 0.5 : 1 }}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
