import { useAgencyBrand, NoBrandSelected, NoData } from '../components/AgencyGuard';

export default function TvPlan() {
  const { isAgency, selectedBrand, needsBrand } = useAgencyBrand();
  if (needsBrand) return <NoBrandSelected pageName="TV Medya Planı" />;
  return <NoData pageName="TV Medya Planı" brandName={isAgency ? selectedBrand?.company_name : null} />;
}
