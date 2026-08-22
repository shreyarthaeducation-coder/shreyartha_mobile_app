import { useLocalSearchParams } from 'expo-router';
import { StaffEvaluationScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/** Staff Evaluation — category → member → breakdown, with the three-metric rating sheet. */
export default function StaffEvaluation() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no staffEvaluation base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.staffEvaluation) return null;

  return (
    <StaffEvaluationScreen homeRoute={`/staff/${roleKey}`} apiBase={portal.staffEvaluation} />
  );
}
