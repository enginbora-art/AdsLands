import { useAgencyBrand, NoBrandSelected, NoData } from '../components/AgencyGuard';

export default function Benchmark() {
  const { isAgency, selectedBrand, needsBrand } = useAgencyBrand();
  if (needsBrand) return <NoBrandSelected pageName="Benchmark" />;
  return <NoData pageName="Benchmark" brandName={isAgency ? selectedBrand?.company_name : null} />;
}
