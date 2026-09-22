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
import { signupParent } from '../../services/authService';
import { SLATE, TYPE, leading } from '../../constants/theme';

const EMPTY_SIGNUP = {
  fullName: '',
  email: '',
  mobile: '',
  studentMobileOrEmail: '',
  password: '',
  terms: false,
};

export default function ParentLoginScreen() {
  const router = useRouter();

  // login | signup. Mirrors app/auth/student-login.js, which is the shipped precedent for adding a
  // sign-up tab to one of these hand-rolled login screens.
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');

  const patchSignup = (next) => setSignup((prev) => ({ ...prev, ...next }));

  // SIGN-UP ONLY. Parents sign in at /auth/sign-in — one gate for every school-bound
  // role, which also owns forgot-password. The session writes this screen used to carry now live in
  // services/portalSession.js.

  const handleSignup = async () => {
    const fullName = signup.fullName.trim();
    const email = signup.email.trim();
    const mobile = signup.mobile.trim();
    const child = signup.studentMobileOrEmail.trim();

    // The web's own checks, in its order, so the same first message surfaces.
    if (!fullName || !email || !mobile) {
      setSignupError('Please fill in your name, email and mobile number.');
      return;
    }
    if (!child) {
      setSignupError("Please enter your child's mobile number or email.");
      return;
    }
    if (!signup.password || signup.password.length < 8) {
      setSignupError('Password must be at least 8 characters long.');
      return;
    }
    if (!signup.terms) {
      setSignupError('Please accept the terms to continue.');
      return;
    }

    setSignupError('');
    setSignupNotice('');
    setSignupBusy(true);
    try {
      const res = await signupParent({
        fullName,
        email,
        mobile,
        studentMobileOrEmail: child,
        password: signup.password,
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
            <Text style={styles.tagline}>Parent Portal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create a Parent Account</Text>
            <Text style={styles.cardSubtitle}>
              We will link your account to your child once an admin verifies it
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
                  onChangeText={(mobile) => patchSignup({ mobile: mobile.replace(/[^0-9]/g, '') })}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={SLATE[500]}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!signupBusy}
                />

                <Text style={styles.label}>Child&apos;s Mobile or Email</Text>
                <TextInput
                  style={styles.input}
                  value={signup.studentMobileOrEmail}
                  onChangeText={(studentMobileOrEmail) => patchSignup({ studentMobileOrEmail })}
                  placeholder="Your child&apos;s registered mobile or email"
                  placeholderTextColor={SLATE[500]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!signupBusy}
                />
                <Text style={styles.helper}>
                  This helps us link your account to your child&apos;s profile.
                </Text>

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
                    I agree to the Terms of Use and Privacy Policy.
                  </Text>
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
  // The accent matches the screen's existing `loginBtn` (#b0003a) rather than the web's purple:
  // this file already paints a dark #1a1a2e ground with a crimson primary, and changing that
  // wholesale is a design pass, not a sign-up feature.

  noticeBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  noticeText: { color: '#15803d', fontSize: TYPE.body, lineHeight: leading(TYPE.body) },

  helper: { fontSize: TYPE.caption, color: '#64748b', marginTop: 5, lineHeight: leading(TYPE.caption) },

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
