import { useLocalSearchParams } from 'expo-router';
import { SalesProformaScreen } from '../../../components/staff/sales/SalesProformaScreens';

/** Sales only — `/api/staff/sales/**` serves the rep's own schools and documents. */
export default function StaffSalesProforma() {
  const { role, id } = useLocalSearchParams();
  if (String(role || '').toLowerCase() !== 'sales') return null;
  return <SalesProformaScreen id={typeof id === 'string' ? id : ''} />;
}
