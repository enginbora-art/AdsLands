import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';

export function useAgencyBrand() {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.role === 'agency';
  return { isAgency, selectedBrand, needsBrand: isAgency && !selectedBrand };
}

export function NoBrandSelected({ pageName }) {
  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">{pageName}</div></div>
      <div className="content">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Önce bir marka seçin</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Sol menüden <strong>Markalar</strong>'a giderek bir marka seçin.
          </div>
        </div>
      </div>
    </div>
  );
}

export function NoData({ pageName, brandName }) {
  const title = brandName ? `${brandName} — ${pageName}` : pageName;
  return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">{title}</div></div>
      <div className="content">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Henüz veri yok</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Veriler reklam hesabı bağlandıktan sonra burada görünecek.
          </div>
        </div>
      </div>
    </div>
  );
}
