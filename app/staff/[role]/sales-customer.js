import { useLocalSearchParams } from 'expo-router';
import { SalesCustomerScreen } from '../../../components/staff/sales/SalesCommunicationScreens';

/** Sales only — `/api/staff/sales/**` serves the rep's own schools and documents. */
export default function StaffSalesCustomer() {
  const { role, kind, id } = useLocalSearchParams();
  if (String(role || '').toLowerCase() !== 'sales') return null;
  return <SalesCustomerScreen kind={typeof kind === 'string' ? kind : ''} id={typeof id === 'string' ? id : ''} />;
}
