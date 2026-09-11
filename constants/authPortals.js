/**
 * Staff role configuration, split across the app's two staff doors.
 *
 * Labels and values are copied verbatim from the web (frontendmain/src/School/SchoolAuth.js) —
 * including the "Councellor" spelling, which the backend also uses as the canonical enum value
 * (ERole.ROLE_SHREYARTHA_COUNCELLOR). Do not "correct" it.
 *
 * ── WHY THE NINE ROLES ARE NOW TWO LISTS ────────────────────────────────────
 * They used to be one `SCHOOL_ROLES` array behind one login screen, and that is exactly what the
 * website moved away from: with every role in one signup dropdown, school teachers were picking
 * "Shreyartha Teacher" and registering as HQ staff. The web now serves /schoollogin and
 * /employeelogin as two variants of one component, each offering only its own cohort, and the
 * mobile app follows.
 *
 * The split is by DOOR, not by any property of the role — SALES sits with the Shreyartha roles
 * because a rep is Shreyartha staff, even though it signs up through the ordinary school endpoint.
 * See `requiresSignupCode` below, which is the predicate that actually decides that.
 */

/** The five roles that belong to a partner school. Door: /auth/school-login. */
export const SCHOOL_ROLES = [
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'COUNSELOR', label: 'Counselor' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'VICE_PRINCIPAL', label: 'Vice Principal' },
  { value: 'ADMIN', label: 'School Admin' },
];

/**
 * The four Shreyartha (SHREYA01) roles. Door: /auth/employee-login.
 *
 * Field sales registers here like anyone else and waits for a platform admin to approve — which is
 * why it belongs in this picker even though its backend role is ROLE_SHREYARTHA_SALES and its
 * stored `userType` is the short `SALES`.
 */
export const EMPLOYEE_ROLES = [
  { value: 'SHREYARTHA_ADMIN', label: 'Shreyartha Admin' },
  { value: 'SHREYARTHA_COUNCELLOR', label: 'Shreyartha Councellor' },
  { value: 'SHREYARTHA_TEACHER', label: 'Shreyartha Teacher' },
  { value: 'SALES', label: 'Sales Employee' },
];

/**
 * Every staff role, both doors.
 *
 * Derived rather than hand-maintained, so a role added to either list above cannot go missing here.
 * Anything that needs "is this a staff role at all" — as opposed to "which door" — reads this.
 */
export const ALL_STAFF_ROLES = [...SCHOOL_ROLES, ...EMPLOYEE_ROLES];

/**
 * The two doors, mirroring the web's `VARIANTS` map. Copy is verbatim from SchoolAuth.js so the
 * two platforms read identically.
 *
 * `otherRoute` is what makes the split survivable: whoever arrives at the wrong door is told where
 * the right one is rather than being refused and left to guess.
 */
export const AUTH_VARIANTS = {
  school: {
    key: 'school',
    roles: SCHOOL_ROLES,
    defaultRole: 'TEACHER',
    loginTitle: 'School Staff Portal',
    signupTitle: 'School Staff Registration',
    loginSubtitle: "Sign in to your school's dashboard",
    signupSubtitle: "Register with your school's code",
    otherPrompt: 'Work for Shreyartha rather than a partner school?',
    otherLabel: 'employee',
    otherRoute: '/auth/employee-login',
  },
  employee: {
    key: 'employee',
    roles: EMPLOYEE_ROLES,
    defaultRole: 'SHREYARTHA_TEACHER',
    loginTitle: 'Employee Portal',
    signupTitle: 'Employee Registration',
    loginSubtitle: 'Sign in to your employee dashboard',
    signupSubtitle: 'Register as an employee',
    otherPrompt: 'Teach or work at a partner school?',
    otherLabel: 'school staff',
    otherRoute: '/auth/school-login',
  },
};

/** The variant for a door key, defaulting to the school one. */
export function authVariant(key) {
  return AUTH_VARIANTS[String(key || '').toLowerCase()] || AUTH_VARIANTS.school;
}

/**
 * Does this door admit that role?
 *
 * The web enforces this AFTER a successful login (SchoolAuth.js) — the server authenticates every
 * staff role through one endpoint and only then reports the `userType`, so the door cannot be
 * checked before the password is. Mobile does the same, and the check must run BEFORE
 * `storeSchoolSession` or a wrong-door login leaves a usable session behind.
 */
export function variantAdmits(variantKey, userType) {
  const value = String(userType || '').toUpperCase();
  return authVariant(variantKey).roles.some((role) => role.value === value);
}

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
 *
 * ── AND DO NOT REPLACE IT WITH "IS IT IN EMPLOYEE_ROLES" ────────────────────
 * The two agree today, and they are not the same question. This one asks about the school code;
 * EMPLOYEE_ROLES asks which door the form is behind. Collapsing them would make the school-code
 * field's visibility depend on the URL rather than on the role that was picked.
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

/**
 * The app's login entry points, in the website's two groups.
 *
 * ── WHY THIS LIVES HERE AND NOT IN EACH PICKER ──────────────────────────────
 * There are two pickers — the "Login" modal on the landing tab and the full-screen
 * /auth/login-select — and until now each carried its own copy of the list. They had already
 * drifted (login-select advertised Sales under School Staff; the modal did not), and the whole
 * point of this change is that the doors are stated once.
 *
 * ── WHY MOBILE'S "GET STARTED" GROUP IS FOUR AND THE WEB'S IS SIX ───────────
 * The web's GENERAL_LOGINS also carries Alumni and University. Neither has a mobile screen: there
 * is no app/auth/alumni-login or university-login, and no native panel behind either. Investor and
 * the platform Admin console are likewise web-only. Listing them here would produce a card that
 * navigates nowhere, so they are absent rather than broken.
 *
 * `color`/`iconColor` are only read by the full-screen picker; the compact modal uses `icon` and
 * `label` alone.
 */
export const LOGIN_GROUPS = [
  {
    key: 'general',
    label: 'Get Started',
    options: [
      {
        key: 'student',
        icon: '🎓',
        label: 'Student',
        sublabel: 'Access learning dashboard & assessments',
        route: '/auth/student-login',
        color: '#E3F2FD',
        iconColor: '#1565C0',
      },
      {
        key: 'school',
        icon: '🏫',
        label: 'School Staff',
        // No longer "& Sales": sales moved to the employee door with the other Shreyartha roles.
        sublabel: 'Teacher, Counselor, Principal & Vice Principal',
        route: '/auth/school-login',
        color: '#E8F5E9',
        iconColor: '#2E7D32',
      },
      {
        key: 'parent',
        icon: '👨‍👩‍👧',
        label: 'Parent',
        sublabel: "Monitor your child's progress",
        route: '/auth/parent-login',
        color: '#FFF3E0',
        iconColor: '#E65100',
      },
      {
        key: 'partner',
        icon: '🤝',
        label: 'Partner',
        sublabel: 'Partner portal & dashboard',
        route: '/auth/partner-login',
        color: '#FCE4EC',
        iconColor: '#C2185B',
      },
    ],
  },
  {
    key: 'employee',
    label: 'Employee',
    options: [
      {
        key: 'employee',
        icon: '🏢',
        label: 'Employee',
        sublabel: 'Shreyartha Admin, Councellor, Teacher & Sales',
        route: '/auth/employee-login',
        color: '#EDE9FE',
        iconColor: '#4338CA',
      },
    ],
  },
];

/** Every login option, both groups — for a surface that wants one flat list. */
export const LOGIN_OPTIONS = LOGIN_GROUPS.flatMap((group) => group.options);

/**
 * One door, by group key — `'general'` or `'employee'`.
 *
 * ── THE LANDING PAGE SHOWS ONE GROUP PER CONTROL, NOT BOTH ──────────────────
 * The website splits the two doors across two separate controls and never shows them together:
 * the top-right button is `variant="employee"` (see LandingPage.js, "Shreyartha-bound staff only.
 * Everyone else enters via the hero Get Started") and the hero and footer CTAs are
 * `variant="general"` rendered `asModal`. Mobile listed BOTH groups in its one top-right modal
 * while "Get Started" bypassed the picker entirely and hard-navigated to the student login — the
 * inverse of the web on both counts.
 *
 * Returning the group rather than a bare array keeps its `label` with it, so a caller cannot show
 * one group's options under the other's heading.
 *
 * The full-screen picker at /auth/login-select still renders BOTH groups. That screen is the
 * "I don't know which door I need" surface and is reached deliberately; the landing controls are
 * not.
 */
export function loginGroup(key) {
  return LOGIN_GROUPS.find((group) => group.key === key) || null;
}
