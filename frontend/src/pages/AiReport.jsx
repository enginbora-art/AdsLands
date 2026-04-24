import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';

function NoBrandSelected() {
  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">AI Raporlar</div></div>
      <div className="content">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Önce bir müşteri seçin</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Sol menüden <strong>Müşteri Yönetimi</strong>'ne giderek bir marka seçin.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiReport() {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.role === 'agency';

  if (isAgency && !selectedBrand) return <NoBrandSelected />;

  const title = isAgency ? `${selectedBrand?.company_name} — AI Raporlar` : 'AI Raporlar';

  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{title}</div>
      </div>
      <div className="content">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Henüz veri yok</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            AI raporları, reklam hesapları bağlandıktan ve yeterli veri toplandıktan sonra otomatik oluşturulacak.
          </div>
        </div>
      </div>
    </div>
  );
}
