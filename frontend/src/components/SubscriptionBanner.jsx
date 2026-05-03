import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';

const fmt = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : null;

export default function SubscriptionBanner({ onNav }) {
  const { isExpired, isFrozen, expiredAt } = useSubscription();
  const { user } = useAuth();
  const isManagedBrand = user?.is_managed_by_agency;

  if (!isExpired && !isFrozen) return null;

  const dateStr = fmt(expiredAt);

  // Managed brand: button → yönlendirme metni, aksi hâlde normal buton
  const ActionSlot = isManagedBrand
    ? <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
        Abonelik yenileme için ajansınızla iletişime geçin.
      </span>
    : onNav && (
        <button
          onClick={() => onNav('subscription')}
          style={{
            padding: '7px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12,
            cursor: 'pointer', whiteSpace: 'nowrap',
            background: isFrozen ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
            border:     isFrozen ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(245,158,11,0.4)',
            color:      isFrozen ? '#ef4444' : '#f59e0b',
          }}
        >
          Aboneliği Yenile
        </button>
      );

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
            {dateStr
              ? <>Veri erişiminiz tamamen dondurulmuştur. Aboneliğiniz <strong>{dateStr}</strong> tarihinde sona erdi.</>
              : 'Veri erişiminiz tamamen dondurulmuştur. Abonelik aktif değil.'}
          </span>
        </div>
        {ActionSlot}
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
          {dateStr
            ? <>Aboneliğiniz sona erdi — veriler <strong>{dateStr}</strong> itibarıyla dondurulmuştur.</>
            : 'Aboneliğiniz sona erdi — veriler dondurulmuştur.'}
        </span>
      </div>
      {ActionSlot}
    </div>
  );
}
