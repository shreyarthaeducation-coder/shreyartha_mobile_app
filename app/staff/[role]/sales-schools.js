import { useLocalSearchParams } from 'expo-router';
import SalesSchoolsScreen from '../../../components/staff/sales/SalesSchoolsScreen';

/** Schools assigned to this rep, with base / GST / total revenue kept as three separate figures. */
export default function StaffSalesSchools() {
  const { role } = useLocalSearchParams();
  return <SalesSchoolsScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
