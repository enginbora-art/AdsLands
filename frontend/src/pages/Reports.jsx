import { useAgencyBrand, NoBrandSelected, NoData } from '../components/AgencyGuard';

export default function Reports() {
  const { isAgency, selectedBrand, needsBrand } = useAgencyBrand();
  if (needsBrand) return <NoBrandSelected pageName="Rapor Oluştur" />;
  return <NoData pageName="Rapor Oluştur" brandName={isAgency ? selectedBrand?.company_name : null} />;
}
