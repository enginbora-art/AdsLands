export default function SubscriptionGateModal({ onClose, onNav }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#1a1f2e', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 16, padding: '32px 28px', maxWidth: 380, width: '100%', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
        <h2 style={{ color: '#f1f5f9', margin: '0 0 10px', fontSize: 18, fontWeight: 700, fontFamily: 'var(--font)' }}>
          Aktif Abonelik Gerekli
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: '0 0 28px', fontFamily: 'var(--font)' }}>
          Bu özellik aktif abonelik gerektirir. Tüm özelliklere erişmek için aboneliğinizi yenileyin.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px 0', background: 'transparent', border: '1px solid #1e2535', borderRadius: 10, color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            Kapat
          </button>
          <button
            onClick={() => { onClose(); onNav && onNav('subscription'); }}
            style={{ flex: 1, padding: '11px 0', background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 10, color: '#00C9A7', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            Aboneliğe Git
          </button>
        </div>
      </div>
    </div>
  );
}
