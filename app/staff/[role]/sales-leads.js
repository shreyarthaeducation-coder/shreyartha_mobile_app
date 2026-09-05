import { useLocalSearchParams } from 'expo-router';
import SalesLeadsScreen from '../../../components/staff/sales/SalesLeadsScreen';

/**
 * The LEAD desk — prospects and their pipeline stage.
 *
 * Sales-only, unlike most files in this group: no other role has a lead concept, so this does not
 * pretend to be role-agnostic. `homeRoute` still comes from the URL segment so a deep link lands
 * its Back button correctly.
 */
export default function StaffSalesLeads() {
  const { role } = useLocalSearchParams();
  return <SalesLeadsScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
