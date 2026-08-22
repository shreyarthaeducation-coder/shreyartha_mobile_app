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
];

/**
 * The three Shreyartha (SHREYA01) roles behave differently on both ends: they register through
 * a separate endpoint that needs no school code, are auto-verified, and always resolve to the
 * SHREYA01 school code regardless of what the login response carries.
 */
export const isShreyarthaRole = (userType) =>
  String(userType || '').toUpperCase().startsWith('SHREYARTHA_');

/** The school code every Shreyartha role is pinned to. */
export const SHREYARTHA_SCHOOL_CODE = 'SHREYA01';
