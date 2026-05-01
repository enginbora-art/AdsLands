import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { initiatePayment } from '../api';

const PLANS_AGENCY = [
  {
    key: 'starter',
    label: 'Basic',
    desc: '0-5 marka',
    monthly: 20000,
    yearly: 16000,
    color: '#0d9488',
    features: [
      'Tüm entegrasyonlar',
      'Bütçe planlama',
      'Kanal analizi',
      'AI raporları',
    ],
  },
  {
    key: 'growth',
    label: 'Pro',
    desc: '5-10 marka',
    monthly: 45000,
    yearly: 36000,
    color: '#3b82f6',
    popular: true,
    features: [
      'Tüm entegrasyonlar',
      'Bütçe planlama',
      'Kanal analizi',
      'AI raporları',
      'Anomali uyarıları',
      'Benchmark',
    ],
  },
  {
    key: 'scale',
    label: 'Enterprise',
    desc: '10+ marka',
    monthly: 70000,
    yearly: 56000,
    color: '#8b5cf6',
    features: [
      'Tüm entegrasyonlar',
      'Bütçe planlama',
      'Kanal analizi',
      'AI raporları',
      'Anomali uyarıları',
      'Benchmark',
      'TV Medya Planı ve İzleme',
    ],
  },
];

const PLANS_BRAND = [
  {
    key: 'brand_direct',
    label: 'Marka Direkt',
    desc: 'Kendi reklamınızı yönetin',
    monthly: 1500,
    yearly: 1200,
    color: '#7c3aed',
    features: ['Tüm entegrasyonlar', 'AI Raporlar', 'TV Medya Planı', 'Ajans bağlantısı', 'Email destek'],
  },
];

function PaymentModal({ plan, interval, onClose, onSuccess }) {
  const [form, setForm] = useState({ cc_holder_name: '', cc_no: '', expiry_month: '', expiry_year: '', cvv: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const formRef = useState(null);

  const amount = interval === 'yearly' ? plan.yearly : plan.monthly;

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { html } = await initiatePayment({
        plan: plan.key,
        interval,
        cc_holder_name: form.cc_holder_name,
        cc_no:          form.cc_no.replace(/\s/g, ''),
        expiry_month:   form.expiry_month,
        expiry_year:    form.expiry_year,
        cvv:            form.cvv,
      });
      // Sipay HTML formunu inject et ve auto-submit
      const div = document.createElement('div');
      div.innerHTML = html;
      div.style.display = 'none';
      document.body.appendChild(div);
      const form3d = div.querySelector('form');
      if (form3d) form3d.submit();
    } catch (err) {
      setError(err.response?.data?.error || 'Ödeme başlatılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  return (
    <div style={ms.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={ms.modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#f1f5f9' }}>{plan.label}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
              ₺{amount} / {interval === 'yearly' ? 'ay (yıllık)' : 'ay'} · TRY
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={ms.label}>Kart Üzerindeki İsim</label>
          <input className="sinput" style={{ marginBottom: 14 }} required
            placeholder="Ad Soyad"
            value={form.cc_holder_name} onChange={set('cc_holder_name')} />

          <label style={ms.label}>Kart Numarası</label>
          <input className="sinput" style={{ marginBottom: 14, fontFamily: 'monospace', letterSpacing: '0.1em' }} required
            placeholder="0000 0000 0000 0000"
            value={fmtCard(form.cc_no)}
            onChange={e => setForm(p => ({ ...p, cc_no: e.target.value.replace(/\D/g, '').slice(0, 16) }))} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={ms.label}>Ay</label>
              <input className="sinput" required maxLength={2}
                placeholder="MM" value={form.expiry_month} onChange={set('expiry_month')} />
            </div>
            <div>
              <label style={ms.label}>Yıl</label>
              <input className="sinput" required maxLength={2}
                placeholder="YY" value={form.expiry_year} onChange={set('expiry_year')} />
            </div>
            <div>
              <label style={ms.label}>CVV</label>
              <input className="sinput" required maxLength={4}
                placeholder="000" type="password" value={form.cvv} onChange={set('cvv')} />
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
            🔒 Ödeme bilgileriniz SSL ile korunmakta. Kartınız Sipay altyapısında güvenle işlenmektedir.
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px 0', borderRadius: 10,
            background: loading ? '#334155' : plan.color, color: '#fff',
            fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background .2s',
          }}>
            {loading ? '3D Ödemeye Yönlendiriliyor...' : `₺${amount} Öde & Başlat`}
          </button>
        </form>
      </div>
    </div>
  );
}

const ms = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal:   { background: '#1a1f2e', border: '1px solid #1e2535', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 440 },
  label:   { display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
};

export default function Pricing({ onNav }) {
  const { user } = useAuth();
  const [interval, setInterval] = useState('monthly');
  const [selectedPlan, setSelectedPlan] = useState(null);

  const companyType = user?.company_type;
  const plans = companyType === 'brand' ? PLANS_BRAND : PLANS_AGENCY;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 60px' }}>
      {selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          interval={interval}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => { setSelectedPlan(null); if (onNav) onNav('subscription'); }}
        />
      )}

      {/* Başlık */}
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <p style={{ fontFamily: 'var(--font)', fontSize: 30, fontWeight: 700, color: '#f1f5f9', margin: '0 0 28px' }}>
          {companyType === 'brand' ? 'Markanızın büyümesini hızlandırın.' : 'Ajansınız için en doğru planı seçin.'}
        </p>

        {/* Monthly / Yearly toggle */}
        <div style={{ display: 'inline-flex', background: '#161b27', border: '1px solid #1e2535', borderRadius: 10, padding: 4, gap: 2 }}>
          {['monthly', 'yearly'].map(v => (
            <button key={v} onClick={() => setInterval(v)} style={{
              padding: '8px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: interval === v ? '#0d9488' : 'transparent',
              color: interval === v ? '#fff' : '#94a3b8',
              transition: 'all .2s',
            }}>
              {v === 'monthly' ? 'Aylık' : 'Yıllık'}
              {v === 'yearly' && (
                <span style={{ marginLeft: 6, fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 5 }}>
                  %20 İndirim
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan kartları */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${plans.length}, 1fr)`,
        gap: 20,
        maxWidth: plans.length === 1 ? 400 : 'none',
        margin: '0 auto',
      }}>
        {plans.map(plan => {
          const price = interval === 'yearly' ? plan.yearly : plan.monthly;
          return (
            <div key={plan.key} style={{
              background: '#161b27',
              border: `2px solid ${plan.popular ? plan.color : '#1e2535'}`,
              borderRadius: 16, padding: '28px 24px',
              position: 'relative',
              display: 'flex', flexDirection: 'column',
              transition: 'transform .2s, box-shadow .2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${plan.color}22`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {plan.popular && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  EN POPÜLER
                </div>
              )}

              <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{plan.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>{plan.desc}</div>

              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: plan.color }}>₺{price.toLocaleString('tr-TR')}</span>
                <span style={{ fontSize: 13, color: '#64748b' }}>/{interval === 'yearly' ? 'ay*' : 'ay'}</span>
                {interval === 'yearly' && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>*Yıllık ₺{(price * 12).toLocaleString('tr-TR')} olarak faturalandırılır</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28, flex: 1 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
                    <span style={{ color: plan.color, fontSize: 15, flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setSelectedPlan(plan)}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  background: plan.popular ? plan.color : 'transparent',
                  border: `2px solid ${plan.color}`,
                  color: plan.popular ? '#fff' : plan.color,
                  fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all .2s',
                  marginTop: 'auto',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = plan.color; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = plan.popular ? plan.color : 'transparent'; e.currentTarget.style.color = plan.popular ? '#fff' : plan.color; }}
              >
                Bu Planı Seç
              </button>
            </div>
          );
        })}
      </div>

      {/* Güvenlik notu */}
      <div style={{ textAlign: 'center', marginTop: 36, color: '#475569', fontSize: 12 }}>
        🔒 256-bit SSL şifrelemesi · Sipay güvencesiyle güvenli ödeme · İstediğiniz zaman iptal edin
      </div>
    </div>
  );
}
