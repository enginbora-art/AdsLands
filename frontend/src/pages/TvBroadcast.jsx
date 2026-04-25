import { useAgencyBrand, NoBrandSelected, NoData } from '../components/AgencyGuard';

export default function TvBroadcast() {
  const { isAgency, selectedBrand, needsBrand } = useAgencyBrand();
  if (needsBrand) return <NoBrandSelected pageName="TV Ad Verification" />;
  return <NoData pageName="TV Ad Verification" brandName={isAgency ? selectedBrand?.company_name : null} />;
}
