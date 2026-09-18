import Constants from 'expo-constants';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'https://shreyartha.com';

const postJson = async (endpoint, body) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server error. Please try again.');
  }
  if (!res.ok) {
    const msg =
      data?.message || data?.error || data?.data?.message ||
      'Request failed. Please try again.';
    throw new Error(msg);
  }
  return data;
};

export const loginStudent = (email, password) =>
  postJson('/api/auth/login', { email, password });

export const loginSchool = (emailOrMobile, password) =>
  postJson('/api/school/auth/login', { emailOrMobile, password });

export const loginParent = (emailOrMobile, password) =>
  postJson('/api/parent/auth/login', { emailOrMobile, password });

/**
 * Parent sign-up.
 *
 * `studentMobileOrEmail` is the only thing that links the new account to a child — the server uses
 * it to find the student, and every `/api/parent/dashboard/*` endpoint then resolves that child
 * from the JWT rather than from any client input.
 *
 * TWO THINGS TO KNOW ABOUT THE RESPONSE:
 *  - The web collects a terms checkbox but does NOT send it; `ParentSignupRequest` has no such
 *    field. Gate the button on it client-side, then leave it out of the payload.
 *  - Success returns a message and NO TOKEN. The account waits for admin verification, so the
 *    caller must return the user to the Login tab rather than trying to enter the panel.
 */
export const signupParent = ({ fullName, email, mobile, studentMobileOrEmail, password }) =>
  postJson('/api/parent/auth/signup', {
    fullName,
    email,
    mobile,
    studentMobileOrEmail,
    password,
  });

export const loginPartner = (emailOrMobile, password) =>
  postJson('/api/partner/auth/login', { emailOrMobile, password });

/**
 * Partner registration.
 *
 * ── `termsAccepted` IS PART OF THE PAYLOAD HERE, UNLIKE THE PARENT'S ─────────
 * The two signup forms look identical — same four fields, same terms checkbox — but the DTOs are
 * not. `ParentSignupRequest` has no terms field, so the parent's checkbox is client-side only.
 * `PartnerSignupRequest` HAS one, and `PartnerAuthService` throws when it is null or false; on
 * success it stamps `termsAcceptedAt` and `termsVersion = PartnerCommissionRates.TERMS_VERSION`
 * onto the account. Copying the parent's shortcut here would fail every signup.
 *
 * Success returns a message and NO TOKEN — the account waits for admin verification, and an
 * unverified partner is granted no endpoint at all — so the caller returns the user to the Login
 * tab rather than trying to enter the panel.
 */
export const signupPartner = ({ fullName, email, mobile, password, termsAccepted }) =>
  postJson('/api/partner/auth/signup', {
    fullName,
    email,
    mobile,
    password,
    termsAccepted: !!termsAccepted,
  });

/**
 * Staff registration — ONE endpoint for every role, school-bound and Shreyartha HQ alike.
 *
 * Two things vary by role:
 *  - `schoolCode`: a partner school's staff type theirs; the five employee roles are pinned to
 *    SHREYA01 by the caller, and the server refuses an employee role under any other code;
 *  - `signupCode`: sent ONLY by the three SHREYARTHA_* roles (see `requiresSignupCode`). Those
 *    accounts are active immediately once it matches; everyone else — SALES and HR included — lands
 *    unverified and waits for an admin.
 *
 * There used to be a second endpoint here, `signupShreyartha`, which took the same shared code but
 * sent no schoolCode. It was deleted in Sept 2026; the code it carried now rides on this one.
 *
 * Payload field names match frontendmain/src/School/SchoolAuth.js handleSignupSubmit.
 */
export const signupSchool = ({
  fullName,
  email,
  mobile,
  userType,
  password,
  schoolCode,
  signupCode,
}) =>
  postJson('/api/school/auth/signup', {
    fullName,
    email,
    mobile,
    userType,
    password,
    schoolCode,
    // Omitted rather than sent empty for the roles that do not use it, so the server's "ignored for
    // this role" path and "missing for this role" error stay distinguishable.
    ...(signupCode ? { signupCode } : {}),
  });

/**
 * STUDENT registration — a different endpoint from the school-staff pair above.
 *
 * Payload field names match frontendmain/src/student/StudentAuth.js `handleSignupSubmit`, including
 * its quirks: the entered code goes into `schoolCode` OR `collegeCode` depending on `studentType`
 * (never both), and `schoolName` is always sent EMPTY — the server resolves the name from the code,
 * so sending the looked-up name would let a client claim a school it does not belong to.
 *
 * A student with no institution enters "none", which simply yields an empty code.
 *
 * @param {'SCHOOL'|'COLLEGE'} studentType
 */
export const signupStudent = ({ fullName, email, mobile, studentType, code, password }) => {
  const isCollege = studentType === 'COLLEGE';
  const entered = (code || '').trim();
  const usable = entered.toLowerCase() === 'none' ? '' : entered;
  return postJson('/api/auth/signup', {
    fullName,
    email,
    mobile,
    studentType,
    schoolCode: isCollege ? '' : usable,
    collegeCode: isCollege ? usable : '',
    schoolName: '',
    password,
  });
};

/**
 * Look up an institution by code for the signup form's live feedback.
 *
 * TWO endpoints, picked by student type — schools and colleges are different registries and the
 * college one is NOT under `/api/admin/`:
 *   SCHOOL   /api/admin/schools/code/{code}
 *   COLLEGE  /api/university/auth/code/{code}
 *
 * Public (no auth). Purely advisory — the result is displayed but never blocks submit, matching the
 * web; the server re-validates on signup anyway. Never throws: an unreachable endpoint just means
 * no feedback shown.
 *
 * @returns {Promise<{name: string} | null>} the institution, or null when not found/unavailable
 */
export const lookupInstitutionCode = async (code, studentType = 'SCHOOL') => {
  const path =
    studentType === 'COLLEGE'
      ? `/api/university/auth/code/${encodeURIComponent(code)}`
      : `/api/admin/schools/code/${encodeURIComponent(code)}`;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Both endpoints answer either bare or wrapped in `data`.
    const name = data?.data?.name ?? data?.name ?? '';
    return name ? { name } : null;
  } catch {
    return null;
  }
};

/** The school-only form of the lookup, kept for the school-staff signup that already uses it. */
export const lookupSchoolCode = (code) => lookupInstitutionCode(code, 'SCHOOL');

const FORGOT_ENDPOINTS = {
  student: '/api/auth/forgot-password',
  school: '/api/school/auth/forgot-password',
  parent: '/api/parent/auth/forgot-password',
  partner: '/api/partner/auth/forgot-password',
};

export const forgotPassword = (type, emailOrPhone) =>
  postJson(FORGOT_ENDPOINTS[type] || FORGOT_ENDPOINTS.student, { emailOrPhone });

export const deleteStudentAccount = async (token) => {
  const res = await fetch(`${BASE_URL}/api/students/delete-account`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    let data;
    try { data = await res.json(); } catch { /* empty */ }
    throw new Error(data?.message || 'Failed to delete account.');
  }
  return true;
};
