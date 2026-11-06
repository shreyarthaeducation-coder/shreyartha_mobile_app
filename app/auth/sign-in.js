import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AuthScreen,
  Banner,
  FormField,
  LinkButton,
  PasswordField,
  PrimaryButton,
} from '../../components/auth';
import { PORTALS, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { LOGIN_GROUPS } from '../../constants/authPortals';
import SignupTiles from '../../components/auth/SignupTiles';
import { requestResetAny, signIn } from '../../services/authService';
import { applyPortalSession, portalLabel } from '../../services/portalSession';
import { useAuth } from '../../context/AuthContext';

const PALETTE = PORTALS.school;

/**
 * THE SINGLE SIGN-IN GATE.
 *
 * Signing in used to start with a question nobody should have to answer — "which of four doors are
 * you?" — and picking wrong produced an error rather than a login. This screen takes an email or
 * mobile and a password; the server resolves the portal from the credentials.
 *
 * Registering still differs per role (a parent links a child, a teacher needs a school code, a
 * partner accepts terms), so the per-role screens are untouched and reached from "Register" below.
 *
 * Shreyartha's own staff keep their own door, reached from the landing's Employee button — this
 * screen deliberately does not advertise it.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const registerOptions =
    LOGIN_GROUPS.find((g) => g.key === 'general')?.options ?? [];

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your email or mobile, and your password.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await signIn(identifier.trim(), password);
      const portal = res?.portal;
      const data = res?.data;
      if (!portal || !data) throw new Error('Sign-in failed. Please try again.');

      const { route, unsupported } = await applyPortalSession(portal, data);
      if (unsupported || !route) {
        // Nothing has been stored in this branch, so the person is not left half-signed-in.
        const label = portalLabel(portal, data);
        setError(`${label} accounts sign in on the website — this app has no ${label} panel yet.`);
        return;
      }
      setUserType(portal.toLowerCase() === 'school' ? 'school' : portal.toLowerCase());
      router.replace(route);
    } catch (e) {
      // The server answers the same way for an unknown account and a wrong password, on purpose.
      setError(e.message || 'Invalid email/mobile or password.');
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    setForgotBusy(true);
    try {
      await requestResetAny(forgotInput.trim());
    } catch {
      // Answers 200 regardless; only a transport failure lands here.
    } finally {
      setForgotBusy(false);
      setNotice('If an account exists for that email or mobile, a reset link has been sent.');
      setForgotOpen(false);
      setForgotInput('');
    }
  };

  return (
    <AuthScreen
      palette={PALETTE}
      title="Welcome back"
      subtitle="One sign-in for students, parents, staff, alumni, universities, partners, industry and investors."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      <Banner message={error} variant="error" />
      <Banner message={notice} variant="success" />

      <FormField
        label="Email or mobile"
        required
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="you@example.com or 98765 43210"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <PasswordField
        label="Password"
        required
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <PrimaryButton
        title="Sign in"
        onPress={submit}
        loading={loading}
        palette={PALETTE}
      />

      <LinkButton
        label={forgotOpen ? 'Cancel' : 'Forgot password?'}
        onPress={() => setForgotOpen((v) => !v)}
        palette={PALETTE}
        align="center"
      />

      {forgotOpen && (
        <View style={styles.forgot}>
          <Text style={styles.forgotNote}>
            We'll email a reset link to the address on your account.
          </Text>
          <FormField
            label="Email or mobile"
            value={forgotInput}
            onChangeText={setForgotInput}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!forgotBusy}
          />
          <PrimaryButton
            title="Send reset link"
            onPress={sendReset}
            loading={forgotBusy}
            palette={PALETTE}
          />
        </View>
      )}

      <View style={styles.register}>
        <Text style={styles.registerTitle}>New here? Register as</Text>
        {/* Two layers of tiles (6 Nov 2026), as on the website: the organisation, then the role. */}
        <SignupTiles options={registerOptions} onPick={(opt) => router.push(`${opt.route}?tab=signup`)} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgot: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  forgotNote: {
    fontSize: TYPE.label,
    lineHeight: leading(TYPE.label),
    color: SLATE[600],
    marginBottom: SPACING.sm,
  },
  register: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  registerTitle: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: SLATE[700],
    marginBottom: SPACING.sm,
  },
  pressed: { opacity: 0.75 },
});
