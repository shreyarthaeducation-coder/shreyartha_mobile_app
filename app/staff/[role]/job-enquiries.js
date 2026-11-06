import { useLocalSearchParams } from 'expo-router';
import { JobEnquiriesScreen } from '../../../components/staff/outreach/OutreachScreens';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/** Job Enquiries — the School Admin only (`outreach` is on that descriptor alone). */
export default function StaffJobEnquiries() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!getAdminPortal(roleKey)?.outreach) return null;
  return <JobEnquiriesScreen homeRoute={`/staff/${roleKey}`} />;
}
