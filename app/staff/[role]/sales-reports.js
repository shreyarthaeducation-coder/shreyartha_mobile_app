import { useLocalSearchParams } from 'expo-router';
import SalesReportsScreen from '../../../components/staff/sales/SalesReportsScreen';

/** Sales-closure pipeline and the monthly visit report. */
export default function StaffSalesReports() {
  const { role } = useLocalSearchParams();
  return <SalesReportsScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
