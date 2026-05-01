import { useState, useEffect } from 'react';
import { adminGetCompanies, adminCreateCompany, adminUpdateCompany, adminToggleUser, adminGetAiUsage } from '../api';

const fmt = (d) => new Date(d).toLocaleDateString('tr-TR');

const SECTORS = [
  'E-ticaret', 'Perakende', 'Finans & Sigorta', 'Otomotiv',
  'Gıda & İçecek', 'Turizm & Seyahat', 'Teknoloji & SaaS',
  'Sağlık & Güzellik', 'Eğitim', 'Gayrimenkul', 'Medya & Eğlence', 'Diğer',
];

const PLAN_LABELS = {
  starter: 'Starter',
  growth: 'Growth',
  scale: 'Scale',
  brand_direct: 'Direkt',
};

const inp = {
  padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border2)',
  borderRadius: 8, color: 'var(--text1)', fontSize: 14, width: '100%', boxSizing: 'border-box',
};
const fieldLabel = {
  display: 'block', fontSize: 11, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600,
};

function PlanBadge({ status, plan, cancelAtPeriodEnd }) {
  if (status === 'active') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ background: 'rgba(0,191,166,0.12)', color: 'var(--teal)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
          Pro {plan ? `· ${PLAN_LABELS[plan] || plan}` : ''}
        </span>
      </span>
    );
  }
  if (status === 'cancelling') {
    return (
      <span style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
        İptal Süreci
      </span>
    );
  }
  if (status === 'trial') {
    return (
      <span style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
        Deneme
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span style={{ background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
        İptal
      </span>
    );
  }
  return (
    <span style={{ background: 'rgba(148,163,179,0.1)', color: 'var(--text3)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
      Pasif
    </span>
  );
}

function ActivityCell({ months }) {
  const n = parseInt(months) || 0;
  if (n === 0) return <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>;
  return <span style={{ color: 'var(--text2)', fontSize: 12 }}>{n} ay</span>;
}

function CreateModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', type: 'brand', sector: '', admin_email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sector) { setError('Sektör seçimi zorunludur.'); return; }
    setLoading(true);
    setError('');
    try {
      await adminCreateCompany(form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Yeni Şirket Oluştur</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Şirket Adı</label>
            <input style={inp} placeholder="Şirket / Marka adı"
              value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Şirket Tipi</label>
            <select style={inp} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="brand">Marka</option>
              <option value="agency">Ajans</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Sektör <span style={{ color: 'var(--coral)' }}>*</span></label>
            <select style={inp} value={form.sector} onChange={e => set('sector', e.target.value)}>
              <option value="">— Seçiniz —</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={fieldLabel}>Admin E-posta</label>
            <input style={inp} type="email" placeholder="admin@sirket.com"
              value={form.admin_email} onChange={e => set('admin_email', e.target.value)} required />
          </div>
          {error && (
            <div style={{ background: 'rgba(255,107,90,0.1)', color: 'var(--coral)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '10px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Oluşturuluyor...' : 'Oluştur & Mail Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectorCell({ company, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [sector, setSector] = useState(company.sector || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdateCompany(company.id, { sector });
      await onUpdate();
      setEditing(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <select value={sector} onChange={e => setSector(e.target.value)}
          style={{ ...inp, padding: '4px 8px', fontSize: 12, width: 'auto' }}>
          <option value="">—</option>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={save} disabled={saving}
          style={{ padding: '3px 8px', background: 'var(--teal)', border: 'none', borderRadius: 5, color: '#0B1219', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          ✓
        </button>
        <button onClick={() => { setEditing(false); setSector(company.sector || ''); }}
          style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
          ✕
        </button>
      </span>
    );
  }

  return (
    <span onClick={() => setEditing(true)}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: sector ? 'var(--text2)' : 'var(--text3)', fontSize: 12 }}>
      {sector || '— ekle'}
      <span style={{ opacity: 0.5, fontSize: 11 }}>✎</span>
    </span>
  );
}

function CompanyRow({ c, indent = false, onUpdate }) {
  return (
    <tr key={c.id}>
      <td style={{ fontWeight: indent ? 500 : 600, paddingLeft: indent ? 32 : 16 }}>
        {indent && <span style={{ color: 'var(--text3)', marginRight: 6, fontSize: 11 }}>↳</span>}
        {c.name}
      </td>
      <td>
        <span style={{ background: c.type === 'agency' ? 'rgba(167,139,250,0.15)' : 'rgba(0,191,166,0.12)', color: c.type === 'agency' ? '#A78BFA' : 'var(--teal)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
          {c.type === 'agency' ? 'Ajans' : 'Marka'}
        </span>
      </td>
      <td><SectorCell company={c} onUpdate={onUpdate} /></td>
      <td style={{ fontSize: 12, color: c.admin_email ? 'var(--text2)' : 'var(--text3)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.admin_email || 'Admin yok'}
      </td>
      <td>
        {indent
          ? <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
          : <PlanBadge status={c.plan_status} plan={c.plan} cancelAtPeriodEnd={c.cancel_at_period_end} />
        }
      </td>
      <td><ActivityCell months={c.months_active} /></td>
      <td style={{ color: 'var(--text2)', fontSize: 12 }}>{c.user_count}</td>
      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(c.created_at)}</td>
    </tr>
  );
}

function AgencyGroup({ agency, onUpdate }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasBrands = agency.brands?.length > 0;

  return (
    <>
      <tr style={{ background: 'rgba(167,139,250,0.04)' }}>
        <td style={{ fontWeight: 700, paddingLeft: 16 }}>
          {hasBrands && (
            <button onClick={() => setCollapsed(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', marginRight: 6, fontSize: 12, padding: 0 }}>
              {collapsed ? '▶' : '▼'}
            </button>
          )}
          {agency.name}
          {hasBrands && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
              {agency.brands.length} marka
            </span>
          )}
        </td>
        <td>
          <span style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
            Ajans
          </span>
        </td>
        <td><SectorCell company={agency} onUpdate={onUpdate} /></td>
        <td style={{ fontSize: 12, color: agency.admin_email ? 'var(--text2)' : 'var(--text3)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agency.admin_email || 'Admin yok'}
        </td>
        <td><PlanBadge status={agency.plan_status} plan={agency.plan} cancelAtPeriodEnd={agency.cancel_at_period_end} /></td>
        <td><ActivityCell months={agency.months_active} /></td>
        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{agency.user_count}</td>
        <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(agency.created_at)}</td>
      </tr>
      {!collapsed && hasBrands && agency.brands.map(brand => (
        <CompanyRow key={brand.id} c={brand} indent onUpdate={onUpdate} />
      ))}
    </>
  );
}

const FEATURE_LABELS = {
  channel_analysis: 'Kanal Analizi',
  ai_report:        'AI Rapor',
  kpi_analysis:     'KPI Analizi',
};

function AiUsageTab() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminGetAiUsage(month)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month]);

  const fmtTry = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtUsd = (v) => `$${Number(v || 0).toFixed(4)}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: 'var(--text3)' }}>Ay:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text1)', fontSize: 13 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Veri alınamadı.</div>
      ) : (
        <>
          {/* Özet kartlar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Toplam Maliyet (TL)', value: fmtTry(data.total_cost_try), color: '#00BFA6' },
              { label: 'Toplam Maliyet (USD)', value: fmtUsd(data.total_cost_usd), color: '#60A5FA' },
              { label: 'Toplam İstek', value: (data.total_requests || 0).toLocaleString('tr-TR'), color: '#A78BFA' },
              { label: 'Toplam Input Token', value: (data.total_input_tokens || 0).toLocaleString('tr-TR'), color: 'var(--text2)' },
              { label: 'Toplam Output Token', value: (data.total_output_tokens || 0).toLocaleString('tr-TR'), color: 'var(--text2)' },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Özellik bazında */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Özellik Bazında</div>
            {data.by_feature?.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Bu ay AI kullanımı yok.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Özellik', 'İstek', 'Maliyet (TL)', 'Maliyet (USD)', 'Input Token', 'Output Token'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.by_feature || []).map(row => (
                    <tr key={row.feature} style={{ borderTop: '1px solid var(--border2)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)' }}>{FEATURE_LABELS[row.feature] || row.feature}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{row.requests}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#00BFA6', fontWeight: 600 }}>{fmtTry(row.cost_try)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#60A5FA' }}>{fmtUsd(row.cost_usd)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>{Number(row.input_tokens).toLocaleString('tr-TR')}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>{Number(row.output_tokens).toLocaleString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Şirket bazında */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Şirket Bazında</div>
            {data.by_company?.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Bu ay AI kullanımı yok.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Şirket', 'Tip', 'İstek', 'Maliyet (TL)', 'Maliyet (USD)'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.by_company || []).map(row => (
                    <tr key={row.id} style={{ borderTop: '1px solid var(--border2)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text1)' }}>{row.company_name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: row.company_type === 'agency' ? 'rgba(167,139,250,0.15)' : 'rgba(96,165,250,0.15)',
                          color: row.company_type === 'agency' ? '#A78BFA' : '#60A5FA' }}>
                          {row.company_type === 'agency' ? 'Ajans' : 'Marka'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text2)' }}>{row.requests}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#00BFA6', fontWeight: 600 }}>{fmtTry(row.cost_try)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#60A5FA' }}>{fmtUsd(row.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminPanel({ onLogout }) {
  const [data, setData] = useState({ agencies: [], independent_brands: [] });
  const [tab, setTab] = useState('companies');
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    return adminGetCompanies()
      .then(d => setData(d && d.agencies ? d : { agencies: [], independent_brands: [] }))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const allCompanies = [
    ...data.agencies,
    ...data.agencies.flatMap(a => a.brands || []),
    ...data.independent_brands,
  ];

  const totalAgencies = data.agencies.length;
  const totalBrands = data.agencies.reduce((s, a) => s + (a.brands?.length || 0), 0) + data.independent_brands.length;
  const totalAll = totalAgencies + totalBrands;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text1)' }}>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            setSuccessMsg('Şirket oluşturuldu ve setup maili gönderildi.');
            setTimeout(() => setSuccessMsg(''), 5000);
            load();
          }}
        />
      )}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <svg width="28" height="28" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="11" fill="none" stroke="#00BFA6" strokeWidth="2.5"/>
                <circle cx="16" cy="16" r="3" fill="#00BFA6"/>
              </svg>
              <span style={{ fontSize: 20, fontWeight: 700 }}>Ads<span style={{ color: '#00BFA6' }}>Lands</span></span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Yönetimi</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '8px 18px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Şirket Ekle
            </button>
            <button onClick={onLogout}
              style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
              Çıkış
            </button>
          </div>
        </div>

        {successMsg && (
          <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 20 }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Ana sekmeler */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border2)', paddingBottom: 0 }}>
          {[
            { key: 'companies', label: 'Şirketler' },
            { key: 'ai',        label: 'AI Kullanımı' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '8px 18px', borderRadius: '6px 6px 0 0', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === key ? 'var(--bg2)' : 'transparent',
                color: tab === key ? 'var(--text1)' : 'var(--text3)',
                borderBottom: tab === key ? '2px solid var(--teal)' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'ai' ? (
          <AiUsageTab />
        ) : (
          <>
        {/* Şirket filtre sekmeleri */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'all',    label: 'Tümü',  count: totalAll },
            { key: 'agency', label: 'Ajans', count: totalAgencies },
            { key: 'brand',  label: 'Marka', count: totalBrands },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === key ? 'var(--teal)' : 'var(--bg2)', color: filter === key ? '#0B1219' : 'var(--text3)' }}>
              {label} ({count})
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
        ) : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflowX: 'auto' }}>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Şirket</th>
                  <th style={{ minWidth: 90 }}>Tip</th>
                  <th style={{ minWidth: 100 }}>Sektör</th>
                  <th style={{ minWidth: 200, maxWidth: 220 }}>Admin E-posta</th>
                  <th style={{ minWidth: 80 }}>Plan</th>
                  <th style={{ minWidth: 80 }}>Aktiflik</th>
                  <th style={{ minWidth: 80 }}>Kullanıcı</th>
                  <th style={{ minWidth: 110 }}>Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {filter === 'all' && data.agencies.length === 0 && data.independent_brands.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Şirket bulunamadı.</td></tr>
                )}

                {/* Ajans + bağlı markalar */}
                {filter !== 'brand' && data.agencies.map(agency => (
                  <AgencyGroup key={agency.id} agency={agency} onUpdate={load} />
                ))}

                {/* Bağımsız markalar (all view) */}
                {filter === 'all' && data.independent_brands.length > 0 && (
                  <>
                    {data.agencies.length > 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', background: 'var(--bg)', borderTop: '1px solid var(--border2)' }}>
                          Bağımsız Markalar
                        </td>
                      </tr>
                    )}
                    {data.independent_brands.map(brand => (
                      <CompanyRow key={brand.id} c={brand} onUpdate={load} />
                    ))}
                  </>
                )}

                {/* Ajans filtresi — boş durum */}
                {filter === 'agency' && data.agencies.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Ajans bulunamadı.</td></tr>
                )}

                {/* Marka filtresi: tüm markalar (bağlı + bağımsız) */}
                {filter === 'brand' && (() => {
                  const allBrands = [
                    ...data.agencies.flatMap(a => a.brands || []),
                    ...data.independent_brands,
                  ];
                  if (allBrands.length === 0) {
                    return <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Marka bulunamadı.</td></tr>;
                  }
                  return allBrands.map(brand => (
                    <CompanyRow key={brand.id} c={brand} onUpdate={load} />
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
