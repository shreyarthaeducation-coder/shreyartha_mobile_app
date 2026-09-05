/**
 * School-staff role configuration.
 *
 * Labels and values are copied verbatim from the web signup dropdown
 * (frontendmain/src/School/SchoolAuth.js `userTypes`) — including the "Councellor" spelling,
 * which the backend also uses as the canonical enum value
 * (ERole.ROLE_SHREYARTHA_COUNCELLOR). Do not "correct" it.
 */
export const SCHOOL_ROLES = [
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'COUNSELOR', label: 'Counselor' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'VICE_PRINCIPAL', label: 'Vice Principal' },
  { value: 'ADMIN', label: 'School Admin' },
  { value: 'SHREYARTHA_ADMIN', label: 'Shreyartha Admin' },
  { value: 'SHREYARTHA_COUNCELLOR', label: 'Shreyartha Councellor' },
  { value: 'SHREYARTHA_TEACHER', label: 'Shreyartha Teacher' },
  // Field sales. Registers here like anyone else and waits for a platform admin to approve —
  // which is why it belongs in the picker even though its backend role is ROLE_SHREYARTHA_SALES.
  { value: 'SALES', label: 'Sales Employee' },
];

/**
 * Is this role pinned to the Shreyartha (SHREYA01) school?
 *
 * Used for exactly one thing: choosing the `schoolCode` a session stores. These roles have no
 * school of their own, so the code is pinned rather than read from the login response.
 *
 * SALES is named explicitly because the prefix test cannot see it. Its backend role IS
 * `ROLE_SHREYARTHA_SALES`, but the `userType` stored on its `school_users` row is the short
 * `SALES` — chosen so the panel reads "Sales" rather than "Shreyartha Sales" throughout, and so
 * its route is `/staff/sales`.
 *
 * ── DO NOT USE THIS TO PICK A SIGNUP ENDPOINT ───────────────────────────────
 * It used to serve both purposes, and the two have since diverged: SALES is pinned to SHREYA01
 * (so it belongs here) but signs up through the ordinary school endpoint and waits for approval
 * (so it does NOT belong in the signup-code branch). Reusing this predicate there would show a
 * sales applicant the Shreyartha Signup Code field and post them to
 * `/api/shreyartha/auth/signup` — which activates accounts immediately and has no SALES arm, so
 * it would 400. {@link requiresSignupCode} is the predicate for that decision.
 */
export const isShreyarthaRole = (userType) => {
  const value = String(userType || '').toUpperCase();
  return value.startsWith('SHREYARTHA_') || value === 'SALES';
};

/**
 * Does signing up as this role demand the shared Shreyartha signup code?
 *
 * True only for the three `SHREYARTHA_*` roles, whose signup endpoint activates the account on
 * the spot and is therefore gated by a secret. Everyone else — school staff and SALES alike —
 * registers unverified and is gated by admin approval instead.
 *
 * Deliberately the prefix test alone, with no SALES arm. See the warning on
 * {@link isShreyarthaRole}.
 */
export const requiresSignupCode = (userType) =>
  String(userType || '').toUpperCase().startsWith('SHREYARTHA_');

/** The school code every Shreyartha role is pinned to. */
export const SHREYARTHA_SCHOOL_CODE = 'SHREYA01';
