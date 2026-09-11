import { useLocalSearchParams } from 'expo-router';
import TravelExpensesScreen from '../../../components/staff/TravelExpensesScreen';

/**
 * My Expenses for the three Shreyartha shells that carry it — sales, shreyartha_teacher and
 * shreyartha_councellor. The backend guard is what limits it to those roles; this route only has to
 * know where Back lands.
 */
export default function StaffTravelExpenses() {
  const { role } = useLocalSearchParams();
  return <TravelExpensesScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
