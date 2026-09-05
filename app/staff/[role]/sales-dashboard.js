import { useLocalSearchParams } from 'expo-router';
import SalesDashboardScreen from '../../../components/staff/sales/SalesDashboardScreen';

/**
 * The rep's own numbers — the funnel, the deviation, incentive progress and follow-ups due.
 *
 * The backend has served this payload since the panel was built; nothing on mobile had ever
 * asked for it.
 */
export default function StaffSalesDashboard() {
  const { role } = useLocalSearchParams();
  return <SalesDashboardScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
