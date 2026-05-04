import { useState, useRef, useCallback } from 'react';
import { importMediaPlan, confirmMediaPlanImport } from '../api';

// ── Platform meta ────────────────────────────────────────────────────────────
const PLATFORM_DISPLAY = {
  google:      { label: 'Google Ads',   color: '#4285F4', icon: 'G'  },
  meta:        { label: 'Meta Ads',     color: '#1877F2', icon: 'M'  },
  tiktok:      { label: 'TikTok Ads',   color: '#FF0050', icon: 'T'  },
  youtube:     { label: 'YouTube',      color: '#FF0000', icon: 'YT' },
  programatik: { label: 'Programatik',  color: '#FF6B35', icon: 'P'  },
  display:     { label: 'Display',      color: '#FF9800', icon: 'D'  },
  video:       { label: 'Video',        color: '#9C27B0', icon: 'V'  },
  x:           { label: 'X (Twitter)',  color: '#1DA1F2', icon: 'X'  },
  linkedin:    { label: 'LinkedIn',     color: '#0A66C2', icon: 'in' },
};

const KPI_LABELS = { impression: 'gösterim', click: 'tık', view: 'izlenme' };
const fmtTL = (n) => `₺${Number(n || 0).toLocaleString('tr-TR')}`;
const fmtN  = (n) => Number(n || 0).toLocaleString('tr-TR');

// ── Warning generation ────────────────────────────────────────────────────────
function buildWarnings(lines) {
  const warnings = [];
  lines.forEach((ln, idx) => {
    const pLabel = PLATFORM_DISPLAY[ln.platform]?.label || ln.platform || 'Bilinmeyen';
    const model  = ln.ad_model ? ` ${ln.ad_model}` : '';
    if (!ln.planned_kpi || Number(ln.planned_kpi) === 0) {
      const kpiLabel = KPI_LABELS[ln.kpi_type] || 'hedef';
      warnings.push({
        id: `kpi_${idx}`, lineIdx: idx, field: 'planned_kpi', type: 'kpi',
        message: `${pLabel}${model} için ${kpiLabel} hedefi bulunamadı`,
        hasEstimate: false,
      });
    }
    if (!ln.unit_price && ln.buying_type) {
      const estimate = (ln.platform === 'google' && ln.buying_type === 'CPC') ? { label: '₺3-6', value: 4.5 } : null;
      warnings.push({
        id: `price_${idx}`, lineIdx: idx, field: 'unit_price', type: 'price',
        message: `${pLabel}${model} ${ln.buying_type} fiyatı girilmemiş${estimate ? `, yaklaşık ${estimate.label} arası öngörülüyor` : ''}`,
        hasEstimate: !!estimate,
        estimateValue: estimate?.value,
      });
    }
  });
  return warnings;
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function UploadStep({ onParsed, onError }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      onError('Sadece .xlsx veya .xls dosyası yükleyebilirsiniz.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError('Dosya çok büyük. Maksimum 10MB yükleyebilirsiniz.');
      return;
    }
    setUploading(true);
    setStatusMsg('Planınız analiz ediliyor...');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const parsed = await importMediaPlan(base64, file.name);
      onParsed(parsed);
    } catch (err) {
      onError(err?.response?.data?.error || err.message || 'Yükleme başarısız.');
    } finally {
      setUploading(false);
    }
  }, [onParsed, onError]);

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Excel Medya Planı Yükle</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Ajans Excel formatındaki dijital medya planınızı yükleyin,<br />AI analiz ederek kampanya kartı oluşturur.
      </div>

      {uploading ? (
        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border2)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{statusMsg}</div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--teal)' : 'var(--border2)'}`,
            borderRadius: 12, padding: '36px 24px', cursor: 'pointer',
            background: dragging ? 'rgba(0,201,167,0.06)' : 'var(--bg)',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Dosyayı buraya sürükleyin veya tıklayın
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>.xlsx · .xls · Maks. 10MB</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files[0]; if (f) processFile(f); e.target.value = ''; }}
          />
        </div>
      )}
    </div>
  );
}

// ── Step 2: Review ────────────────────────────────────────────────────────────
function ReviewStep({ parsed, brandId, onCreated }) {
  const [name, setName]           = useState(parsed.campaign_name || '');
  const [start, setStart]         = useState(parsed.start_date || '');
  const [end, setEnd]             = useState(parsed.end_date || '');
  const [lines, setLines]         = useState(parsed.lines || []);
  const [skipped, setSkipped]     = useState(new Set());
  const [inlineEdits, setInlineEdits] = useState({});
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const warnings      = buildWarnings(lines);
  const activeWarnings = warnings.filter(w => !skipped.has(w.id) && (
    w.field === 'planned_kpi'
      ? (!lines[w.lineIdx]?.planned_kpi || Number(lines[w.lineIdx].planned_kpi) === 0)
      : (!lines[w.lineIdx]?.unit_price)
  ));

  const canCreate = name.trim() && start && end && activeWarnings.length === 0;

  const totalBudget = lines.reduce((s, l) => s + (Number(l.budget) || 0), 0);

  // Group lines by platform for summary cards
  const byPlatform = {};
  lines.forEach(ln => {
    const p = ln.platform || 'other';
    if (!byPlatform[p]) byPlatform[p] = { budget: 0, items: [] };
    byPlatform[p].budget += Number(ln.budget) || 0;
    byPlatform[p].items.push(ln);
  });

  const updateLine = (idx, field, value) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const acceptEstimate = (w) => {
    if (w.estimateValue) updateLine(w.lineIdx, 'unit_price', w.estimateValue);
    setSkipped(s => new Set([...s, w.id]));
  };

  const startInline = (w) => {
    setInlineEdits(p => ({ ...p, [w.id]: { lineIdx: w.lineIdx, field: w.field, value: '' } }));
  };

  const commitInline = (wId) => {
    const e = inlineEdits[wId];
    if (e && e.value) {
      updateLine(e.lineIdx, e.field, e.field === 'planned_kpi' ? parseInt(e.value, 10) : parseFloat(e.value));
      setSkipped(s => new Set([...s, wId]));
    }
    setInlineEdits(p => { const n = { ...p }; delete n[wId]; return n; });
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true); setError('');
    try {
      const result = await confirmMediaPlanImport({
        name: name.trim(),
        total_budget: totalBudget,
        start_date: start,
        end_date: end,
        brand_id: brandId,
        lines,
      });
      onCreated(result.id, result.name);
    } catch (err) {
      setError(err?.response?.data?.error || 'Kampanya oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const inp = { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 10px', color: 'var(--text1)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none' };

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Plan Özeti & Onay</div>

      {/* Campaign meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Kampanya Adı</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Kampanya adı giriniz"
            style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Başlangıç</div>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Bitiş</div>
          <input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Budget summary */}
      <div style={{ background: 'rgba(0,201,167,0.07)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Toplam Dijital Bütçe</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: '#00C9A7' }}>{fmtTL(totalBudget)}</span>
      </div>

      {/* Platform cards */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Platform Dağılımı</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {Object.entries(byPlatform).map(([platform, data]) => {
          const pd = PLATFORM_DISPLAY[platform] || { label: platform, color: '#6B7280', icon: '?' };
          return (
            <div key={platform} style={{ background: 'var(--bg2)', border: `1px solid ${pd.color}20`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 28, height: 28, background: `${pd.color}20`, color: pd.color, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                {pd.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{pd.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: pd.color }}>{fmtTL(data.budget)}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {data.items.map((ln, i) => (
                    <span key={i} style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 5, padding: '2px 8px', color: 'var(--text2)' }}>
                      {ln.ad_model || 'Plan'}
                      {ln.planned_kpi > 0 && (
                        <span style={{ color: 'var(--text3)', marginLeft: 4 }}>
                          ({fmtN(ln.planned_kpi)} {KPI_LABELS[ln.kpi_type] || ln.kpi_type || ''})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Eksik Bilgiler
            {activeWarnings.length > 0 && (
              <span style={{ marginLeft: 6, background: '#F59E0B20', color: '#F59E0B', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{activeWarnings.length}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {warnings.map(w => {
              const isSkipped  = skipped.has(w.id);
              const editState  = inlineEdits[w.id];
              const isResolved = isSkipped || (w.field === 'planned_kpi'
                ? lines[w.lineIdx]?.planned_kpi > 0
                : lines[w.lineIdx]?.unit_price > 0);

              if (isResolved && !editState) {
                return (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 7, fontSize: 12, color: 'var(--text3)' }}>
                    <span style={{ color: '#10B981' }}>✓</span> {w.message}
                  </div>
                );
              }

              return (
                <div key={w.id} style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>⚠ {w.message}</span>
                    {!editState && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {w.hasEstimate && (
                          <button onClick={() => acceptEstimate(w)}
                            style={wBtn('#10B981')}>Kabul Et</button>
                        )}
                        <button onClick={() => startInline(w)}
                          style={wBtn('#0EA5E9')}>{w.hasEstimate ? 'Manuel Gir' : 'Şimdi Gir'}</button>
                        <button onClick={() => setSkipped(s => new Set([...s, w.id]))}
                          style={wBtn('#6B7280')}>Atla</button>
                      </div>
                    )}
                  </div>
                  {editState && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        placeholder={w.field === 'planned_kpi' ? 'Hedef sayı' : 'Birim fiyat'}
                        value={editState.value}
                        onChange={e => setInlineEdits(p => ({ ...p, [w.id]: { ...p[w.id], value: e.target.value } }))}
                        onKeyDown={e => { if (e.key === 'Enter') commitInline(w.id); if (e.key === 'Escape') setInlineEdits(p => { const n = {...p}; delete n[w.id]; return n; }); }}
                        style={{ flex: 1, background: 'var(--bg3)', border: '1px solid #0EA5E9', borderRadius: 6, padding: '5px 9px', color: 'var(--text1)', fontSize: 12, fontFamily: 'var(--font)', outline: 'none' }}
                      />
                      <button onClick={() => commitInline(w.id)} style={wBtn('#10B981')}>Kaydet</button>
                      <button onClick={() => setInlineEdits(p => { const n = {...p}; delete n[w.id]; return n; })} style={wBtn('#6B7280')}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>
      )}

      <button
        onClick={handleCreate}
        disabled={!canCreate || saving}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
          border: 'none', cursor: canCreate && !saving ? 'pointer' : 'default',
          background: canCreate ? 'linear-gradient(135deg, #00C9A7, #0EA5E9)' : 'var(--bg2)',
          color: canCreate ? '#0B1219' : 'var(--text3)',
          transition: 'all 0.15s', fontFamily: 'var(--font)',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Oluşturuluyor...' : 'Kampanyayı Oluştur →'}
      </button>
      {!canCreate && activeWarnings.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {activeWarnings.length} eksik alan doldurulduğunda veya atlandığında aktif olur
        </div>
      )}
    </div>
  );
}

function wBtn(color) {
  return {
    padding: '4px 10px', background: `${color}15`, border: `1px solid ${color}50`,
    borderRadius: 6, color, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap',
  };
}

// ── Step 3: Done ──────────────────────────────────────────────────────────────
function DoneStep({ campaignName, campaignId, onNav }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Harika! Kampanyan hazır</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text2)' }}>{campaignName}</strong> başarıyla oluşturuldu.
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28, lineHeight: 1.6 }}>
        Platformlarını bağladığında gerçek verilerle karşılaştırmaya başlayacağız.
      </div>
      <button
        onClick={() => onNav?.(campaignId)}
        style={{
          padding: '12px 28px', background: 'var(--teal)', border: 'none', borderRadius: 10,
          color: '#0B1219', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
        }}
      >
        Kampanyayı Gör →
      </button>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ current, total = 3 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i + 1 === current ? 20 : 8, height: 8, borderRadius: 4,
          background: i + 1 <= current ? 'var(--teal)' : 'var(--border2)',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function MediaPlanImport({ onClose, brandId, onCampaignCreated }) {
  const [step, setStep]       = useState(1);
  const [parsed, setParsed]   = useState(null);
  const [error, setError]     = useState('');
  const [createdId, setCreatedId]     = useState(null);
  const [createdName, setCreatedName] = useState('');

  const handleParsed = (data) => { setParsed(data); setError(''); setStep(2); };
  const handleError  = (msg)  => setError(msg);

  const handleCreated = (id, name) => {
    setCreatedId(id); setCreatedName(name); setStep(3);
    onCampaignCreated?.(id, name);
  };

  const handleNav = (campaignId) => {
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={step !== 2 ? onClose : undefined}
    >
      <div
        style={{ background: '#1a1f2e', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 18, padding: '28px 28px 24px', maxWidth: step === 2 ? 580 : 440, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
              {step === 1 ? 'Excel\'den İçe Aktar' : step === 2 ? 'Planı İncele' : 'Tamamlandı'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>

        <StepDots current={step} />

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {step === 1 && <UploadStep onParsed={handleParsed} onError={handleError} />}
        {step === 2 && parsed && (
          <ReviewStep parsed={parsed} brandId={brandId} onCreated={handleCreated} />
        )}
        {step === 3 && <DoneStep campaignName={createdName} campaignId={createdId} onNav={handleNav} />}
      </div>
    </div>
  );
}
