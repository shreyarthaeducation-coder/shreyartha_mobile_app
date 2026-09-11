import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AuthScreen from './AuthScreen';
import Banner from './Banner';
import CheckboxRow from './CheckboxRow';
import FormField from './FormField';
import LinkButton from './LinkButton';
import PasswordField from './PasswordField';
import PrimaryButton from './PrimaryButton';
import SelectField from './SelectField';
import TabSwitch from './TabSwitch';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE } from '../../constants/theme';
import {
  SHREYARTHA_SCHOOL_CODE,
  authVariant,
  isShreyarthaRole,
  requiresSignupCode,
  variantAdmits,
} from '../../constants/authPortals';
import { useAuth } from '../../context/AuthContext';
import {
  forgotPassword,
  loginSchool,
  lookupSchoolCode,
  signupSchool,
  signupShreyartha,
} from '../../services/authService';
import { resolveDashboardRoute, storeSchoolSession } from '../../services/schoolSession';
import { startStaffAttendanceSession } from '../../services/staffAttendanceService';

/**
 * The one sign-in screen for every member of staff, rendered in one of two variants.
 *
 * ── WHY TWO VARIANTS AND NOT TWO SCREENS ────────────────────────────────────
 * All staff, school-bound and Shreyartha alike, authenticate through the same
 * `/api/school/auth/login`; a `school_users` row is distinguished only by its `user_type` and
 * `school_code`. So there was never a technical reason for two screens — but there was a product
 * one for two DOORS: with all nine roles in a single signup dropdown, school teachers were picking
 * "Shreyartha Teacher" and registering as HQ staff. The website split for exactly this reason and
 * this is the mobile half of it.
 *
 * The split is by ROUTE, not by a tab or a picker: /auth/school-login and /auth/employee-login are
 * two thin route files over this component. The role select appears only on Signup and is filled
 * from `config.roles`, so each door offers only its own cohort. Login has no role picker at all —
 * the role comes back from the server.
 *
 * ── THE WRONG-DOOR GUARD IS THE OTHER HALF OF THE SPLIT ─────────────────────
 * Restricting the signup dropdown alone would be cosmetic: the login endpoint authenticates every
 * staff role regardless of which door was used, so without the check in `handleLogin` a school
 * teacher could sign in at the employee door and get a working session. The guard runs BEFORE
 * `storeSchoolSession`, so a wrong-door attempt leaves nothing behind — same ordering, and same
 * reason, as the unsupported-role check beside it.
 */

const PALETTE = PORTALS.school;

export default function StaffAuthScreen({ variant = 'school' }) {
  const config = authVariant(variant);

  const router = useRouter();
  const { setUserType } = useAuth();

  // One card, three views — tabs are hidden while the forgot view is showing (web parity).
  const [view, setView] = useState('login');

  // Survives view switches: signup sets it, then flips to the login view where it is shown.
  const [successBanner, setSuccessBanner] = useState('');
  const [error, setError] = useState('');

  const [login, setLogin] = useState({ emailOrMobile: '', password: '' });
  // The default role is the variant's, so the picker never opens on a role this door refuses.
  const [signup, setSignup] = useState(() => emptySignup(config.defaultRole));
  const [forgotInput, setForgotInput] = useState('');
  const [forgotSent, setForgotSent] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [schoolLookup, setSchoolLookup] = useState({ status: 'idle', name: '' });

  // Guards a second submit slipping through before `submitting` has re-rendered.
  const inFlight = useRef(false);

  // Two questions that used to share one answer, and no longer do:
  //   needsSignupCode — only the SHREYARTHA_* roles, whose endpoint activates instantly
  //   pinnedToShreya01 — those three AND sales, none of which type a school code
  //
  // Both still read the ROLE rather than the variant. They agree with `config.roles` today, and
  // they are not the same question: these are about the account being created, not about which
  // URL the form is behind.
  const needsSignupCode = requiresSignupCode(signup.userType);
  const pinnedToShreya01 = isShreyarthaRole(signup.userType);

  // Deep links and the post-session-expiry redirect both arrive with no history to pop.
  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const goToView = useCallback((next) => {
    setView(next);
    setError('');
    if (next !== 'login') setSuccessBanner('');
    if (next !== 'forgot') {
      setForgotSent('');
      setForgotInput('');
    }
  }, []);

  // Android back: step back through the views before leaving the screen, so a half-filled
  // signup isn't lost to a stray back press.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'login') {
        goToView('login');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [view, goToView]);

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (inFlight.current) return;
    const identifier = login.emailOrMobile.trim();
    if (!identifier || !login.password) {
      setError('Please enter your email/mobile and password.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const res = await loginSchool(identifier, login.password);
      const data = res?.data ?? res;

      if (!data?.token) {
        throw new Error('Login failed: No authentication token received.');
      }

      // Mobile-only policy: the admin console is desktop-scale and not usable on a phone.
      if (String(data.userType || '').toLowerCase() === 'admin') {
        Alert.alert(
          'Access Not Available',
          'Admin access is not available on the mobile app. Please use the web portal at shreyartha.com.',
          [{ text: 'OK' }],
        );
        return; // nothing stored, no attendance ping — the user stays on the login screen
      }

      // THE WRONG-DOOR GUARD. The server authenticates every staff role through one endpoint, so
      // this cannot be checked before the password is — but it must be checked before anything is
      // persisted, or a wrong-door login leaves a usable session behind. Whoever arrives at the
      // wrong door is told where the right one is rather than simply refused.
      if (!variantAdmits(config.key, data.userType)) {
        setError(`That account signs in through the ${config.otherLabel} portal. `
          + `Use the ${config.otherLabel} login below.`);
        return;
      }

      // Resolve the destination BEFORE persisting anything: a role with no native shell must
      // not leave a half-usable session behind.
      if (!resolveDashboardRoute(data.userType, true)) {
        setError(
          'This account type is not supported on the mobile app. Please use the web portal at shreyartha.com.',
        );
        return;
      }

      const { role, verified, schoolCode } = await storeSchoolSession(data);

      // Fire-and-forget, exactly like the web: attendance must never delay or block navigation.
      startStaffAttendanceSession({
        name: data.fullName ?? 'User',
        email: data.email ?? '',
        role: data.userType || '',
        schoolCode,
      });

      setUserType('school');
      router.replace(resolveDashboardRoute(role, verified));
    } catch (e) {
      // Server messages are shown verbatim. Note a mistyped password currently surfaces
      // "Server error. Please try again." — the backend controller catches BadCredentialsException
      // in its generic handler and returns 500 instead of 401.
      setError(e?.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  // ── School-code lookup (advisory only) ───────────────────────────────────
  const handleSchoolCodeBlur = async () => {
    const code = signup.schoolCode.trim();
    if (!code || pinnedToShreya01) {
      setSchoolLookup({ status: 'idle', name: '' });
      return;
    }
    setSchoolLookup({ status: 'checking', name: '' });
    const school = await lookupSchoolCode(code);
    setSchoolLookup(
      school?.name ? { status: 'valid', name: school.name } : { status: 'invalid', name: '' },
    );
  };

  // ── Signup ───────────────────────────────────────────────────────────────
  const handleSignup = async () => {
    if (inFlight.current) return;

    const fullName = signup.fullName.trim();
    const email = signup.email.trim();
    const mobile = signup.mobile.trim();

    // RN has no HTML `required`/`pattern`, so the checks the browser gave the web page for free
    // are explicit here; the rest mirrors the web's validation order and copy exactly.
    if (!fullName || !email || !mobile || !signup.password) {
      setError('Please fill in all the required fields.');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!signup.password || signup.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!signup.terms) {
      setError('You must agree to the terms and conditions.');
      return;
    }
    if (!pinnedToShreya01 && !signup.schoolCode.trim()) {
      setError('Please enter your School Code.');
      return;
    }
    // The Shreyartha endpoint activates the account immediately (verified = true, and
    // SHREYARTHA_ADMIN implies SCHOOL_ADMIN), so the server gates it on a shared secret.
    if (needsSignupCode && !signup.signupCode.trim()) {
      setError('Please enter the Shreyartha staff signup code.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        fullName,
        email,
        mobile,
        userType: signup.userType,
        password: signup.password,
      };
      // Three ways, not two. SALES is pinned to SHREYA01 like the Shreyartha roles, but it
      // registers through the ORDINARY school endpoint so it lands unverified and waits for an
      // admin — signupShreyartha would activate it on the spot and has no SALES arm anyway.
      const res = needsSignupCode
        ? await signupShreyartha({ ...payload, signupCode: signup.signupCode.trim() })
        : await signupSchool({
            ...payload,
            schoolCode: pinnedToShreya01
              ? SHREYARTHA_SCHOOL_CODE
              : signup.schoolCode.trim(),
          });

      setSignup(emptySignup(config.defaultRole));
      setSchoolLookup({ status: 'idle', name: '' });
      setView('login');
      setError('');
      setSuccessBanner(
        res?.message ??
          res?.data?.message ??
          'Signup successful! Please wait for admin verification.',
      );
    } catch (e) {
      // The web swallows this and always says "Server error. Please try again."; we surface the
      // real reason ("This email is already registered.", "Invalid school code.", …).
      setError(e?.message || 'Server error. Please try again.');
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgot = async () => {
    if (inFlight.current) return;
    const value = forgotInput.trim();
    if (!value) {
      setError('Please enter your registered email or phone number.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const res = await forgotPassword('school', value);
      // Always-200 anti-enumeration response — shown inline rather than in an alert.
      setForgotSent(
        res?.message ??
          res?.data?.message ??
          'If an account exists for that email or phone, a password reset link has been sent.',
      );
      setForgotInput('');
    } catch (e) {
      setError(e?.message || 'Server error. Please try again.');
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  // ── View config ──────────────────────────────────────────────────────────
  const titles = {
    login: { title: config.loginTitle, subtitle: config.loginSubtitle },
    signup: { title: config.signupTitle, subtitle: config.signupSubtitle },
    forgot: {
      title: 'Reset Password',
      subtitle: 'Enter your email or phone number to receive a reset link',
    },
  }[view];

  const renderSchoolCodeHelper = () => {
    if (schoolLookup.status === 'checking') {
      return (
        <View style={styles.helperRow}>
          <ActivityIndicator size="small" color={PALETTE.primary} />
          <Text style={styles.helperChecking}>Checking…</Text>
        </View>
      );
    }
    if (schoolLookup.status === 'valid') {
      return <Text style={styles.helperValid}>School: {schoolLookup.name}</Text>;
    }
    if (schoolLookup.status === 'invalid') {
      // Advisory only — the server re-validates on submit, matching the web.
      return <Text style={styles.helperInvalid}>Invalid School Code</Text>;
    }
    return null;
  };

  return (
    <AuthScreen
      palette={PALETTE}
      title={titles.title}
      subtitle={titles.subtitle}
      onBack={handleBack}
    >
      {view !== 'forgot' && (
        <TabSwitch
          palette={PALETTE}
          activeKey={view}
          onChange={goToView}
          disabled={submitting}
          tabs={[
            { key: 'login', label: 'Login' },
            { key: 'signup', label: 'Sign Up' },
          ]}
        />
      )}

      <Banner variant="error" message={error} />
      {view === 'login' ? <Banner variant="success" message={successBanner} /> : null}

      {/* ── LOGIN ── */}
      {view === 'login' && (
        <>
          <FormField
            palette={PALETTE}
            label="Email / Mobile"
            placeholder="Enter your email or mobile"
            value={login.emailOrMobile}
            onChangeText={(v) => {
              setError('');
              setLogin((p) => ({ ...p, emailOrMobile: v }));
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <PasswordField
            palette={PALETTE}
            label="Password"
            placeholder="Enter your password"
            value={login.password}
            onChangeText={(v) => {
              setError('');
              setLogin((p) => ({ ...p, password: v }));
            }}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <LinkButton
            label="Forgot Password?"
            onPress={() => goToView('forgot')}
            color={PALETTE.link}
            align="right"
          />

          <PrimaryButton
            title="Login"
            onPress={handleLogin}
            loading={submitting}
            palette={PALETTE}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <LinkButton label="Sign up" onPress={() => goToView('signup')} color={PALETTE.link} />
          </View>
        </>
      )}

      {/* ── SIGNUP ── */}
      {view === 'signup' && (
        <>
          <FormField
            palette={PALETTE}
            label="Full Name"
            required
            placeholder="Enter your full name"
            value={signup.fullName}
            onChangeText={(v) => {
              setError('');
              setSignup((p) => ({ ...p, fullName: v }));
            }}
            autoCapitalize="words"
            textContentType="name"
          />
          <FormField
            palette={PALETTE}
            label="Email"
            required
            placeholder="Enter your email"
            value={signup.email}
            onChangeText={(v) => {
              setError('');
              setSignup((p) => ({ ...p, email: v }));
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <FormField
            palette={PALETTE}
            label="Mobile"
            required
            placeholder="Enter 10-digit mobile number"
            value={signup.mobile}
            onChangeText={(v) => {
              setError('');
              setSignup((p) => ({ ...p, mobile: v.replace(/[^0-9]/g, '') }));
            }}
            keyboardType="phone-pad"
            maxLength={10}
            textContentType="telephoneNumber"
          />

          {/* This door's roles only — the whole point of the split. */}
          <SelectField
            palette={PALETTE}
            label="Role / Position"
            required
            value={signup.userType}
            options={config.roles}
            onChange={(value) => {
              setError('');
              setSignup((p) => ({ ...p, userType: value }));
              // Shreyartha roles don't use a school code — drop any stale lookup result.
              if (isShreyarthaRole(value)) setSchoolLookup({ status: 'idle', name: '' });
            }}
          />

          {/* Hidden for Shreyartha roles, which are always pinned to SHREYA01. */}
          {!pinnedToShreya01 && (
            <FormField
              palette={PALETTE}
              label="School Code"
              required
              placeholder="Enter your school code"
              value={signup.schoolCode}
              onChangeText={(v) => {
                setError('');
                setSignup((p) => ({ ...p, schoolCode: v.toUpperCase() }));
                setSchoolLookup({ status: 'idle', name: '' });
              }}
              onBlur={handleSchoolCodeBlur}
              autoCapitalize="characters"
              autoCorrect={false}
              helper={renderSchoolCodeHelper()}
            />
          )}

          {/* Shown only for Shreyartha roles: that endpoint skips admin verification, so the
              server requires a shared secret before it will mint the account. */}
          {needsSignupCode && (
            <PasswordField
              palette={PALETTE}
              label="Shreyartha Signup Code"
              required
              placeholder="Provided by your administrator"
              value={signup.signupCode}
              onChangeText={(v) => {
                setError('');
                setSignup((p) => ({ ...p, signupCode: v }));
              }}
              textContentType="none"
            />
          )}

          <PasswordField
            palette={PALETTE}
            label="Password"
            required
            placeholder="Create a password (min 8 characters)"
            value={signup.password}
            onChangeText={(v) => {
              setError('');
              setSignup((p) => ({ ...p, password: v }));
            }}
            textContentType="newPassword"
          />

          <CheckboxRow
            palette={PALETTE}
            checked={signup.terms}
            onToggle={() => {
              setError('');
              setSignup((p) => ({ ...p, terms: !p.terms }));
            }}
            label="I acknowledge and agree to the terms and conditions of The 3C Edge platform."
          />

          <PrimaryButton
            title="Create Account"
            onPress={handleSignup}
            loading={submitting}
            palette={PALETTE}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <LinkButton label="Login" onPress={() => goToView('login')} color={PALETTE.link} />
          </View>
        </>
      )}

      {/* ── FORGOT ── */}
      {view === 'forgot' && (
        <>
          <Banner variant="success" message={forgotSent} />

          {!forgotSent && (
            <>
              <FormField
                palette={PALETTE}
                label="Email / Phone Number"
                placeholder="Enter registered email or phone number"
                value={forgotInput}
                onChangeText={(v) => {
                  setError('');
                  setForgotInput(v);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleForgot}
              />
              <PrimaryButton
                title="Send Reset Link"
                onPress={handleForgot}
                loading={submitting}
                palette={PALETTE}
              />
            </>
          )}

          <LinkButton
            label="← Back to Login"
            onPress={() => goToView('login')}
            color={PALETTE.link}
            style={styles.backToLogin}
          />
        </>
      )}

      {/* THE CROSS-LINK, on every view including Forgot.
          A door that only refuses is a dead end; this is what makes the split navigable, and it is
          the control the wrong-door error above points at. `replace`, not `push`: the two doors are
          alternatives rather than a stack, so backing out of the second should leave the login
          flow entirely rather than land on the first. */}
      <View style={styles.crossLink}>
        <Text style={styles.footerText}>{config.otherPrompt} </Text>
        <LinkButton
          label={`Go to ${config.otherLabel} login`}
          onPress={() => router.replace(config.otherRoute)}
          color={PALETTE.link}
        />
      </View>
    </AuthScreen>
  );
}

function emptySignup(defaultRole) {
  return {
    fullName: '',
    email: '',
    mobile: '',
    schoolCode: '',
    userType: defaultRole,
    password: '',
    // Only sent for the SHREYARTHA_* roles — see handleSignup.
    signupCode: '',
    terms: false,
  };
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  // Same row shape as footerRow but wrapping, because the prompt is a full sentence and the link
  // that follows it cannot be allowed to overflow a 360dp screen.
  crossLink: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  footerText: { fontSize: TYPE.body, color: SLATE[500] },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helperChecking: { fontSize: TYPE.label, color: SLATE[500] },
  helperValid: { fontSize: TYPE.label, color: FEEDBACK.successText, fontWeight: '600' },
  helperInvalid: { fontSize: TYPE.label, color: FEEDBACK.errorText, fontWeight: '600' },
  backToLogin: { marginTop: SPACING.sm },
});
