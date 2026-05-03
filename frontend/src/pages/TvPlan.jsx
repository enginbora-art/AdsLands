import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { NoBrandSelected } from '../components/AgencyGuard';
import {
  getTvCampaigns, createTvPlan, deleteTvPlan,
  getTvPlans, getTvPlanItems, addTvPlanItem,
  updateTvPlanItem, deleteTvPlanItem, getTvPlanSummary,
  getTvAiSuggestions, applyTvAiSuggestion,
} from '../api';

// ── Sabitler ───────────────────────────────────────────────────────────────────

const TR_CHANNELS = [
  { code: 'trt1',      name: 'TRT 1',     color: '#1B4FBF' },
  { code: 'kanald',    name: 'Kanal D',   color: '#E30613' },
  { code: 'showtv',    name: 'Show TV',   color: '#FF6B00' },
  { code: 'atv',       name: 'ATV',       color: '#00843D' },
  { code: 'startv',    name: 'Star TV',   color: '#B8A000' },
  { code: 'foxtv',     name: 'FOX TV',    color: '#003087' },
  { code: 'tv8',       name: 'TV8',       color: '#E4002B' },
  { code: 'trt2',      name: 'TRT 2',     color: '#1B4FBF' },
  { code: 'cnnturk',   name: 'CNN Türk',  color: '#CC0000' },
  { code: 'ntv',       name: 'NTV',       color: '#005EB8' },
  { code: 'haberturk', name: 'Habertürk', color: '#FF0000' },
  { code: 'tv360',     name: 'TV360',     color: '#6B7280' },
];

const DAYPARTS = [
  { code: 'sabah', name: 'Sabah Kuşağı', time: '07:00-09:00' },
  { code: 'ogle',  name: 'Öğle Kuşağı',  time: '12:00-14:00' },
  { code: 'aksam', name: 'Akşam Kuşağı', time: '18:00-20:00' },
  { code: 'prime', name: 'Prime Time',   time: '20:00-23:00' },
  { code: 'gece',  name: 'Gece Kuşağı',  time: '23:00-01:00' },
];

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const STATUS_CFG = {
  planned:  { label: 'Planlandı',     icon: '⬜', bg: 'rgba(156,163,175,0.15)', color: '#9CA3AF' },
  detected: { label: 'Tespit Edildi', icon: '✅', bg: 'rgba(16,185,129,0.15)',  color: '#10B981' },
  missed:   { label: 'Kaçırıldı',     icon: '❌', bg: 'rgba(239,68,68,0.15)',   color: '#EF4444' },
  pending:  { label: 'Bekliyor',      icon: '⏳', bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
};

const PLAN_STATUS_CFG = {
  draft:     { label: 'Taslak',     bg: 'rgba(156,163,175,0.15)', color: '#9CA3AF' },
  active:    { label: 'Aktif',      bg: 'rgba(29,158,117,0.15)',  color: '#1D9E75' },
  completed: { label: 'Tamamlandı', bg: 'rgba(59,130,246,0.15)', color: '#3B82F6' },
};

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
const chByCode = (code) => TR_CHANNELS.find(c => c.code === code) || { name: code, color: '#6B7280' };

const CSS = `
@keyframes tvIn  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes tvSlide{ from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
@keyframes aiPulse{ 0%,100%{opacity:1} 50%{opacity:0.5} }
.tv-card { transition: border-color 0.15s, box-shadow 0.15s; }
.tv-card:hover { border-color: rgba(29,158,117,0.4) !important; box-shadow: 0 8px 28px rgba(0,0,0,0.25); }
.tv-row:hover td { background: rgba(255,255,255,0.025) !important; }
`;

// ── Shared UI ──────────────────────────────────────────────────────────────────

const inputSt = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' };
const selectSt = { ...inputSt, cursor: 'pointer' };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', animation: 'tvIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border2)' }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: 12, background: disabled ? 'rgba(29,158,117,0.35)' : '#1D9E75', border: 'none', borderRadius: 9, color: '#0B1219', fontWeight: 700, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
      {children}
    </button>
  );
}

// ── Yeni Plan Modal ────────────────────────────────────────────────────────────

function NewPlanModal({ campaigns, brandId, onClose, onCreate }) {
  const now = new Date();
  const [f, setF] = useState({ plan_name: '', campaign_id: '', month: now.getMonth() + 1, year: now.getFullYear() });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.plan_name.trim()) return setErr('Plan adı zorunludur.');
    setSaving(true); setErr('');
    try { await onCreate({ ...f, brand_id: brandId }); onClose(); }
    catch (e) { setErr(e.response?.data?.error || e.message || 'Hata oluştu.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="📺 Yeni TV Medya Planı" onClose={onClose}>
      <Field label="Plan Adı">
        <input style={inputSt} placeholder="Örn: Nisan 2026 Kampanyası" value={f.plan_name} onChange={e => set('plan_name', e.target.value)} />
      </Field>
      <Field label="Kampanya (Opsiyonel)">
        <select style={selectSt} value={f.campaign_id} onChange={e => set('campaign_id', e.target.value)}>
          <option value="">Kampanya seçin (opsiyonel)</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Ay">
          <select style={selectSt} value={f.month} onChange={e => set('month', Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </Field>
        <Field label="Yıl">
          <input style={inputSt} type="number" min="2024" max="2030" value={f.year} onChange={e => set('year', Number(e.target.value))} />
        </Field>
      </div>
      {err && <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{err}</div>}
      <PrimaryBtn onClick={submit} disabled={saving}>{saving ? 'Oluşturuluyor...' : '+ Plan Oluştur'}</PrimaryBtn>
    </Modal>
  );
}

// ── Yeni Spot Modal ────────────────────────────────────────────────────────────

function NewSpotModal({ planId, onClose, onAdd }) {
  const [f, setF] = useState({ channel_code: '', channel_name: '', daypart: '', broadcast_date: '', broadcast_time_start: '', spot_duration: 30, grp: '', spot_price: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const onChannel = (code) => { const ch = TR_CHANNELS.find(c => c.code === code); set('channel_code', code); set('channel_name', ch?.name || code); };
  const onDaypart = (code) => { const dp = DAYPARTS.find(d => d.code === code); set('daypart', code); if (dp && !f.broadcast_time_start) set('broadcast_time_start', dp.time.split('-')[0]); };

  const submit = async () => {
    if (!f.channel_code) return setErr('Kanal seçin.');
    setSaving(true); setErr('');
    try { await onAdd(planId, { ...f, grp: parseFloat(f.grp) || 0, spot_price: parseFloat(f.spot_price) || 0 }); onClose(); }
    catch (e) { setErr(e.response?.data?.error || e.message || 'Hata oluştu.'); }
    finally { setSaving(false); }
  };

  const selCh = TR_CHANNELS.find(c => c.code === f.channel_code);

  return (
    <Modal title="➕ Spot Ekle" onClose={onClose} width={520}>
      <Field label="Kanal">
        <select style={{ ...selectSt, borderLeft: selCh ? `4px solid ${selCh.color}` : undefined }} value={f.channel_code} onChange={e => onChannel(e.target.value)}>
          <option value="">Kanal seçin</option>
          {TR_CHANNELS.map(ch => <option key={ch.code} value={ch.code}>{ch.name}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Kuşak">
          <select style={selectSt} value={f.daypart} onChange={e => onDaypart(e.target.value)}>
            <option value="">Kuşak seçin</option>
            {DAYPARTS.map(d => <option key={d.code} value={d.code}>{d.name} ({d.time})</option>)}
          </select>
        </Field>
        <Field label="Tarih">
          <input style={inputSt} type="date" value={f.broadcast_date} onChange={e => set('broadcast_date', e.target.value)} />
        </Field>
        <Field label="Yayın Saati (HH:MM)">
          <input style={inputSt} type="time" value={f.broadcast_time_start} onChange={e => set('broadcast_time_start', e.target.value)} />
        </Field>
        <Field label="Süre (saniye)">
          <select style={selectSt} value={f.spot_duration} onChange={e => set('spot_duration', Number(e.target.value))}>
            <option value={15}>15 sn</option>
            <option value={30}>30 sn</option>
            <option value={60}>60 sn</option>
          </select>
        </Field>
        <Field label="GRP">
          <input style={inputSt} type="number" min="0" step="0.1" placeholder="0.0" value={f.grp} onChange={e => set('grp', e.target.value)} />
        </Field>
        <Field label="Spot Fiyatı (₺)">
          <input style={inputSt} type="number" min="0" placeholder="0" value={f.spot_price} onChange={e => set('spot_price', e.target.value)} />
        </Field>
      </div>
      {err && <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{err}</div>}
      <PrimaryBtn onClick={submit} disabled={saving}>{saving ? 'Ekleniyor...' : '+ Spot Ekle'}</PrimaryBtn>
    </Modal>
  );
}

// ── Plan Kartı ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, onDetail, onDelete, idx }) {
  const ps = PLAN_STATUS_CFG[plan.status] || PLAN_STATUS_CFG.draft;
  const total = (plan.detected_count || 0) + (plan.missed_count || 0) + (plan.planned_count || 0);
  const rate  = total > 0 ? Math.round((plan.detected_count || 0) / total * 100) : 0;

  return (
    <div className="tv-card" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: 22, animation: `tvIn 0.35s ease ${idx * 0.07}s both` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>📺</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{plan.plan_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{MONTHS[(plan.month || 1) - 1]} {plan.year}</div>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: ps.bg, color: ps.color, whiteSpace: 'nowrap' }}>{ps.label}</span>
      </div>

      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        <span>📡 {plan.channel_count || 0} kanal</span>
        <span>🎬 {plan.spot_count || 0} spot</span>
        <span>💰 ₺{fmt(plan.total_budget)}</span>
        <span>📊 {Number(plan.total_grp || 0).toFixed(1)} GRP</span>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
          <span style={{ color: 'var(--text3)' }}>Tespit oranı</span>
          <span style={{ fontWeight: 700, color: rate >= 70 ? '#10B981' : rate >= 40 ? '#F59E0B' : '#9CA3AF' }}>{rate}%</span>
        </div>
        <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${rate}%`, background: rate >= 70 ? '#10B981' : rate >= 40 ? '#F59E0B' : '#6B7280', borderRadius: 3, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onDetail(plan)} style={{ flex: 1, padding: '8px', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)', borderRadius: 7, color: '#1D9E75', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          Detay →
        </button>
        <button onClick={() => { if (window.confirm('Bu planı silmek istediğinizden emin misiniz?')) onDelete(plan.id); }} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#EF4444', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          Sil
        </button>
      </div>
    </div>
  );
}

// ── Özet Bar ───────────────────────────────────────────────────────────────────

function SummaryBar({ plan, items }) {
  const detected = items.filter(i => i.status === 'detected').length;
  const missed   = items.filter(i => i.status === 'missed').length;
  const total    = items.length;
  const rate     = total > 0 ? Math.round(detected / total * 100) : 0;

  const ms = [
    { l: 'Toplam Bütçe', v: `₺${fmt(plan.total_budget)}`,             c: '#1D9E75' },
    { l: 'Toplam GRP',   v: `${Number(plan.total_grp || 0).toFixed(1)}`, c: '#3B82F6' },
    { l: 'Toplam Spot',  v: total,                                      c: '#9CA3AF' },
    { l: 'Tespit',       v: detected,                                   c: '#10B981' },
    { l: 'Kaçırıldı',   v: missed,                                     c: '#EF4444' },
    { l: 'Başarı',       v: `%${rate}`, c: rate >= 70 ? '#10B981' : rate >= 40 ? '#F59E0B' : '#9CA3AF' },
  ];

  return (
    <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      {ms.map((m, i) => (
        <div key={m.l} style={{ flex: 1, padding: '14px 10px', borderRight: i < ms.length - 1 ? '1px solid var(--border2)' : 'none', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{m.l}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: m.c }}>{m.v}</div>
        </div>
      ))}
    </div>
  );
}

// ── Spot Tablosu ───────────────────────────────────────────────────────────────

function SpotTable({ items, canEdit, onStatusChange, onDelete }) {
  if (!items.length) {
    return (
      <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🎬</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Henüz spot eklenmedi</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Yukarıdaki "+ Spot Ekle" butonunu kullanın</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border2)', background: 'var(--bg3)' }}>
              {['Kanal', 'Kuşak', 'Tarih', 'Saat', 'Süre', 'GRP', 'Fiyat', 'Durum', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const ch = chByCode(item.channel_code);
              const sc = STATUS_CFG[item.status] || STATUS_CFG.planned;
              const dp = DAYPARTS.find(d => d.code === item.daypart);
              const dateStr = item.broadcast_date
                ? new Date(item.broadcast_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                : '—';
              const timeStr = item.broadcast_time_start ? item.broadcast_time_start.slice(0, 5) : '—';

              return (
                <tr key={item.id} className="tv-row" style={{ borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 6, background: `${ch.color}18`, color: ch.color, border: `1px solid ${ch.color}30` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />{ch.name}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{dp?.name || item.daypart || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{dateStr}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>{timeStr}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.spot_duration}sn</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)' }}>{Number(item.grp || 0).toFixed(1)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap' }}>₺{fmt(item.spot_price)}</td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    {canEdit ? (
                      <select value={item.status} onChange={e => onStatusChange(item.id, e.target.value)}
                        style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)', cursor: 'pointer' }}>
                        {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: sc.bg, color: sc.color }}>{sc.icon} {sc.label}</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 8px' }}>
                    {canEdit && (
                      <button onClick={() => onDelete(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1, borderRadius: 4 }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; }}>
                        ×
                      </button>
                    )}
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

// ── Kanal Özet Kartları ────────────────────────────────────────────────────────

function ChannelCards({ channelSummary }) {
  if (!channelSummary?.length) return null;
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Kanal Bazında Özet</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {channelSummary.map(ch => {
          const channel = chByCode(ch.channel_code);
          const rate = ch.spot_count > 0 ? Math.round((ch.detected || 0) / ch.spot_count * 100) : 0;
          return (
            <div key={ch.channel_code} style={{ background: 'var(--bg2)', border: `1px solid ${channel.color}25`, borderLeft: `3px solid ${channel.color}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: channel.color, marginBottom: 12 }}>{channel.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Spot', ch.spot_count], ['GRP', Number(ch.total_grp || 0).toFixed(1)], ['Harcama', `₺${fmt(ch.total_spend)}`], ['Tespit', `%${rate}`]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: l === 'Tespit' ? (rate >= 70 ? '#10B981' : '#F59E0B') : 'var(--text1)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Plan Detay ─────────────────────────────────────────────────────────────────

// ── AI Öneri Kartı ─────────────────────────────────────────────────────────────

const PRIORITY_CFG = {
  high:   { label: 'Yüksek',  bg: 'rgba(239,68,68,0.1)',    color: '#ef4444',  border: 'rgba(239,68,68,0.25)' },
  medium: { label: 'Orta',    bg: 'rgba(245,158,11,0.1)',   color: '#f59e0b',  border: 'rgba(245,158,11,0.25)' },
  low:    { label: 'Düşük',   bg: 'rgba(99,102,241,0.1)',   color: '#818cf8',  border: 'rgba(99,102,241,0.25)' },
};

function SuggestionCard({ suggestion, isApplied, isApplying, onApply }) {
  const pCfg = PRIORITY_CFG[suggestion.priority] || PRIORITY_CFG.medium;
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'tvIn 0.25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.border}`, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {pCfg.label}
            </span>
            {isApplied && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                ✓ Uygulandı
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', lineHeight: 1.4 }}>{suggestion.title}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>{suggestion.description}</div>
      {suggestion.evidence && (
        <div style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 7, padding: '6px 10px', lineHeight: 1.5 }}>
          📊 {suggestion.evidence}
        </div>
      )}
      {!isApplied && (
        <button
          onClick={() => onApply(suggestion)}
          disabled={isApplying}
          style={{ alignSelf: 'flex-start', padding: '7px 16px', background: isApplying ? 'rgba(29,158,117,0.35)' : 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.35)', borderRadius: 7, color: '#1D9E75', fontSize: 12, fontWeight: 700, cursor: isApplying ? 'wait' : 'pointer', fontFamily: 'var(--font)' }}>
          {isApplying ? 'Uygulanıyor...' : 'Planıma Uygula'}
        </button>
      )}
    </div>
  );
}

function AiSuggestionsPanel({ suggestions, overallInsight, appliedIds, applyingId, onApply, onRefresh, loading }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '20px 22px', marginBottom: 24, animation: 'tvIn 0.2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>AI Önerileri</span>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontWeight: 700 }}>
            {suggestions.length} öneri
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text3)', fontSize: 11, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font)' }}>
          ↻ Yenile
        </button>
      </div>
      {overallInsight && (
        <div style={{ fontSize: 12, color: 'var(--text2)', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, lineHeight: 1.6 }}>
          {overallInsight}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {suggestions.map(s => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            isApplied={appliedIds.has(s.id)}
            isApplying={applyingId === s.id}
            onApply={onApply}
          />
        ))}
      </div>
    </div>
  );
}

// ── Plan Detayı ────────────────────────────────────────────────────────────────

function PlanDetail({ plan, companyId, onBack }) {
  const [items, setItems]     = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSpot, setShowSpot] = useState(false);

  // AI öneri state
  const [aiState, setAiState]         = useState('idle'); // idle | loading | done | error | no_data
  const [aiResult, setAiResult]       = useState(null);
  const [aiError, setAiError]         = useState('');
  const [aiNoDataMsg, setAiNoDataMsg] = useState('');
  const [appliedIds, setAppliedIds]   = useState(new Set());
  const [applyingId, setApplyingId]   = useState(null);

  const canEdit = plan.company_id === companyId;

  const reload = async () => {
    const [its, sum] = await Promise.all([getTvPlanItems(plan.id), getTvPlanSummary(plan.id)]);
    setItems(its); setSummary(sum);
  };

  useEffect(() => { setLoading(true); reload().finally(() => setLoading(false)); }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (planId, data) => {
    await addTvPlanItem(planId, data);
    await reload();
  };

  const handleStatus = async (itemId, status) => {
    await updateTvPlanItem(plan.id, itemId, { status });
    setItems(p => p.map(i => i.id === itemId ? { ...i, status } : i));
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Bu spotu silmek istediğinizden emin misiniz?')) return;
    await deleteTvPlanItem(plan.id, itemId);
    await reload();
  };

  const enriched = summary?.plan || plan;

  const runAiSuggest = async () => {
    setAiState('loading'); setAiError(''); setAiResult(null); setAiNoDataMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/tv/plans/${plan.id}/ai-suggest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.status === 403 || res.status === 429) {
        const e = await res.json().catch(() => ({}));
        setAiError(e.error || 'AI kullanım limiti doldu veya abonelik gerekli.');
        setAiState('error'); return;
      }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'AI analiz başarısız.'); }

      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { setAiState('done'); return; }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.no_data) { setAiNoDataMsg(parsed.message); setAiState('no_data'); return; }
            if (parsed.result) { setAiResult(parsed.result); }
          } catch (e) { if (e.message !== 'Unexpected token') { setAiError(e.message); setAiState('error'); return; } }
        }
      }
      setAiState('done');
    } catch (err) { setAiError(err.message); setAiState('error'); }
  };

  const handleApply = async (suggestion) => {
    setApplyingId(suggestion.id);
    try {
      const result = await applyTvAiSuggestion(plan.id, { suggestion_id: suggestion.id, action: suggestion.action });
      setAppliedIds(prev => new Set([...prev, suggestion.id]));
      if (result?.new_item) await reload(); // yeni spot eklendiyse planı yenile
    } catch (err) { console.error('AI apply hatası:', err); }
    finally { setApplyingId(null); }
  };

  return (
    <div style={{ animation: 'tvSlide 0.25s ease' }}>
      {/* Breadcrumb + AI butonu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', padding: '6px 10px', borderRadius: 6 }}>
          ← Geri
        </button>
        <span style={{ color: 'var(--text3)' }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{plan.plan_name}</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'rgba(29,158,117,0.1)', color: 'var(--teal)', marginLeft: 4 }}>
          {MONTHS[(plan.month || 1) - 1]} {plan.year}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={runAiSuggest}
            disabled={aiState === 'loading' || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.4)',
              background: aiState === 'loading' ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.12)',
              color: '#a78bfa', fontWeight: 700, fontSize: 12, cursor: aiState === 'loading' || loading ? 'wait' : 'pointer',
              fontFamily: 'var(--font)', transition: 'background 0.15s',
            }}>
            {aiState === 'loading'
              ? <><span style={{ animation: 'aiPulse 1s infinite' }}>✨</span> Analiz ediliyor...</>
              : <><span>✨</span> AI Öneri</>}
          </button>
        </div>
      </div>

      {/* Ajans bilgi notu */}
      {!canEdit && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#3B82F6', display: 'flex', gap: 8 }}>
          ℹ️ Bu plan <strong style={{ marginLeft: 4 }}>{plan.creator_name}</strong> tarafından hazırlanmıştır. Düzenleme yetkiniz bulunmamaktadır.
        </div>
      )}

      {/* AI sonuçları */}
      {aiState === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ {aiError}</span>
          <button onClick={() => setAiState('idle')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>
      )}
      {aiState === 'no_data' && (
        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: '#818cf8' }}>
          ℹ️ {aiNoDataMsg}
        </div>
      )}
      {(aiState === 'done' || aiState === 'loading') && aiResult?.suggestions?.length > 0 && (
        <AiSuggestionsPanel
          suggestions={aiResult.suggestions}
          overallInsight={aiResult.overall_insight}
          appliedIds={appliedIds}
          applyingId={applyingId}
          onApply={handleApply}
          onRefresh={runAiSuggest}
          loading={aiState === 'loading'}
        />
      )}

      <SummaryBar plan={enriched} items={items} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Yayın Planı</div>
        {canEdit && (
          <button onClick={() => setShowSpot(true)} style={{ padding: '8px 18px', background: '#1D9E75', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            + Spot Ekle
          </button>
        )}
      </div>

      {loading
        ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Yükleniyor...</div>
        : <SpotTable items={items} canEdit={canEdit} onStatusChange={handleStatus} onDelete={handleDelete} />
      }

      {!loading && <ChannelCards channelSummary={summary?.channelSummary} />}

      {showSpot && <NewSpotModal planId={plan.id} onClose={() => setShowSpot(false)} onAdd={handleAdd} />}
    </div>
  );
}

// ── Ana Bileşen ────────────────────────────────────────────────────────────────

export default function TvPlan() {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency  = user?.company_type === 'agency';
  const brandId   = isAgency ? selectedBrand?.id : null;
  const brandName = isAgency ? (selectedBrand?.name || selectedBrand?.company_name) : null;

  if (isAgency && !selectedBrand) return <NoBrandSelected pageName="TV Medya Planı" />;

  const [view, setView]         = useState('list');
  const [selPlan, setSelPlan]   = useState(null);
  const [plans, setPlans]       = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getTvPlans(brandId), getTvCampaigns(brandId)])
      .then(([ps, cs]) => { setPlans(ps); setCampaigns(cs); })
      .finally(() => setLoading(false));
  }, [brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCreate = async (data) => {
    const plan = await createTvPlan(data);
    setPlans(p => [{ ...plan, spot_count: 0, channel_count: 0, detected_count: 0, missed_count: 0, planned_count: 0 }, ...p]);
  };

  const onDelete = async (id) => {
    await deleteTvPlan(id);
    setPlans(p => p.filter(pl => pl.id !== id));
  };

  const onDetail = (plan) => { setSelPlan(plan); setView('detail'); };
  const onBack   = () => { setView('list'); setSelPlan(null); getTvPlans(brandId).then(setPlans); };

  const pageTitle = brandName ? `TV Medya Planı — ${brandName}` : 'TV Medya Planı';

  return (
    <div className="fade-in">
      <style>{CSS}</style>

      <div className="topbar">
        <div className="topbar-title">{pageTitle}</div>
        {view === 'list' && (
          <div className="topbar-actions">
            <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#1D9E75', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              + Yeni Plan Oluştur
            </button>
          </div>
        )}
      </div>

      <div className="content">
        {view === 'list' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
          ) : plans.length === 0 ? (
            <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📺</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Henüz TV medya planı yok</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28, lineHeight: 1.7 }}>TV yayın planlarınızı oluşturun, spot bazında takip edin.<br />Ajans olarak marka adına plan hazırlayabilirsiniz.</div>
              <button onClick={() => setShowNew(true)} style={{ padding: '12px 28px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#0B1219', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                + İlk Planı Oluştur
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
              {plans.map((p, i) => <PlanCard key={p.id} plan={p} idx={i} onDetail={onDetail} onDelete={onDelete} />)}
            </div>
          )
        )}

        {view === 'detail' && selPlan && (
          <PlanDetail plan={selPlan} companyId={user?.company_id} onBack={onBack} />
        )}
      </div>

      {showNew && (
        <NewPlanModal campaigns={campaigns} brandId={brandId} onClose={() => setShowNew(false)} onCreate={onCreate} />
      )}
    </div>
  );
}
