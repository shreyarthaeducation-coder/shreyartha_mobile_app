import { useLocalSearchParams } from 'expo-router';
import { AdmissionEnquiriesScreen } from '../../../components/staff/outreach/OutreachScreens';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/** Admission Enquiries — the School Admin only (`outreach` is on that descriptor alone). */
export default function StaffAdmissionEnquiries() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!getAdminPortal(roleKey)?.outreach) return null;
  return <AdmissionEnquiriesScreen homeRoute={`/staff/${roleKey}`} />;
}
