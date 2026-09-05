import { useLocalSearchParams } from 'expo-router';
import SalesVisitsScreen from '../../../components/staff/sales/SalesVisitsScreen';

/**
 * Field visits — the month calendar, check-in and the offline queue.
 *
 * The one screen in this shell that writes to disk before it writes to the server. See
 * services/sales/visitQueue.js for why.
 */
export default function StaffSalesVisits() {
  const { role } = useLocalSearchParams();
  return <SalesVisitsScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
