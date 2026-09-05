import { useLocalSearchParams } from 'expo-router';
import SalesDealsScreen from '../../../components/staff/sales/SalesDealsScreen';

/** Recording a sale: products and grades, student counts, payment method, 18% GST. */
export default function StaffSalesDeals() {
  const { role } = useLocalSearchParams();
  return <SalesDealsScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
