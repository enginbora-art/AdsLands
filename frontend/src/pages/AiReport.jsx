import { useAgencyBrand, NoBrandSelected, NoData } from '../components/AgencyGuard';

export default function AiReport() {
  const { isAgency, selectedBrand, needsBrand } = useAgencyBrand();
  if (needsBrand) return <NoBrandSelected pageName="AI Raporları" />;
  return <NoData pageName="AI Raporları" brandName={isAgency ? selectedBrand?.company_name : null} />;
}
