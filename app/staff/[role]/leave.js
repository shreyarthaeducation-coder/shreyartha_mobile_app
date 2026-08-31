import { useLocalSearchParams } from 'expo-router';
import { LeaveScreen } from '../../../components/staff';

/**
 * My Leave — this staff member's own balances and requests, on `/api/staff/hr`.
 *
 * Deliberately role-agnostic: the class-level guard on `StaffHrController` names TEACHER, COUNSELOR,
 * PRINCIPAL, VICE_PRINCIPAL, SCHOOL_ADMIN, SHREYARTHA_TEACHER, SHREYARTHA_COUNCELLOR and
 * SHREYARTHA_ADMIN — all eight, longhand — so every shell that reaches this file is authorised and
 * no role juggling is needed.
 *
 * ── A CORRECTION ────────────────────────────────────────────────────────────
 * This docblock used to say the counsellor, principal and VP panels "have no HR route at all". That
 * described the WEB SIDEBARS, and it read as though it described authorization. It never did: those
 * roles are named in the guard above. The counsellor and VP menus now carry these tiles.
 *
 * NOT to be confused with `leave-management.js`, which is the APPROVER queue on
 * `/api/school-admin/hr` — other people's requests. The two namespaces share verb names, so the
 * menu labels ("My Leave" versus "Leave Management") are what keep them apart.
 */
export default function StaffLeave() {
  const { role } = useLocalSearchParams();
  return <LeaveScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
