export default function PaymentResult({ onNav }) {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const reason = params.get('reason');
  const success = status === 'success';

  return (
    <div style={{
      minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#161b27', border: `1px solid ${success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
        borderRadius: 20, padding: '52px 48px', textAlign: 'center', maxWidth: 440, width: '100%',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {success ? '🎉' : '❌'}
        </div>
        <h1 style={{ fontFamily: 'var(--font)', fontSize: 24, color: '#f1f5f9', margin: '0 0 10px' }}>
          {success ? 'Ödeme Başarılı!' : 'Ödeme Başarısız'}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 36px', lineHeight: 1.6 }}>
          {success
            ? 'Aboneliğiniz aktive edildi. Tüm özellikler artık kullanımınıza açık.'
            : reason === 'hash'
              ? 'Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.'
              : 'Ödeme işlemi tamamlanamadı. Kart bilgilerinizi kontrol ederek tekrar deneyebilirsiniz.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {success ? (
            <button
              onClick={() => { window.history.pushState({}, '', '/subscription'); if (onNav) onNav('subscription'); }}
              style={btnStyle('#0d9488')}
            >
              Aboneliğimi Görüntüle
            </button>
          ) : (
            <button
              onClick={() => { window.history.pushState({}, '', '/pricing'); if (onNav) onNav('pricing'); }}
              style={btnStyle('#ef4444')}
            >
              Tekrar Dene
            </button>
          )}
          <button
            onClick={() => { window.history.pushState({}, '', '/dashboard'); if (onNav) onNav('dashboard'); }}
            style={{ ...btnStyle('transparent'), border: '1px solid #1e2535', color: '#94a3b8' }}
          >
            Dashboard'a Dön
          </button>
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg) {
  return {
    padding: '13px 24px', borderRadius: 10, border: 'none',
    background: bg, color: '#fff', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', width: '100%',
  };
}
