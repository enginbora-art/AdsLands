import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { useSubscription } from '../context/SubscriptionContext';
import SubscriptionGateModal from '../components/SubscriptionGateModal';
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  disconnectGoogleIntegration,
  getIntegrationMetrics,
  getGoogleData,
  logVerify,
  connectAppsflyer,
  connectAdjust,
  connectAdform,
  getMccAuthUrl,
  getMccAccounts,
  importMccAccounts,
  getMetaBmAuthUrl,
  getMetaBmAccounts,
  importMetaBmAccounts,
} from '../api';

const PLATFORMS = [
  { id: 'google_analytics', name: 'Google Analytics', color: '#E37400', bg: 'rgba(227,116,0,0.15)',  icon: 'GA',  isGoogle: true },
  { id: 'google_ads',       name: 'Google Ads',        color: '#4285F4', bg: 'rgba(66,133,244,0.15)', icon: 'G',   isGoogle: true },
  { id: 'meta',             name: 'Meta Ads',           color: '#1877F2', bg: 'rgba(24,119,242,0.15)', icon: 'M',   isGoogle: false },
  { id: 'tiktok',           name: 'TikTok Ads',         color: '#00BFA6', bg: 'rgba(0,191,166,0.15)',  icon: 'TT',  isGoogle: false },
  { id: 'linkedin',         name: 'LinkedIn Ads',       color: '#0A66C2', bg: 'rgba(10,102,194,0.15)', icon: 'in',  isGoogle: false },
  { id: 'appsflyer',        name: 'AppsFlyer',          color: '#00B4D8', bg: 'rgba(0,180,216,0.15)', icon: 'AF',  isApiToken: true,
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'AppsFlyer hesabınızdan alın', required: true },
      { key: 'app_id',    label: 'App ID (Opsiyonel)', placeholder: 'com.example.app', required: false },
    ]
  },
  { id: 'adjust',           name: 'Adjust',             color: '#EC407A', bg: 'rgba(236,64,122,0.15)', icon: 'ADJ', isApiToken: true,
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'Adjust Dashboard → Account Settings', required: true },
      { key: 'app_token', label: 'App Token', placeholder: 'Adjust app token', required: true },
    ]
  },
  { id: 'adform',           name: 'Adform',             color: '#E84B37', bg: 'rgba(232,75,55,0.15)',  icon: 'ADF', isApiToken: true,
    fields: [
      { key: 'tracking_id', label: 'Client Tracking ID', placeholder: 'Adform Tracking Setup ID',  required: false },
      { key: 'username',    label: 'API Username',        placeholder: 'Adform API kullanıcı adı', required: true },
      { key: 'password',    label: 'API Password',        placeholder: 'Adform API şifresi',       required: true, type: 'password' },
    ]
  },
];

const GROUPS = [
  { label: 'Google Ekosistemi', ids: ['google_analytics', 'google_ads'] },
  { label: 'Sosyal Medya',      ids: ['meta', 'tiktok', 'linkedin'] },
  { label: 'Attribution & MMP', ids: ['appsflyer', 'adjust'] },
  { label: 'Programatik / DSP', ids: ['adform'] },
];

const PLATFORM_LABELS = {
  google_ads:       'Google Ads',
  google_analytics: 'Google Analytics',
  meta:             'Meta Ads',
  tiktok:           'TikTok Ads',
  appsflyer:        'AppsFlyer',
  adjust:           'Adjust',
  adform:           'Adform',
  linkedin:         'LinkedIn Ads',
  mcc:              'Google Ads MCC',
  metabm:           'Meta Business Manager',
};

const fmt     = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 });
const fmtDate = (str) => {
  if (!str) return '';
  if (str.length === 8) return `${str.slice(6, 8)}.${str.slice(4, 6)}.${str.slice(0, 4)}`;
  return new Date(str).toLocaleDateString('tr-TR');
};

// ── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({ platform, connected, isConnecting, isDisconnecting, onConnect, onDisconnect, onDetail }) {
  const [hover, setHover] = useState(false);

  return (
    <div style={{
      background: '#161b27',
      border: connected ? '1px solid rgba(16,185,129,0.3)' : '1px solid #1e2535',
      borderRadius: 10,
      padding: '14px 14px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Icon + name + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7, flexShrink: 0,
          background: platform.bg, color: platform.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800,
        }}>
          {platform.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.25 }}>
            {platform.name}
          </div>
          <div style={{ fontSize: 11, marginTop: 3, color: connected ? '#10b981' : '#6b7280' }}>
            {connected ? '● Bağlı' : '○ Bağlı değil'}
          </div>
        </div>
        <div style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700,
          padding: '2px 7px', borderRadius: 5,
          ...(platform.isApiToken
            ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }
            : { background: 'rgba(59,130,246,0.15)',  color: '#60a5fa' }
          ),
        }}>
          {platform.isApiToken ? 'API Token' : 'OAuth'}
        </div>
      </div>

      {/* Connected stats */}
      {connected && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          background: 'rgba(255,255,255,0.03)', borderRadius: 7, padding: '8px 6px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Harcama</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>₺{fmt(connected.total_spend)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ROAS</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{Number(connected.avg_roas || 0).toFixed(2)}x</div>
          </div>
        </div>
      )}

      {/* Actions */}
      {connected ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onDetail}
            style={{ flex: 1, padding: '7px 0', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 7, color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Detay
          </button>
          <button
            onClick={onDisconnect}
            disabled={isDisconnecting}
            style={{ flex: 1, padding: '7px 0', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: isDisconnecting ? 'not-allowed' : 'pointer' }}
          >
            {isDisconnecting ? '...' : 'Kes'}
          </button>
        </div>
      ) : (
        <div
          onClick={!isConnecting ? onConnect : undefined}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            background: isConnecting ? 'rgba(0,201,167,0.05)' : hover ? 'rgba(0,201,167,0.1)' : 'transparent',
            border: '1px solid #00C9A7',
            color: '#00C9A7',
            fontWeight: 700,
            borderRadius: 8,
            padding: '8px 0',
            textAlign: 'center',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            fontSize: 12,
            transition: 'background .15s',
            userSelect: 'none',
          }}
        >
          {isConnecting ? 'Yönlendiriliyor...' : 'Bağla'}
        </div>
      )}

      {/* Account ID */}
      {connected?.account_id && (
        <div style={{
          fontSize: 10, color: '#6b7280', fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {connected.account_id}
        </div>
      )}
    </div>
  );
}

// ── Group Header ──────────────────────────────────────────────────────────────

function GroupHeader({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{
        color: '#9ca3af', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
    </div>
  );
}

// ── Banners ───────────────────────────────────────────────────────────────────

function StatusBanner({ params, onDismiss }) {
  const successPlatform = params.get('success');
  const errorPlatform   = params.get('error');
  if (successPlatform) {
    const name = PLATFORM_LABELS[successPlatform] || successPlatform;
    return (
      <div style={s.successBanner}>
        ✅ {name} başarıyla bağlandı!
        <button onClick={onDismiss} style={s.bannerClose}>×</button>
      </div>
    );
  }
  if (errorPlatform) {
    const name = PLATFORM_LABELS[errorPlatform] || errorPlatform;
    return (
      <div style={s.errorBanner}>
        ❌ {name} bağlantısı başarısız, tekrar deneyin
        <button onClick={onDismiss} style={s.bannerClose}>×</button>
      </div>
    );
  }
  return null;
}

function MsgBanner({ msg, type, onDismiss }) {
  return (
    <div style={type === 'success' ? s.successBanner : s.errorBanner}>
      {type === 'success' ? '✅' : '❌'} {msg}
      <button onClick={onDismiss} style={s.bannerClose}>×</button>
    </div>
  );
}

// ── Verify Modal ──────────────────────────────────────────────────────────────

function VerifyModal({ accountName, brandName, similarity, onConfirm, onCancel }) {
  const pct = Math.round(similarity * 100);
  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, border: '1px solid rgba(255,181,71,0.35)' }}>
        <div style={{ fontSize: 22, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Hesap Uyuşmazlığı</div>
        <div style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={s.label11}>Bağlanan Hesap</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>
              {accountName || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Bilinmiyor</span>}
            </div>
          </div>
          <div>
            <span style={s.label11}>Seçili Marka</span>
            <div style={{ fontWeight: 600, marginTop: 3 }}>{brandName}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
          Hesap adı benzerliği: <span style={{ color: 'var(--amber)', fontWeight: 700 }}>%{pct}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
          Bu hesap bu markaya ait olmayabilir. Yanlış hesap bağlarsanız analiz verileri karışabilir. Devam etmek istiyor musunuz?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={s.btnSecondary}>İptal</button>
          <button onClick={onConfirm} style={{ ...s.btnSecondary, background: 'rgba(255,181,71,0.15)', border: '1px solid rgba(255,181,71,0.4)', color: 'var(--amber)', fontWeight: 700 }}>
            Yine de Bağla
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Token Connect Modal ───────────────────────────────────────────────────────

function TokenConnectModal({ platform, onClose, onSuccess, onVerify }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fnMap = { appsflyer: connectAppsflyer, adjust: connectAdjust, adform: connectAdform };
      const fn = fnMap[platform.id] || connectAppsflyer;
      const result = await fn(form);
      if (result.verify) {
        onVerify(result);
      } else {
        onSuccess(platform.id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Bağlantı kurulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: platform.bg, color: platform.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
            {platform.icon}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{platform.name} Bağla</div>
        </div>

        <form onSubmit={handleSubmit}>
          {platform.fields.map(f => (
            <div key={f.key} style={{ marginBottom: 16 }}>
              <label style={s.label11}>{f.label}</label>
              <input
                className="sinput"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                required={f.required}
                value={form[f.key] || ''}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ marginTop: 6 }}
              />
            </div>
          ))}

          {error && <div style={s.errBox}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={s.btnSecondary}>İptal</button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid #00C9A7', borderRadius: 8, color: '#00C9A7', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Doğrulanıyor...' : 'Bağla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Import Accounts Modal (MCC / Meta BM) ─────────────────────────────────────

function ImportAccountsModal({ type, sessionId, onClose, onDone }) {
  const [accounts, setAccounts]       = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [importing, setImporting]     = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    const fn = type === 'mcc' ? getMccAccounts : getMetaBmAccounts;
    fn(sessionId)
      .then(r => { setAccounts(r.customers || r.accounts || []); })
      .catch(err => setError(err?.response?.data?.error || 'Hesaplar yüklenemedi.'))
      .finally(() => setLoadingAccts(false));
  }, [type, sessionId]);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === accounts.length) setSelected(new Set());
    else setSelected(new Set(accounts.map(a => a.id)));
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setError('');
    try {
      const fn = type === 'mcc' ? importMccAccounts : importMetaBmAccounts;
      const result = await fn({
        session_id: sessionId,
        accounts: accounts.filter(a => selected.has(a.id)),
      });
      onDone(result);
    } catch (err) {
      setError(err?.response?.data?.error || 'Import başarısız.');
    } finally {
      setImporting(false);
    }
  };

  const title = type === 'mcc' ? 'Google Ads MCC — Hesap Seç' : 'Meta Business Manager — Ad Account Seç';

  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: 560 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{title}</div>

        {loadingAccts ? (
          <div style={{ color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>Hesaplar yükleniyor...</div>
        ) : error ? (
          <div style={s.errBox}>{error}</div>
        ) : accounts.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '12px 0' }}>Erişilebilir hesap bulunamadı.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{accounts.length} hesap bulundu</span>
              <button onClick={toggleAll} style={{ ...s.btnSecondary, padding: '4px 12px', fontSize: 12 }}>
                {selected.size === accounts.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              {accounts.map(acct => (
                <div key={acct.id}
                  onClick={() => toggle(acct.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
                    background: selected.has(acct.id) ? 'rgba(0,191,166,0.07)' : 'transparent',
                    border: `1px solid ${selected.has(acct.id) ? 'rgba(0,191,166,0.3)' : 'var(--border2)'}`,
                    marginBottom: 6, cursor: 'pointer', transition: 'all 0.12s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected.has(acct.id) ? 'var(--teal)' : 'var(--border2)'}`, background: selected.has(acct.id) ? 'var(--teal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected.has(acct.id) && <span style={{ color: '#0B1219', fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      ID: {acct.id}
                      {acct.currency && ` · ${acct.currency}`}
                      {acct.isManager && ' · MCC'}
                      {acct.status === 'inactive' && ' · Pasif'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {error && !loadingAccts && accounts.length > 0 && <div style={s.errBox}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={s.btnSecondary}>İptal</button>
          {accounts.length > 0 && (
            <button onClick={handleImport} disabled={selected.size === 0 || importing}
              style={{ flex: 1, padding: '10px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: selected.size === 0 || importing ? 'not-allowed' : 'pointer', opacity: selected.size === 0 ? 0.5 : 1 }}>
              {importing ? 'Ekleniyor...' : `${selected.size} Hesabı Platforma Ekle`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Disconnect Confirm Modal ──────────────────────────────────────────────────

function DisconnectConfirmModal({ platformId, onConfirm, onCancel }) {
  const name = PLATFORM_LABELS[platformId] || platformId;
  return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, maxWidth: 400 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Bağlantıyı Kes</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
          <strong>{name}</strong> entegrasyonunu kesmek istediğinize emin misiniz?
          Bağlantı silinecek ve verilerinize erişim kesilecek.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={s.btnSecondary}>İptal</button>
          <button onClick={onConfirm}
            style={{ flex: 1, padding: '10px 0', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 8, color: 'rgb(239,68,68)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Evet, Bağlantıyı Kes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ integration, platform, metrics, liveData, liveLoading, liveError, metricsLoading, onFetchLive, onRefresh, onClose }) {
  const isGA      = integration.platform === 'google_analytics';
  const isGoogAds = integration.platform === 'google_ads';

  const rows             = liveData ? liveData.data : metrics;
  const totalSpend       = metrics.reduce((a, m) => a + Number(m.spend       || 0), 0);
  const totalImpressions = metrics.reduce((a, m) => a + Number(m.impressions || 0), 0);
  const totalClicks      = metrics.reduce((a, m) => a + Number(m.clicks      || 0), 0);
  const totalConversions = metrics.reduce((a, m) => a + Number(m.conversions || 0), 0);
  const roasRows         = metrics.filter(m => Number(m.roas) > 0);
  const avgRoas          = roasRows.length ? roasRows.reduce((a, m) => a + Number(m.roas), 0) / roasRows.length : 0;

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...s.modal, maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 28 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: platform.bg, color: platform.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            {platform.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{platform.name}</div>
            {integration.account_id && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Hesap: {integration.account_id}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', flexShrink: 0 }}>
            <div>Son bağlantı</div>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginTop: 2 }}>
              {new Date(integration.created_at).toLocaleDateString('tr-TR')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 18 }}>
          {[
            { label: 'Harcama',   val: `₺${fmt(totalSpend)}` },
            { label: 'ROAS',      val: `${avgRoas.toFixed(2)}x` },
            { label: 'Dönüşüm',  val: fmt(totalConversions) },
            { label: 'Tıklama',  val: fmt(totalClicks) },
            { label: 'Gösterim', val: fmt(totalImpressions) },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button onClick={onRefresh} disabled={metricsLoading}
            style={{ padding: '7px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: metricsLoading ? 'not-allowed' : 'pointer' }}>
            {metricsLoading ? 'Yükleniyor...' : '↻ Veriyi Yenile'}
          </button>
          {isGoogAds && (
            <button onClick={onFetchLive} disabled={liveLoading}
              style={{ padding: '7px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#10B981', fontSize: 12, fontWeight: 600, cursor: liveLoading ? 'not-allowed' : 'pointer' }}>
              {liveLoading ? 'Yükleniyor...' : '⚡ Canlı Veri Al'}
            </button>
          )}
          {liveData && (
            <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>
              Canlı · Hesap: {liveData.account_id}
            </span>
          )}
        </div>
        {liveError && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#EF4444', marginBottom: 14 }}>
            ❌ {liveError}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {metricsLoading ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 13 }}>Yükleniyor...</div>
          ) : rows.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 13 }}>
              Henüz veri yok.{isGoogAds ? ' Canlı veri almak için ⚡ butonunu kullanın.' : ''}
            </div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {(isGA && liveData
                      ? ['Tarih', 'Oturum', 'Kullanıcı', 'Dönüşüm', 'Gelir (₺)', 'Sayfa Gör.']
                      : ['Tarih', 'Harcama', 'Gösterim', 'Tıklama', 'Dönüşüm', 'ROAS']
                    ).map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={s.tr}>
                      <td style={s.td}>{fmtDate(row.date)}</td>
                      {isGA && liveData ? (
                        <>
                          <td style={s.td}>{fmt(row.sessions)}</td>
                          <td style={s.td}>{fmt(row.users)}</td>
                          <td style={s.td}>{fmt(row.conversions)}</td>
                          <td style={{ ...s.td, color: '#10B981', fontWeight: 600 }}>₺{fmt(row.revenue)}</td>
                          <td style={s.td}>{fmt(row.pageViews)}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...s.td, color: '#10B981', fontWeight: 600 }}>₺{fmt(row.spend)}</td>
                          <td style={s.td}>{fmt(row.impressions)}</td>
                          <td style={s.td}>{fmt(row.clicks)}</td>
                          <td style={s.td}>{fmt(row.conversions)}</td>
                          <td style={s.td}>{Number(row.roas || 0).toFixed(2)}x</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Integrations({ onNav }) {
  const { user }          = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const { isActive }      = useSubscription();
  const isAgency          = user?.company_type === 'agency';
  const brandId           = isAgency && selectedBrand ? selectedBrand.id : null;

  const [integrations, setIntegrations]     = useState([]);
  const [selected, setSelected]             = useState(null);
  const [metrics, setMetrics]               = useState([]);
  const [liveData, setLiveData]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [connecting, setConnecting]         = useState(null);
  const [disconnecting, setDisconnecting]   = useState(null);
  const [liveLoading, setLiveLoading]       = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [gateModal, setGateModal]           = useState(false);
  const [liveError, setLiveError]           = useState(null);
  const [banner, setBanner]                 = useState(null);
  const [msgBanner, setMsgBanner]           = useState(null);
  const [verifyParams, setVerifyParams]     = useState(null);
  const [tokenModal, setTokenModal]         = useState(null);
  const [importModal, setImportModal]       = useState(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    window.history.replaceState({}, '', window.location.pathname);

    if (params.get('mcc_session')) {
      setImportModal({ type: 'mcc', sessionId: params.get('mcc_session') });
    } else if (params.get('metabm_session')) {
      setImportModal({ type: 'metabm', sessionId: params.get('metabm_session') });
    } else if (params.get('verify')) {
      setVerifyParams({
        platform:      params.get('verify'),
        accountName:   params.get('account_name'),
        brandName:     params.get('brand_name'),
        similarity:    parseFloat(params.get('similarity') || '0'),
        integrationId: params.get('integration_id'),
      });
    } else if (params.get('success') || params.get('error')) {
      setBanner(params);
      setTimeout(() => setBanner(null), 4000);
    }
    load();
  }, [brandId]);

  const load = async () => {
    setLoading(true);
    try { setIntegrations(await getIntegrations(brandId)); }
    finally { setLoading(false); }
  };

  const showSuccess = (msg) => {
    setMsgBanner({ type: 'success', msg });
    setTimeout(() => setMsgBanner(null), 4000);
  };

  const handleVerifyConfirm = async () => {
    if (!verifyParams) return;
    try { await logVerify(verifyParams.integrationId, 'confirmed'); } catch {}
    setVerifyParams(null);
    showSuccess(`${PLATFORM_LABELS[verifyParams.platform] || verifyParams.platform} başarıyla bağlandı!`);
    load();
  };

  const handleVerifyCancel = async () => {
    if (!verifyParams) return;
    try {
      await logVerify(verifyParams.integrationId, 'cancelled');
      const p = verifyParams.platform;
      if (p === 'google_ads' || p === 'google_analytics') {
        await disconnectGoogleIntegration(p, brandId);
      } else {
        await disconnectIntegration(verifyParams.integrationId);
      }
    } catch {}
    setVerifyParams(null);
    load();
  };

  const handleConnect = async (platform) => {
    if (!isActive) { setGateModal(true); return; }
    if (platform.isApiToken) { setTokenModal(platform); return; }
    setConnecting(platform.id);
    try { await connectIntegration(platform.id, brandId); }
    catch (err) { console.error(err); setConnecting(null); }
  };

  const handleTokenSuccess = (platformId) => {
    setTokenModal(null);
    showSuccess(`${PLATFORM_LABELS[platformId]} başarıyla bağlandı!`);
    load();
  };

  const handleTokenVerify = (result) => {
    setTokenModal(null);
    setVerifyParams({
      platform:      result.platform,
      accountName:   result.account_name,
      brandName:     result.brand_name,
      similarity:    parseFloat(result.similarity),
      integrationId: result.integration_id,
    });
  };

  const handleDisconnect = (integration) => setDisconnectConfirm(integration);

  const handleDisconnectConfirmed = async () => {
    const integration = disconnectConfirm;
    setDisconnectConfirm(null);
    const isGoogle = integration.platform === 'google_analytics' || integration.platform === 'google_ads';
    setDisconnecting(integration.id);
    try {
      if (isGoogle) await disconnectGoogleIntegration(integration.platform, brandId);
      else await disconnectIntegration(integration.id);
      setIntegrations(prev => prev.filter(i => i.id !== integration.id));
      if (selected?.id === integration.id) { setSelected(null); setMetrics([]); setLiveData(null); }
    } finally { setDisconnecting(null); }
  };

  const handleSelect = async (integration) => {
    setSelected(integration);
    setLiveData(null);
    setMetricsLoading(true);
    try { setMetrics(await getIntegrationMetrics(integration.id)); }
    finally { setMetricsLoading(false); }
  };

  const handleRefresh = async () => {
    if (!selected) return;
    setLiveData(null);
    setMetricsLoading(true);
    try { setMetrics(await getIntegrationMetrics(selected.id)); }
    finally { setMetricsLoading(false); }
  };

  const handleFetchLive = async () => {
    if (!selected) return;
    setLiveError(null);
    setLiveLoading(true);
    try { setLiveData(await getGoogleData(selected.platform)); }
    catch (err) { setLiveError(err?.response?.data?.error || err.message || 'Canlı veri çekilemedi.'); }
    finally { setLiveLoading(false); }
  };

  const handleMccConnect = async () => {
    try {
      const { authUrl } = await getMccAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      alert(err?.response?.data?.error || 'MCC bağlantısı başlatılamadı.');
    }
  };

  const handleMetaBmConnect = async () => {
    try {
      const { authUrl } = await getMetaBmAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      alert(err?.response?.data?.error || 'Meta BM bağlantısı başlatılamadı.');
    }
  };

  const handleImportDone = (result) => {
    setImportModal(null);
    const msg = `${result.imported.length} marka eklendi${result.skipped.length ? `, ${result.skipped.length} zaten mevcut` : ''}.`;
    showSuccess(msg);
    load();
  };

  const getConnected = (platformId) => integrations.find(i => i.platform === platformId);

  // ── Ajans ana görünümü (marka seçilmemiş) ────────────────────────────────
  if (isAgency && !selectedBrand) {
    return (
      <div style={s.page}>
        {importModal && (
          <ImportAccountsModal
            type={importModal.type}
            sessionId={importModal.sessionId}
            onClose={() => setImportModal(null)}
            onDone={handleImportDone}
          />
        )}
        {msgBanner && <MsgBanner msg={msgBanner.msg} type={msgBanner.type} onDismiss={() => setMsgBanner(null)} />}

        <div style={s.header}>
          <h1 style={s.title}>Ajans Entegrasyonları</h1>
          <p style={s.sub}>Müşteri hesaplarınızı toplu olarak platforma aktarın.</p>
        </div>

        <div style={s.importSection}>
          <div style={s.importTitle}>Toplu Hesap Aktarımı</div>
          <p style={s.importSub}>
            Ajans hesabınızdaki tüm müşteri hesaplarını platforma aktarın;
            her biri için otomatik marka ve bağlantı oluşturulur.
          </p>
          <div style={s.importGrid}>
            <div style={s.importCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(66,133,244,0.12)', color: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>MCC</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Google Ads MCC</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>Manager Account</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
                MCC (Manager) hesabınızla bağlanın. Altındaki tüm müşteri hesaplarını listeler, seçtiklerinizi platforma marka olarak ekler.
              </p>
              <button onClick={handleMccConnect} style={{ ...s.connectBtn, width: '100%' }}>
                Google Ads MCC Bağla
              </button>
            </div>

            <div style={s.importCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(24,119,242,0.12)', color: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10 }}>BM</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Meta Business Manager</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>Business Suite</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
                Meta Business Manager hesabınızla bağlanın. Ad account'larınızı listeler, seçtiklerinizi platforma marka olarak ekler.
              </p>
              <button onClick={handleMetaBmConnect} style={{ ...s.connectBtn, width: '100%' }}>
                Meta Business Manager Bağla
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Marka entegrasyonları ─────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {gateModal && <SubscriptionGateModal onClose={() => setGateModal(false)} onNav={onNav} />}
      {verifyParams && (
        <VerifyModal
          accountName={verifyParams.accountName}
          brandName={verifyParams.brandName}
          similarity={verifyParams.similarity}
          onConfirm={handleVerifyConfirm}
          onCancel={handleVerifyCancel}
        />
      )}
      {tokenModal && (
        <TokenConnectModal
          platform={tokenModal}
          onClose={() => setTokenModal(null)}
          onSuccess={handleTokenSuccess}
          onVerify={handleTokenVerify}
        />
      )}
      {disconnectConfirm && (
        <DisconnectConfirmModal
          platformId={disconnectConfirm.platform}
          onConfirm={handleDisconnectConfirmed}
          onCancel={() => setDisconnectConfirm(null)}
        />
      )}
      {importModal && (
        <ImportAccountsModal
          type={importModal.type}
          sessionId={importModal.sessionId}
          onClose={() => setImportModal(null)}
          onDone={handleImportDone}
        />
      )}
      {selected && (
        <DetailModal
          integration={selected}
          platform={PLATFORMS.find(p => p.id === selected.platform) || { id: selected.platform, name: PLATFORM_LABELS[selected.platform] || selected.platform, icon: '?', color: '#818CF8', bg: 'rgba(99,102,241,0.15)' }}
          metrics={metrics}
          liveData={liveData}
          liveLoading={liveLoading}
          metricsLoading={metricsLoading}
          liveError={liveError}
          onFetchLive={handleFetchLive}
          onRefresh={handleRefresh}
          onClose={() => { setSelected(null); setMetrics([]); setLiveData(null); setLiveError(null); }}
        />
      )}

      {banner    && <StatusBanner params={banner} onDismiss={() => setBanner(null)} />}
      {msgBanner && <MsgBanner msg={msgBanner.msg} type={msgBanner.type} onDismiss={() => setMsgBanner(null)} />}

      <div style={s.header}>
        <h1 style={s.title}>Reklam Entegrasyonları</h1>
        <p style={s.sub}>Reklam platformlarınızı bağlayın, verilerinizi tek ekranda takip edin.</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', padding: 32, fontSize: 13 }}>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {GROUPS.map(group => (
            <div key={group.label}>
              <GroupHeader label={group.label} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
                {group.ids.map(platformId => {
                  const platform = PLATFORMS.find(p => p.id === platformId);
                  if (!platform) return null;
                  const connected      = getConnected(platformId);
                  const isConnecting   = connecting === platformId;
                  const isDisconnecting = disconnecting === connected?.id;
                  return (
                    <PlatformCard
                      key={platformId}
                      platform={platform}
                      connected={connected}
                      isConnecting={isConnecting}
                      isDisconnecting={isDisconnecting}
                      onConnect={() => handleConnect(platform)}
                      onDisconnect={() => handleDisconnect(connected)}
                      onDetail={() => handleSelect(connected)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page:         { padding: '32px 28px' },
  header:       { marginBottom: 28 },
  title:        { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  sub:          { fontSize: 13, color: 'var(--text3)' },
  connectBtn:   { flex: 1, padding: '8px 0', border: '1px solid #00C9A7', borderRadius: 8, background: 'transparent', color: '#00C9A7', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  tableWrap:    { overflowX: 'auto' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { padding: '10px 14px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', borderBottom: '1px solid var(--border2)', whiteSpace: 'nowrap' },
  tr:           { borderBottom: '1px solid var(--border2)' },
  td:           { padding: '11px 14px', fontSize: 13 },
  successBanner:{ marginBottom: 20, background: 'rgba(0,191,166,0.12)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '12px 16px', color: 'var(--teal)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  errorBanner:  { marginBottom: 20, background: 'rgba(255,107,90,0.12)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 10, padding: '12px 16px', color: 'var(--coral)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bannerClose:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'inherit', lineHeight: 1 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal:        { background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 460 },
  label11:      { color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 },
  btnSecondary: { flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' },
  errBox:       { background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, border: '1px solid rgba(255,107,90,0.2)' },
  importSection:{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 24, marginTop: 8, marginBottom: 28 },
  importTitle:  { fontSize: 15, fontWeight: 700, marginBottom: 6 },
  importSub:    { fontSize: 12, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 },
  importGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  importCard:   { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: 18 },
};
