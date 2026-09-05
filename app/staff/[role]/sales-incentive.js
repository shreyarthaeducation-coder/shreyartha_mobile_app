import { useLocalSearchParams } from 'expo-router';
import SalesIncentiveScreen from '../../../components/staff/sales/SalesIncentiveScreen';

/** Threshold progress, the accrual ledger, and the "what if I collect more" simulator. */
export default function StaffSalesIncentive() {
  const { role } = useLocalSearchParams();
  return <SalesIncentiveScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
