import { useSubscription } from '../context/SubscriptionContext';

const fmt = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

export default function SubscriptionBanner({ onNav }) {
  const { isExpired, isFrozen, expiredAt } = useSubscription();
  if (!isExpired && !isFrozen) return null;

  if (isFrozen) {
    return (
      <div style={{
        marginBottom: 20, padding: '14px 18px', borderRadius: 12,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
            Veri erişiminiz tamamen dondurulmuştur. Aboneliğiniz {fmt(expiredAt)} tarihinde sona erdi.
          </span>
        </div>
        {onNav && (
          <button
            onClick={() => onNav('subscription')}
            style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Aboneliği Yenile
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 20, padding: '14px 18px', borderRadius: 12,
      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>
          Aboneliğiniz sona erdi — veriler <strong>{fmt(expiredAt)}</strong> itibarıyla dondurulmuştur.
        </span>
      </div>
      {onNav && (
        <button
          onClick={() => onNav('subscription')}
          style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Aboneliği Yenile
        </button>
      )}
    </div>
  );
}
