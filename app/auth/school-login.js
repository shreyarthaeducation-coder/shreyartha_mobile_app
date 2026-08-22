import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AuthScreen,
  Banner,
  CheckboxRow,
  FormField,
  LinkButton,
  PasswordField,
  PrimaryButton,
  SelectField,
  TabSwitch,
} from '../../components/auth';
import { FEEDBACK, PORTALS, SLATE, SPACING } from '../../constants/theme';
import { SCHOOL_ROLES, isShreyarthaRole } from '../../constants/authPortals';
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
 * School Staff Portal — the login used by Teachers, Counselors, Principals, Vice Principals,
 * School Admins and the three Shreyartha (SHREYA01) roles.
 *
 * Full parity with the web page (frontendmain/src/School/SchoolAuth.js): the same three views in
 * one card (Login / Signup / inline Forgot), the same 8 roles, the same live school-code lookup,
 * the same dual signup endpoints, and the same staff self-attendance ping on login.
 *
 * There is no role picker on Login — the role comes back from the server, exactly like the web.
 */

const PALETTE = PORTALS.school;

const EMPTY_SIGNUP = {
  fullName: '',
  email: '',
  mobile: '',
  schoolCode: '',
  userType: 'TEACHER',
  password: '',
  // Only sent for the SHREYARTHA_* roles — see handleSignup.
  signupCode: '',
  terms: false,
};

export default function SchoolLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();

  // One card, three views — tabs are hidden while the forgot view is showing (web parity).
  const [view, setView] = useState('login');

  // Survives view switches: signup sets it, then flips to the login view where it is shown.
  const [successBanner, setSuccessBanner] = useState('');
  const [error, setError] = useState('');

  const [login, setLogin] = useState({ emailOrMobile: '', password: '' });
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotSent, setForgotSent] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [schoolLookup, setSchoolLookup] = useState({ status: 'idle', name: '' });

  // Guards a second submit slipping through before `submitting` has re-rendered.
  const inFlight = useRef(false);

  const shreyarthaSelected = isShreyarthaRole(signup.userType);

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
    if (!code || shreyarthaSelected) {
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
    if (!shreyarthaSelected && !signup.schoolCode.trim()) {
      setError('Please enter your School Code.');
      return;
    }
    // The Shreyartha endpoint activates the account immediately (verified = true, and
    // SHREYARTHA_ADMIN implies SCHOOL_ADMIN), so the server gates it on a shared secret.
    if (shreyarthaSelected && !signup.signupCode.trim()) {
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
      // Shreyartha roles register through their own endpoint and carry no school code.
      const res = shreyarthaSelected
        ? await signupShreyartha({ ...payload, signupCode: signup.signupCode.trim() })
        : await signupSchool({ ...payload, schoolCode: signup.schoolCode.trim() });

      setSignup(EMPTY_SIGNUP);
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
    login: { title: 'School Staff Portal', subtitle: 'Sign in to access your dashboard' },
    signup: { title: 'School Staff Registration', subtitle: 'Register for The 3C Edge platform' },
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

          <SelectField
            palette={PALETTE}
            label="Role / Position"
            required
            value={signup.userType}
            options={SCHOOL_ROLES}
            onChange={(value) => {
              setError('');
              setSignup((p) => ({ ...p, userType: value }));
              // Shreyartha roles don't use a school code — drop any stale lookup result.
              if (isShreyarthaRole(value)) setSchoolLookup({ status: 'idle', name: '' });
            }}
          />

          {/* Hidden for Shreyartha roles, which are always pinned to SHREYA01. */}
          {!shreyarthaSelected && (
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
          {shreyarthaSelected && (
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
    </AuthScreen>
  );
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
  footerText: { fontSize: 14, color: SLATE[500] },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helperChecking: { fontSize: 12.5, color: SLATE[500] },
  helperValid: { fontSize: 12.5, color: FEEDBACK.successText, fontWeight: '600' },
  helperInvalid: { fontSize: 12.5, color: FEEDBACK.errorText, fontWeight: '600' },
  backToLogin: { marginTop: SPACING.sm },
});
