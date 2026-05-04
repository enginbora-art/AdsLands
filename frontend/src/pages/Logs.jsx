import { useState, useEffect } from 'react';
import { getLogs, getLogsUsers } from '../api';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('tr-TR');
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function describeLog(log) {
  const plat = log.platform ? (PLATFORM_LABELS[log.platform] || log.platform) : '';
  const camp = log.campaign_name ? `"${log.campaign_name}"` : '';
  const mon  = log.month ? `${MONTHS[log.month - 1]} ${log.year}` : '';
  switch (log.action) {
    case 'created':          return `${mon} bütçesi oluşturuldu${log.new_value?.total_budget ? ` (₺${fmt(log.new_value.total_budget)})` : ''}.`;
    case 'updated':          return `${mon} bütçesi güncellendi.`;
    case 'campaign_created': return `${camp} kampanyası oluşturuldu.`;
    case 'campaign_updated': return `${camp} kampanyası güncellendi.`;
    case 'campaign_deleted': return `${camp} kampanyası silindi.`;
    case 'channel_added':    return `${camp ? camp + ' kampanyasına ' : ''}${plat} kanalı eklendi.`;
    case 'channel_updated':  return `${camp ? camp + ' kampanyasında ' : ''}${plat} güncellendi.`;
    case 'channel_removed':  return `${camp ? camp + ' kampanyasından ' : ''}${plat} kanalı kaldırıldı.`;
    default:                 return log.action || '—';
  }
}

const MODULE_CFG = {
  budget:   { label: 'Bütçe',    color: '#00C9A7', bg: 'rgba(0,201,167,0.12)' },
  campaign: { label: 'Kampanya', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  channel:  { label: 'Kanal',    color: '#818CF8', bg: 'rgba(129,140,248,0.12)' },
};

function ModuleBadge({ module }) {
  const cfg = MODULE_CFG[module] || { label: module, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function UserAvatar({ name }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  return (
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#00C9A7', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

const PAGE_SIZE = 20;

const INIT_FILTERS = { user_id: '', module: '', action_type: '', start_date: '', end_date: '' };

export default function Logs() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);

  const [users,   setUsers]   = useState([]);
  const [filters, setFilters] = useState(INIT_FILTERS);
  const [searchInput, setSearchInput] = useState('');

  // null = never searched; object = last committed query params
  const [committedQuery, setCommittedQuery] = useState(null);

  useEffect(() => {
    getLogsUsers().then(setUsers).catch(() => {});
  }, []);

  // Fetch only when committedQuery is set (after first "Ara" click)
  // or when page changes (user already searched)
  useEffect(() => {
    if (!committedQuery) return;
    let cancelled = false;
    setLoading(true);
    getLogs({ ...committedQuery, page, limit: PAGE_SIZE })
      .then(data => { if (!cancelled) { setLogs(data.logs || []); setTotal(data.total || 0); setLoading(false); } })
      .catch(() => { if (!cancelled) { setLogs([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [committedQuery, page]);

  const handleSearch = () => {
    const q = {};
    if (searchInput.trim())  q.search      = searchInput.trim();
    if (filters.user_id)     q.user_id     = filters.user_id;
    if (filters.module)      q.module      = filters.module;
    if (filters.action_type) q.action_type = filters.action_type;
    if (filters.start_date)  q.start_date  = filters.start_date;
    if (filters.end_date)    q.end_date    = filters.end_date;
    setPage(1);
    setCommittedQuery(q);
  };

  const clearFilters = () => {
    setFilters(INIT_FILTERS);
    setSearchInput('');
    // results stay until next "Ara" click
  };

  const hasActiveFilterInput = searchInput || Object.values(filters).some(v => v);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageNums = (() => {
    const range = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) range.push(i);
    return range;
  })();

  const sel = {
    padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 8, color: 'var(--text1)', fontSize: 13, outline: 'none',
    fontFamily: 'var(--font)', cursor: 'pointer',
  };

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">İşlem Kayıtları</div>
      </div>

      <div className="content">
        {/* ── Filters + Search + Ara ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <select style={sel} value={filters.user_id} onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))}>
            <option value="">Tüm Kullanıcılar</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}{u.company_name ? ` (${u.company_name})` : ''}
              </option>
            ))}
          </select>

          <select style={sel} value={filters.module} onChange={e => setFilters(f => ({ ...f, module: e.target.value }))}>
            <option value="">Tüm Modüller</option>
            <option value="budget">Bütçe</option>
            <option value="campaign">Kampanya</option>
            <option value="channel">Kanal</option>
            <option value="integration">Entegrasyon</option>
            <option value="user">Kullanıcı</option>
            <option value="subscription">Abonelik</option>
            <option value="ai_report">AI Rapor</option>
          </select>

          <select style={sel} value={filters.action_type} onChange={e => setFilters(f => ({ ...f, action_type: e.target.value }))}>
            <option value="">Tüm İşlemler</option>
            <option value="created">Oluşturuldu</option>
            <option value="updated">Güncellendi</option>
            <option value="deleted">Silindi</option>
            <option value="added">Eklendi</option>
            <option value="removed">Kaldırıldı</option>
            <option value="login">Giriş Yapıldı</option>
          </select>

          <input type="date" style={sel} value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
          <input type="date" style={sel} value={filters.end_date}   onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />

          {/* Search input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <input
              type="text"
              placeholder="Kullanıcı, marka veya kampanya ara..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ ...sel, cursor: 'text', width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
            />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>

          {/* Primary search button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{ padding: '7px 20px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font)', flexShrink: 0, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : 'Ara'}
          </button>

          {hasActiveFilterInput && (
            <button
              onClick={clearFilters}
              style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}
            >
              Filtreleri Temizle
            </button>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '210px 110px 1fr 155px', padding: '10px 20px', borderBottom: '1px solid var(--border2)', background: 'rgba(255,255,255,0.02)' }}>
            {['Kullanıcı', 'Modül', 'Açıklama', 'Tarih'].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Yükleniyor...
            </div>
          ) : !committedQuery ? (
            <div style={{ padding: '64px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Filtrele ve Arayın</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Filtreleri ayarlayıp "Ara" butonuna basın.</div>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '64px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>📋</div>
              <div style={{ fontSize: 14, color: 'var(--text3)' }}>Filtrelerle eşleşen kayıt bulunamadı.</div>
            </div>
          ) : (
            logs.map((log, i) => (
              <LogRow key={log.id} log={log} alt={i % 2 !== 0} last={i === logs.length - 1} />
            ))
          )}
        </div>

        {/* ── Footer: count + pagination ── */}
        {!loading && committedQuery && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {total} kayıttan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} gösteriliyor
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <PBtn onClick={() => setPage(1)}           disabled={page === 1}>«</PBtn>
                <PBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</PBtn>
                {pageNums.map(n => (
                  <PBtn key={n} onClick={() => setPage(n)} active={n === page}>{n}</PBtn>
                ))}
                <PBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</PBtn>
                <PBtn onClick={() => setPage(totalPages)}  disabled={page === totalPages}>»</PBtn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ log, alt, last }) {
  const [hovered, setHovered] = useState(false);
  const bg = hovered ? 'rgba(0,201,167,0.04)' : alt ? 'rgba(255,255,255,0.012)' : 'transparent';

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '210px 110px 1fr 155px', padding: '13px 20px', borderBottom: last ? 'none' : '1px solid var(--border2)', background: bg, transition: 'background 0.15s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Kullanıcı */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <UserAvatar name={log.user_name} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {log.user_name || '—'}
          </div>
          {log.actor_company_name && log.actor_company_name !== log.brand_name && (
            <div style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.actor_company_name}
            </div>
          )}
        </div>
      </div>

      {/* Modül */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ModuleBadge module={log.module} />
      </div>

      {/* Açıklama */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, paddingRight: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.4 }}>{describeLog(log)}</span>
        {log.brand_name && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{log.brand_name}</span>
        )}
      </div>

      {/* Tarih */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
        {fmtDate(log.created_at)}
      </div>
    </div>
  );
}

function PBtn({ onClick, disabled, active, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 10px', borderRadius: 7, fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(0,201,167,0.15)' : 'var(--bg2)',
        border: `1px solid ${active ? 'rgba(0,201,167,0.4)' : 'var(--border2)'}`,
        color: active ? '#00C9A7' : disabled ? 'var(--text3)' : 'var(--text2)',
        fontFamily: 'var(--font)',
        opacity: disabled && !active ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
