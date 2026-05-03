import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();

  const value = useMemo(() => {
    if (!user) {
      return { accessState: 'loading', isActive: true, isExpired: false, isFrozen: false, expiredAt: null, frozenAt: null };
    }

    if (user.is_platform_admin) {
      return { accessState: 'active', isActive: true, isExpired: false, isFrozen: false, expiredAt: null, frozenAt: null };
    }

    if (user.on_trial) {
      return { accessState: 'active', isActive: true, isExpired: false, isFrozen: false, expiredAt: null, frozenAt: null };
    }

    const periodEnd = user.subscription_period_end ? new Date(user.subscription_period_end) : null;
    const status    = user.subscription_status; // en güncel kayıt — 'active','trialing','cancelled','past_due','passive','inactive' veya null
    const now       = new Date();

    if (!periodEnd) {
      // Subscription kaydı hiç yok:
      // - Ajans yönetimindeki marka → ajansın aboneliği yok = expired
      // - Ajans kullanıcısının kendisi → kendi aboneliği yok = expired
      // - Doğrudan marka (ajansa bağlı değil) → plan upgrade akışı (Sidebar gating)
      if (user.is_managed_by_agency || user.company_type === 'agency') {
        return { accessState: 'expired', isActive: false, isExpired: true, isFrozen: false, expiredAt: null, frozenAt: null };
      }
      return { accessState: 'none', isActive: false, isExpired: false, isFrozen: false, expiredAt: null, frozenAt: null };
    }

    // Yalnızca 'active' veya 'trialing' + geçerli dönem → aktif
    // 'cancelled' + pending cancel + geçerli dönem → hâlâ aktif (dönem sonuna kadar)
    // Diğer her şey ('past_due','passive','inactive', bilinmeyen) → pasif/süresi dolmuş
    const effectivelyActive =
      (status === 'active'    && periodEnd > now) ||
      (status === 'trialing'  && periodEnd > now) ||
      (status === 'cancelled' && user.subscription_cancelling && periodEnd > now);

    if (effectivelyActive) {
      return { accessState: 'active', isActive: true, isExpired: false, isFrozen: false, expiredAt: periodEnd, frozenAt: null };
    }

    // Süresi dolmuş; 30 gün sonra tamamen dondur
    const frozenAt = new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (now > frozenAt) {
      return { accessState: 'frozen', isActive: false, isExpired: true, isFrozen: true, expiredAt: periodEnd, frozenAt };
    }
    return { accessState: 'expired', isActive: false, isExpired: true, isFrozen: false, expiredAt: periodEnd, frozenAt };
  }, [user]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
