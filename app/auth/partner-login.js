import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signupPartner } from '../../services/authService';
import { PORTALS, SLATE, TYPE, leading } from '../../constants/theme';
import { PaletteProvider } from '../../components/ui/PaletteContext';
import PartnerTermsSheet from '../../components/partner/PartnerTermsSheet';

/**
 * Partner login + sign-up.
 *
 * The mobile login had no sign-up although `POST /api/partner/auth/signup` and the web's
 * PartnerAuth.js both do — the same gap the parent login had before P3. This follows that fix:
 * a tab row bolted onto the screen's own hand-rolled markup rather than a rewrite onto
 * components/auth, because a login screen is the riskiest surface in this app (see the Android
 * keyboard-dismiss saga) and this one is shipped, device-tested code.
 *
 * ── `termsAccepted` IS SENT, AND THAT IS NOT TRUE OF THE PARENT ──────────────
 * The parent's identical-looking checkbox is client-side only; `ParentSignupRequest` has no such
 * field. `PartnerSignupRequest` HAS one and `PartnerAuthService` throws when it is missing or
 * false. The full T&C is reachable from the checkbox row, which is also what the web does.
 */

const EMPTY_SIGNUP = { fullName: '', email: '', mobile: '', password: '', terms: false };

export default function PartnerLoginScreen() {
  const router = useRouter();


  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);

  const patchSignup = (patch) => setSignup((prev) => ({ ...prev, ...patch }));

  // SIGN-UP ONLY. Partners sign in at /auth/sign-in — one gate for every school-bound
  // role, which also owns forgot-password. The session writes this screen used to carry now live in
  // services/portalSession.js.

  const handleSignup = async () => {
    const fullName = signup.fullName.trim();
    const email = signup.email.trim();
    const mobile = signup.mobile.trim();

    if (!fullName) {
      setSignupError('Please enter your full name.');
      return;
    }
    if (!email) {
      setSignupError('Please enter your email address.');
      return;
    }
    if (!mobile) {
      setSignupError('Please enter your mobile number.');
      return;
    }
    if (!signup.password || signup.password.length < 8) {
      setSignupError('Password must be at least 8 characters long.');
      return;
    }
    if (!signup.terms) {
      setSignupError('Please accept the Partner Program Terms & Conditions to continue.');
      return;
    }

    setSignupError('');
    setSignupNotice('');
    setSignupBusy(true);
    try {
      const res = await signupPartner({
        fullName,
        email,
        mobile,
        password: signup.password,
        termsAccepted: true,
      });
      // NO TOKEN COMES BACK — the account waits for admin verification. The message stays on
      // screen beside the "Sign in" link, for once it has been approved.
      setSignup(EMPTY_SIGNUP);
      setSignupNotice(
        res?.message || 'Signup successful! Your account will be verified soon.',
      );
    } catch (e) {
      setSignupError(e?.message || 'Server error. Please try again.');
    } finally {
      setSignupBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/The3CEdge.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Shreyartha</Text>
            <Text style={styles.tagline}>Partner Portal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Become a Partner</Text>
            <Text style={styles.cardSubtitle}>
              Your account is activated once an admin verifies it
            </Text>

            {signupNotice ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{signupNotice}</Text>
              </View>
            ) : null}

            {(
              <>
                {signupError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{signupError}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={signup.fullName}
                  onChangeText={(fullName) => patchSignup({ fullName })}
                  placeholder="Your full name"
                  placeholderTextColor={SLATE[500]}
                  editable={!signupBusy}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={signup.email}
                  onChangeText={(email) => patchSignup({ email })}
                  placeholder="you@example.com"
                  placeholderTextColor={SLATE[500]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!signupBusy}
                />

                <Text style={styles.label}>Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={signup.mobile}
                  onChangeText={(mobile) => patchSignup({ mobile })}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={SLATE[500]}
                  keyboardType="phone-pad"
                  editable={!signupBusy}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={signup.password}
                  onChangeText={(password) => patchSignup({ password })}
                  placeholder="At least 8 characters"
                  placeholderTextColor={SLATE[500]}
                  secureTextEntry
                  editable={!signupBusy}
                />

                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => patchSignup({ terms: !signup.terms })}
                  disabled={signupBusy}
                >
                  <View style={[styles.checkbox, signup.terms && styles.checkboxOn]}>
                    {signup.terms ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <Text style={styles.termsText}>
                    I have read and agree to the Partner Program Terms &amp; Conditions.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.termsLink}
                  onPress={() => setTermsOpen(true)}
                  disabled={signupBusy}
                >
                  <Text style={styles.termsLinkText}>Read the Terms &amp; Conditions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginBtn, signupBusy && styles.loginBtnDisabled]}
                  onPress={handleSignup}
                  disabled={signupBusy}
                >
                  {signupBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.signInRow}
              onPress={() => router.replace('/auth/sign-in')}
              accessibilityRole="button"
            >
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* The T&C sheet is partner-branded, so it carries the portal palette explicitly: this screen
          sits outside app/partner/_layout.js, and usePalette() would otherwise fall back to the
          school teal. */}
      <PaletteProvider palette={PORTALS.parent}>
        <PartnerTermsSheet visible={termsOpen} onClose={() => setTermsOpen(false)} />
      </PaletteProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  backText: { color: '#fff', fontWeight: '700', fontSize: TYPE.heading },
  logoContainer: { alignItems: 'center', marginVertical: 28 },
  logo: { width: 190, height: 122, borderRadius: 18 },
  appName: { color: '#fff', fontSize: TYPE.headline, fontWeight: '800', marginTop: 12 },
  tagline: { color: 'rgba(255,255,255,0.6)', fontSize: TYPE.body, marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  cardTitle: { fontSize: TYPE.headline, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  cardSubtitle: { fontSize: TYPE.body, color: '#64748b', marginBottom: 20 },

  // ── Sign-up tab ──────────────────────────────────────────────────────────
  // The accent matches this screen's existing `loginBtn` (#b0003a) rather than the portal purple:
  // the ground is already dark #1a1a2e with a crimson primary, and restyling that wholesale is a
  // design pass, not a sign-up feature. Same call the parent sign-up made.

  noticeBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  noticeText: { color: '#15803d', fontSize: TYPE.body, lineHeight: leading(TYPE.body) },

  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#b0003a', borderColor: '#b0003a' },
  checkboxTick: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  termsText: { flex: 1, fontSize: TYPE.label, color: '#475569', lineHeight: leading(TYPE.label) },
  termsLink: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 10 },
  termsLinkText: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: '#b0003a',
    textDecorationLine: 'underline',
  },

  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#dc2626', fontSize: TYPE.body, lineHeight: leading(TYPE.body) },
  label: { fontSize: TYPE.body, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: TYPE.heading,
    color: '#111827',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordInput: { flex: 1 },
  eyeBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { fontSize: 18 },
  loginBtn: {
    backgroundColor: '#b0003a',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#b0003a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: TYPE.heading, fontWeight: '700', letterSpacing: 0.3 },
  signInRow: { marginTop: 16, alignItems: 'center', paddingVertical: 6 },
  signInText: { fontSize: TYPE.body, color: '#64748b' },
  signInLink: { fontWeight: '800', color: '#b0003a' },
});
