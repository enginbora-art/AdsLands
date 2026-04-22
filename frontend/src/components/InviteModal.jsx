import { useState } from 'react';
import { sendInvitation } from '../api';

export default function InviteModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await sendInvitation(email);
      setStatus({ type: 'success', message: `Davet e-postası ${email} adresine gönderildi.` });
      setEmail('');
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.error || 'Davet gönderilemedi.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Davet Gönder</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Marka veya ajansı platforma davet edin</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSend} style={{ padding: 24 }}>
          <label style={styles.label}>Alıcı E-posta Adresi</label>
          <input
            className="sinput"
            type="email"
            placeholder="ornek@sirket.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ marginBottom: 16 }}
          />

          {status && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              background: status.type === 'success' ? 'rgba(52,211,153,0.12)' : 'var(--coral-dim)',
              color: status.type === 'success' ? 'var(--success)' : 'var(--coral)',
            }}>
              {status.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" style={styles.btnPrimary} disabled={loading}>
              {loading ? 'Gönderiliyor...' : 'Davet Gönder'}
            </button>
            <button type="button" style={styles.btnGhost} onClick={onClose}>İptal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, width: '100%', maxWidth: 460, animation: 'fadeIn 0.2s ease' },
  header: { padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: 4 },
  label: { display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 },
  btnPrimary: { flex: 1, padding: '10px 0', background: 'var(--teal)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { padding: '10px 20px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};
