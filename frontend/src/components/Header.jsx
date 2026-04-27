import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markAllRead, markNotificationRead } from '../api';

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'az önce';
  if (min < 60)  return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr  < 24)  return `${hr} saat önce`;
  return `${Math.floor(hr / 24)} gün önce`;
}

function typeIcon(type = '') {
  if (type.includes('invitation') || type.includes('invite')) return '📨';
  if (type.includes('anomaly'))    return '⚠️';
  if (type.includes('connection')) return '🔗';
  if (type.includes('budget'))     return '💰';
  return '🔔';
}

function avatarLetters(email = '') {
  const local  = email.split('@')[0];
  const parts  = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function companyTypeLabel(type) {
  if (type === 'agency') return 'Ajans';
  if (type === 'brand')  return 'Marka';
  if (type === 'admin')  return 'Admin';
  return type || '';
}

export default function Header({ onNav, onMenuToggle }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const dropRef                           = useRef(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await getNotifications();
      const list  = data.slice(0, 20);
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.is_read).length);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 60000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleBell = () => {
    if (!open) fetchNotifs();
    setOpen(prev => !prev);
  };

  const handleMarkAll = async () => {
    try { await markAllRead(); } catch {}
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleReadOne = async (n) => {
    if (n.is_read) return;
    try { await markNotificationRead(n.id); } catch {}
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const roleLabel = user?.is_platform_admin ? 'Platform Admin'
    : user?.is_company_admin ? 'Şirket Yöneticisi'
    : companyTypeLabel(user?.company_type);

  const displayName  = user?.full_name || user?.email?.split('@')[0] || '—';
  const displaySub   = `${user?.company_name || ''} · ${roleLabel}`;

  return (
    <header className="app-header" style={s.header}>
      {/* Hamburger — visible only on mobile */}
      <button className="menu-toggle" onClick={onMenuToggle} aria-label="Menüyü aç">
        <HamburgerIcon />
      </button>
      {/* Right side — fills full width, aligns to the right */}
      <div style={{ flex: 1 }} />
      <div style={s.right}>

        {/* Bell + Dropdown */}
        <div ref={dropRef} style={{ position: 'relative' }}>
          <button
            onClick={handleBell}
            style={{ ...s.bell, color: open ? '#00BFA6' : 'rgba(255,255,255,0.5)', background: open ? 'rgba(0,191,166,0.08)' : 'none' }}
            aria-label="Bildirimler"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span style={s.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {open && (
            <div className="notif-dropdown" style={s.dropdown}>
              {/* Dropdown header */}
              <div style={s.dropHead}>
                <span style={s.dropTitle}>Bildirimler</span>
                {unreadCount > 0 && (
                  <button style={s.markAllBtn} onClick={handleMarkAll}>
                    Tümünü okundu işaretle
                  </button>
                )}
              </div>

              {/* List */}
              <div style={s.dropList}>
                {notifications.length === 0 ? (
                  <div style={s.empty}>Henüz bildirim yok</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleReadOne(n)}
                      style={{
                        ...s.notifRow,
                        background:  n.is_read ? 'transparent' : 'rgba(0,191,166,0.04)',
                        borderLeft: `2px solid ${n.is_read ? 'transparent' : '#00BFA6'}`,
                        cursor: n.is_read ? 'default' : 'pointer',
                      }}
                    >
                      <div style={s.notifEmoji}>{typeIcon(n.type)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...s.notifTitle, fontWeight: n.is_read ? 500 : 700 }}>
                          {n.title}
                        </div>
                        {n.message && <div style={s.notifMsg}>{n.message}</div>}
                      </div>
                      <div style={s.notifAge}>{relativeTime(n.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={s.divider} />

        {/* User */}
        <div style={s.user}>
          <div style={s.avatar}>{avatarLetters(user?.email)}</div>
          <div>
            <div style={s.userName}>{displayName}</div>
            <div className="header-user-sub" style={s.userSub}>{displaySub}</div>
          </div>
        </div>

      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}

const s = {
  header:     { background: '#0f1117', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', zIndex: 9, boxSizing: 'border-box' },
  right:      { display: 'flex', alignItems: 'center', gap: 12 },
  bell:       { position: 'relative', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.12s, background 0.12s' },
  badge:      { position: 'absolute', top: 3, right: 3, minWidth: 15, height: 15, borderRadius: 8, background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 },
  dropdown:   { position: 'absolute', top: 44, right: 0, background: '#111D29', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden' },
  dropHead:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  dropTitle:  { fontSize: 13, fontWeight: 700 },
  markAllBtn: { fontSize: 11, color: '#00BFA6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0 },
  dropList:   { maxHeight: 380, overflowY: 'auto' },
  empty:      { padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' },
  notifRow:   { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 16px 11px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' },
  notifEmoji: { fontSize: 15, flexShrink: 0, marginTop: 1, width: 20, textAlign: 'center' },
  notifTitle: { fontSize: 13, color: 'var(--text1)', lineHeight: 1.4, marginBottom: 2 },
  notifMsg:   { fontSize: 12, color: 'var(--text3)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  notifAge:   { fontSize: 11, color: 'var(--text3)', flexShrink: 0, marginTop: 2, whiteSpace: 'nowrap', paddingLeft: 6 },
  divider:    { width: 1, height: 24, background: 'rgba(255,255,255,0.07)' },
  user:       { display: 'flex', alignItems: 'center', gap: 10 },
  avatar:     { width: 32, height: 32, borderRadius: 8, background: 'rgba(0,191,166,0.15)', color: '#00BFA6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  userName:   { fontSize: 13, fontWeight: 700, color: '#F0F5F3', lineHeight: 1.3 },
  userSub:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
};
