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
    const status    = user.subscription_status;
    const now       = new Date();

    if (!periodEnd) {
      // Hiç abonelik olmamış — plan gating Sidebar'da ele alınır, expiry flow değil
      return { accessState: 'none', isActive: false, isExpired: false, isFrozen: false, expiredAt: null, frozenAt: null };
    }

    const effectivelyActive =
      (status === 'active'    && periodEnd > now) ||
      (status === 'trialing'  && periodEnd > now) ||
      (status === 'cancelled' && user.subscription_cancelling && periodEnd > now);

    if (effectivelyActive) {
      return { accessState: 'active', isActive: true, isExpired: false, isFrozen: false, expiredAt: periodEnd, frozenAt: null };
    }

    // Süresi dolmuş
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
