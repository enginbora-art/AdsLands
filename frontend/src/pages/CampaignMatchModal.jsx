import { useState, useEffect } from 'react';
import { getCampaign, getPlatformCampaigns, matchCampaignChannel } from '../api';

const PLATFORM_DISPLAY = {
  google:      { label: 'Google Ads',   color: '#4285F4' },
  youtube:     { label: 'YouTube',      color: '#FF0000' },
  meta:        { label: 'Meta Ads',     color: '#1877F2' },
  tiktok:      { label: 'TikTok Ads',  color: '#FF0050' },
  linkedin:    { label: 'LinkedIn Ads', color: '#0A66C2' },
  programatik: { label: 'Programatik', color: '#FF6B35' },
  display:     { label: 'Display',      color: '#FF9800' },
  video:       { label: 'Video',        color: '#9C27B0' },
  x:           { label: 'X (Twitter)', color: '#1DA1F2' },
};

function ScoreBadge({ score }) {
  if (score == null || score <= 0) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? '#00b894' : pct >= 40 ? '#F59E0B' : '#b2bec3';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color,
      background: color + '22', borderRadius: 4,
      padding: '1px 6px', marginLeft: 6, flexShrink: 0,
    }}>
      %{pct}
    </span>
  );
}

function ManualEntry({ platform, manualInput, selected, onChange, onSelectManual, onSkip }) {
  return (
    <div>
      <label
        style={radioRowStyle(selected?.type === 'manual')}
        onClick={e => { e.preventDefault(); onSelectManual(); }}
      >
        <input
          type="radio"
          name={`plat_${platform}`}
          checked={selected?.type === 'manual'}
          onChange={onSelectManual}
          style={{ marginRight: 8, accentColor: '#4285F4' }}
        />
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>Manuel ID gir</span>
      </label>
      {selected?.type === 'manual' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, paddingLeft: 28 }}>
          <input
            placeholder="Kampanya ID"
            value={manualInput?.id || ''}
            onChange={e => onChange('id', e.target.value)}
            style={inputStyle}
            autoFocus
          />
          <input
            placeholder="Kampanya adı (isteğe bağlı)"
            value={manualInput?.name || ''}
            onChange={e => onChange('name', e.target.value)}
            style={{ ...inputStyle, flex: 2 }}
          />
        </div>
      )}
      <label
        style={{ ...radioRowStyle(selected?.type === 'skip'), marginTop: 4 }}
        onClick={e => { e.preventDefault(); onSkip(); }}
      >
        <input
          type="radio"
          name={`plat_${platform}`}
          checked={selected?.type === 'skip'}
          onChange={onSkip}
          style={{ marginRight: 8, accentColor: '#b2bec3' }}
        />
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>Bu kanalı atla</span>
      </label>
    </div>
  );
}

export default function CampaignMatchModal({ campaignId, campaignName, onDone, onClose }) {
  const [channels, setChannels]       = useState([]);
  const [loadingCh, setLoadingCh]     = useState(true);
  const [platformData, setPlatformData] = useState({});
  const [selections, setSelections]   = useState({});
  const [manualInputs, setManualInputs] = useState({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');

  useEffect(() => {
    getCampaign(campaignId)
      .then(c => {
        const imported = (c.channels || []).filter(ch => ch.imported_from_plan);
        setChannels(imported);
        setLoadingCh(false);
        imported.forEach(ch => fetchPlatform(ch.platform));
      })
      .catch(() => setLoadingCh(false));
  }, [campaignId]);

  async function fetchPlatform(platform) {
    setPlatformData(prev => ({ ...prev, [platform]: { loading: true } }));
    try {
      const data = await getPlatformCampaigns(campaignId, platform);
      setPlatformData(prev => ({ ...prev, [platform]: { loading: false, ...data } }));
    } catch {
      setPlatformData(prev => ({ ...prev, [platform]: { loading: false, campaigns: [], manual: true, message: 'Kampanyalar yüklenemedi.' } }));
    }
  }

  function setSelection(platform, sel) {
    setSelections(prev => ({ ...prev, [platform]: sel }));
  }

  function updateManual(platform, field, value) {
    setManualInputs(prev => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }));
    if (selections[platform]?.type === 'manual') {
      setSelections(prev => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }));
    }
  }

  const allSelected = channels.length > 0 && channels.every(ch => selections[ch.platform]);

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      for (const ch of channels) {
        const sel = selections[ch.platform];
        if (!sel) continue;
        if (sel.type === 'skip') {
          await matchCampaignChannel(campaignId, ch.platform, { match_status: 'skipped' });
        } else {
          const id   = sel.type === 'manual' ? (manualInputs[ch.platform]?.id   || '') : sel.id;
          const name = sel.type === 'manual' ? (manualInputs[ch.platform]?.name || '') : sel.name;
          await matchCampaignChannel(campaignId, ch.platform, {
            external_campaign_id:   id   || null,
            external_campaign_name: name || null,
            match_status: 'matched',
          });
        }
      }
      onDone();
    } catch {
      setSaveError('Eşleştirme kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)' }}>Platform ID Eşleştirme</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{campaignName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '10px 24px 0', fontSize: 13, color: 'var(--text3)' }}>
          İçe aktarılan her kanal için platform kampanya ID'sini seçin ya da manuel olarak girin.
        </div>

        {/* Channel list */}
        <div style={{ padding: '16px 24px', maxHeight: 420, overflowY: 'auto' }}>
          {loadingCh ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 24 }}>Kanallar yükleniyor...</div>
          ) : channels.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 24 }}>Eşleştirilecek kanal bulunamadı.</div>
          ) : channels.map(ch => {
            const pd  = PLATFORM_DISPLAY[ch.platform] || { label: ch.platform, color: '#636e72' };
            const pld = platformData[ch.platform] || {};
            const sel = selections[ch.platform];

            return (
              <div key={ch.platform} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: pd.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text1)' }}>{pd.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    ₺{Number(ch.allocated_budget || 0).toLocaleString('tr-TR')}
                  </span>
                  {sel && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#00C9A7', fontWeight: 600 }}>
                      {sel.type === 'skip' ? 'Atlandı' : '✓ Seçildi'}
                    </span>
                  )}
                </div>

                {pld.loading ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Kampanyalar yükleniyor...</div>
                ) : pld.manual ? (
                  <>
                    {pld.message && (
                      <div style={infoBannerStyle}>{pld.message}</div>
                    )}
                    <ManualEntry
                      platform={ch.platform}
                      manualInput={manualInputs[ch.platform]}
                      selected={sel}
                      onChange={(f, v) => updateManual(ch.platform, f, v)}
                      onSelectManual={() => setSelection(ch.platform, { type: 'manual' })}
                      onSkip={() => setSelection(ch.platform, { type: 'skip' })}
                    />
                  </>
                ) : (
                  <>
                    {(pld.campaigns || []).slice(0, 5).map(c => (
                      <label
                        key={c.id}
                        style={radioRowStyle(sel?.type === 'suggestion' && sel.id === c.id)}
                        onClick={e => { e.preventDefault(); setSelection(ch.platform, { type: 'suggestion', id: c.id, name: c.name }); }}
                      >
                        <input
                          type="radio"
                          name={`plat_${ch.platform}`}
                          checked={sel?.type === 'suggestion' && sel.id === c.id}
                          onChange={() => setSelection(ch.platform, { type: 'suggestion', id: c.id, name: c.name })}
                          style={{ marginRight: 8, accentColor: pd.color }}
                        />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                        <ScoreBadge score={c.score} />
                      </label>
                    ))}
                    <ManualEntry
                      platform={ch.platform}
                      manualInput={manualInputs[ch.platform]}
                      selected={sel}
                      onChange={(f, v) => updateManual(ch.platform, f, v)}
                      onSelectManual={() => setSelection(ch.platform, { type: 'manual' })}
                      onSkip={() => setSelection(ch.platform, { type: 'skip' })}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {saveError && (
          <div style={{ margin: '0 24px 12px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', fontSize: 13 }}>
            {saveError}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Şimdi Atla</button>
          <button
            onClick={handleSave}
            disabled={!allSelected || saving}
            style={{ ...primaryBtnStyle, opacity: (!allSelected || saving) ? 0.45 : 1, cursor: (!allSelected || saving) ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Kaydediliyor...' : 'Tamamla'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1100, padding: 16,
};
const modalStyle = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 14, width: '100%', maxWidth: 540,
  boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
};
const cardStyle = {
  background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px', marginBottom: 10,
};
const radioRowStyle = (active) => ({
  display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 6,
  cursor: 'pointer', marginBottom: 2,
  background: active ? 'rgba(0,201,167,0.08)' : 'transparent',
  border: `1px solid ${active ? 'rgba(0,201,167,0.35)' : 'transparent'}`,
  userSelect: 'none',
});
const infoBannerStyle = {
  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#F59E0B', marginBottom: 8,
};
const primaryBtnStyle = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 22px', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font)',
};
const secondaryBtnStyle = {
  background: 'none', border: '1px solid var(--border2)', borderRadius: 8,
  padding: '9px 18px', color: 'var(--text3)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)',
};
const inputStyle = {
  flex: 1, background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none',
  color: 'var(--text1)', fontFamily: 'var(--font)',
};
