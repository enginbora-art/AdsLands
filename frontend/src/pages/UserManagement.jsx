import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getCompanyUsers, inviteCompanyUser, toggleCompanyUser, assignUserRole,
  getCompanyRoles, createRole, updateRole, deleteRole, getPermissions,
} from '../api';

const PERM_LABELS = {
  dashboard: 'Dashboard', kanal_analizi: 'Kanal Analizi', ai_raporlar: 'AI Raporları',
  butce_planlama: 'Bütçe Planlama', tv_ad_verification: 'TV Ad Verification',
  tv_medya_plani: 'TV Medya Planı', anomaliler: 'Anomaliler', benchmark: 'Benchmark',
  raporlar: 'Raporlar', entegrasyonlar: 'Entegrasyonlar',
  kullanici_yonetimi: 'Kullanıcı Yönetimi', ayarlar: 'Ayarlar',
};

function RoleModal({ role, permissions, onClose, onSave }) {
  const [name, setName] = useState(role?.name || '');
  const [perms, setPerms] = useState(role?.permissions || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (p) => setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleSave = async () => {
    if (!name.trim()) return setError('Rol adı zorunludur.');
    setLoading(true);
    setError('');
    try {
      await onSave({ name, permissions: perms });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{role ? 'Rol Düzenle' : 'Yeni Rol'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Rol Adı</label>
          <input className="sinput" value={name} onChange={e => setName(e.target.value)} placeholder="Örn: Analist" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Yetkiler</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {permissions.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                <input type="checkbox" checked={perms.includes(p)} onChange={() => toggle(p)} style={{ accentColor: '#00BFA6', width: 14, height: 14 }} />
                {PERM_LABELS[p] || p}
              </label>
            ))}
          </div>
        </div>
        {error && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>İptal</button>
          <button onClick={handleSave} disabled={loading}
            style={{ flex: 1, padding: '9px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

const PRESET_ROLES = [
  { name: 'Yönetici',      permissions: Object.keys(PERM_LABELS) },
  { name: 'Medya Uzmanı',  permissions: ['dashboard', 'kanal_analizi', 'entegrasyonlar', 'butce_planlama', 'anomaliler', 'benchmark'] },
  { name: 'Raporlama',     permissions: ['dashboard', 'ai_raporlar', 'raporlar', 'benchmark', 'anomaliler'] },
  { name: 'Salt Okunur',   permissions: ['dashboard'] },
];

function InviteModal({ roles, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await inviteCompanyUser({ email, role_id: roleId || undefined });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const lbl = { display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 14, padding: 32, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Kullanıcı Davet Et</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>E-posta</label>
            <input className="sinput" type="email" placeholder="kullanici@sirket.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Rol</label>
            <select
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>
              <option value="">— Rol seçin (opsiyonel)</option>
              {roles.length > 0
                ? roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                : PRESET_ROLES.map(r => <option key={r.name} value={`preset:${r.name}`}>{r.name}</option>)
              }
            </select>
            {roles.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                Henüz özel rol yok. Varsayılan roller gösteriliyor — Roller sekmesinden oluşturabilirsiniz.
              </div>
            )}
          </div>

          {error && <div style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '9px 0', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '9px 0', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Gönderiliyor...' : 'Davet Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editRole, setEditRole] = useState(null); // null=kapalı, false=yeni, object=düzenleme
  const [successMsg, setSuccessMsg] = useState('');

  const isAdmin = user?.is_company_admin || user?.is_platform_admin;

  const load = async () => {
    setLoading(true);
    try {
      const [u, r, p] = await Promise.all([getCompanyUsers(), getCompanyRoles(), getPermissions()]);
      setUsers(u); setRoles(r); setPermissions(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };

  const handleToggle = async (id) => {
    try { await toggleCompanyUser(id); load(); } catch (err) { alert(err.response?.data?.error || 'Hata.'); }
  };

  const handleRoleAssign = async (userId, roleId) => {
    try { await assignUserRole(userId, roleId || null); load(); } catch (err) { alert(err.response?.data?.error || 'Hata.'); }
  };

  const handleDeleteRole = async (id) => {
    if (!confirm('Bu rolü silmek istediğinize emin misiniz?')) return;
    try { await deleteRole(id); load(); showSuccess('Rol silindi.'); } catch (err) { alert(err.response?.data?.error || 'Hata.'); }
  };

  const handleCreatePresets = async () => {
    try {
      for (const r of PRESET_ROLES) {
        await createRole({ name: r.name, permissions: r.permissions });
      }
      load();
      showSuccess('Varsayılan roller oluşturuldu.');
    } catch (err) {
      alert(err.response?.data?.error || 'Hata.');
    }
  };

  const handleSaveRole = async (data) => {
    if (editRole && editRole.id) {
      await updateRole(editRole.id, data);
      showSuccess('Rol güncellendi.');
    } else {
      await createRole(data);
      showSuccess('Rol oluşturuldu.');
    }
    load();
  };

  return (
    <div className="fade-in">
      {showInvite && (
        <InviteModal
          roles={roles}
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); showSuccess('Davet gönderildi.'); load(); }}
        />
      )}
      {editRole !== null && (
        <RoleModal
          role={editRole || null}
          permissions={permissions}
          onClose={() => setEditRole(null)}
          onSave={handleSaveRole}
        />
      )}

      <div className="topbar">
        <div className="topbar-title">Kullanıcı Yönetimi</div>
        {isAdmin && (
          <div className="topbar-right">
            {tab === 'users' && (
              <button onClick={() => setShowInvite(true)}
                style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219' }}>
                + Kullanıcı Davet Et
              </button>
            )}
            {tab === 'roles' && (
              <button onClick={() => setEditRole(false)}
                style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#0B1219' }}>
                + Yeni Rol
              </button>
            )}
          </div>
        )}
      </div>

      <div className="content">
        {successMsg && (
          <div style={{ background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 16 }}>
            ✓ {successMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border2)', paddingBottom: 0 }}>
          {['users', 'roles'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 18px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--teal)' : '2px solid transparent', color: tab === t ? 'var(--teal)' : 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>
              {t === 'users' ? 'Kullanıcılar' : 'Roller'}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Yükleniyor...</div>
        ) : tab === 'users' ? (
          <div className="card table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>Yetkiler</th>
                  <th>Durum</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.email}</div>
                      {u.is_company_admin && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Şirket Yöneticisi</div>}
                    </td>
                    <td>
                      {u.is_company_admin ? (
                        <span style={{ fontSize: 11, background: 'rgba(167,139,250,0.15)', color: '#A78BFA', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>Admin</span>
                      ) : isAdmin ? (
                        <select
                          value={u.role_id || ''}
                          onChange={e => handleRoleAssign(u.id, e.target.value || null)}
                          style={{ background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>
                          <option value="">— Rol yok</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{u.role_name || '—'}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 200 }}>
                      {u.is_company_admin ? 'Tüm yetkiler' : (u.permissions?.length ? u.permissions.map(p => PERM_LABELS[p] || p).join(', ') : '—')}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: u.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(255,107,90,0.12)', color: u.is_active ? 'var(--success)' : 'var(--coral)' }}>
                        {u.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        {!u.is_company_admin && (
                          <button onClick={() => handleToggle(u.id)}
                            style={{ fontSize: 11, padding: '3px 10px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text3)', cursor: 'pointer' }}>
                            {u.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            {roles.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Henüz rol oluşturulmadı.</div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={handleCreatePresets}
                      style={{ padding: '8px 18px', background: 'rgba(0,191,166,0.12)', border: '1px solid rgba(0,191,166,0.3)', borderRadius: 8, color: 'var(--teal)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Varsayılan Rolleri Oluştur
                    </button>
                    <button onClick={() => setEditRole(false)}
                      style={{ padding: '8px 18px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      + Yeni Rol Oluştur
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {roles.map(r => (
                  <div key={r.id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{r.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {r.permissions?.length ? r.permissions.map(p => PERM_LABELS[p] || p).join(' · ') : 'Yetki yok'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{r.user_count} kullanıcı</div>
                      </div>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditRole(r)}
                            style={{ fontSize: 12, padding: '4px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>
                            Düzenle
                          </button>
                          <button onClick={() => handleDeleteRole(r.id)}
                            style={{ fontSize: 12, padding: '4px 12px', background: 'transparent', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 6, color: 'var(--coral)', cursor: 'pointer' }}>
                            Sil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
