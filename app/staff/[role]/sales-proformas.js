import { useLocalSearchParams } from 'expo-router';
import { SalesProformasScreen } from '../../../components/staff/sales/SalesProformaScreens';

/** Sales only — `/api/staff/sales/**` serves the rep's own schools and documents. */
export default function StaffSalesProformas() {
  const { role } = useLocalSearchParams();
  if (String(role || '').toLowerCase() !== 'sales') return null;
  return <SalesProformasScreen />;
}
