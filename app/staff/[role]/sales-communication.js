import { useLocalSearchParams } from 'expo-router';
import { SalesCommunicationsScreen } from '../../../components/staff/sales/SalesCommunicationScreens';

/** Sales only — `/api/staff/sales/**` serves the rep's own schools and documents. */
export default function StaffSalesCommunications() {
  const { role } = useLocalSearchParams();
  if (String(role || '').toLowerCase() !== 'sales') return null;
  return <SalesCommunicationsScreen />;
}
