import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
 * Shreyartha's own staff keep their own door — deliberately, because school teachers signing up as
 * Shreyartha teachers was a real problem.
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
        setError(
          `${portalLabel(portal)} accounts sign in on the website — this app has no ${portalLabel(portal)} panel yet.`,
        );
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
      subtitle="One sign-in for students, parents, school staff and partners."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      footer={
        <Text style={styles.footerText}>
          Shreyartha employee?{' '}
          <Text style={styles.footerLink} onPress={() => router.replace('/auth/employee-login')}>
            Sign in here
          </Text>
        </Text>
      }
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
        label="Sign in"
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
            label="Send reset link"
            onPress={sendReset}
            loading={forgotBusy}
            palette={PALETTE}
          />
        </View>
      )}

      <View style={styles.register}>
        <Text style={styles.registerTitle}>New here? Register as</Text>
        <View style={styles.registerGrid}>
          {registerOptions.map((opt) => (
            <Pressable
              key={opt.route}
              style={({ pressed }) => [styles.registerCard, pressed && styles.pressed]}
              onPress={() => router.push(`${opt.route}?tab=signup`)}
              accessibilityRole="button"
              accessibilityLabel={`Register as ${opt.label}`}
            >
              {/* LOGIN_GROUPS carries emoji, not Ionicons names — rendering it as a glyph is
                  why this Text has no TYPE token (checkdesign exempts glyphs). */}
              <Text style={styles.registerIcon}>{opt.icon}</Text>
              <Text style={styles.registerLabel} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
  registerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  registerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  registerLabel: {
    fontSize: TYPE.label,
    fontWeight: '600',
    color: SLATE[800],
  },
  registerIcon: { fontSize: 16, lineHeight: 20 },
  pressed: { opacity: 0.75 },
  footerText: {
    fontSize: TYPE.label,
    color: SLATE[500],
    textAlign: 'center',
  },
  footerLink: {
    fontWeight: '700',
    color: PALETTE.link,
  },
});
