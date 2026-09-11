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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { ALL_AUTH_KEYS } from '../../constants/storageKeys';
import { loginPartner, signupPartner } from '../../services/authService';
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
  const { setUserType } = useAuth();
  const [tab, setTab] = useState('login');

  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);

  const patchSignup = (patch) => setSignup((prev) => ({ ...prev, ...patch }));

  const handleLogin = async () => {
    const trimInput = emailOrMobile.trim();
    if (!trimInput || !password) {
      setError('Please enter your email/mobile and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await loginPartner(trimInput, password);
      if (!res.success || !res.data?.token) {
        throw new Error(res.message || 'Login failed. Please try again.');
      }
      const { data } = res;

      // Drop whoever was signed in before writing this session — see app/auth/student-login.js for
      // the full note. After the token is in hand, never before.
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);

      await AsyncStorage.multiSet([
        ['partnerUserToken', data.token],
        ['partnerLoggedIn', 'true'],
        ['partnerUserVerified', data.verified === false ? 'false' : 'true'],
        // `partnerUserType`, matching the web's spelling. It is now also in ALL_AUTH_KEYS — it was
        // not, so one partner's tier used to survive logout into the next partner's session.
        ['partnerUserType', data.partnerType || ''],
        ['partnerUserName', data.fullName || ''],
        ['partnerUserEmail', data.email || ''],
        ['partnerCode', data.partnerCode || ''],
        ['userType', 'partner'],
        ['userData', JSON.stringify(data)],
      ]);

      setUserType('partner');
      router.replace('/dashboard/partner');
    } catch (e) {
      setError(e.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

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
      // NO TOKEN COMES BACK — the account waits for admin verification, and an unverified partner
      // is granted no endpoint at all. Return to the Login tab with the server's message.
      setSignup(EMPTY_SIGNUP);
      setEmailOrMobile(email);
      setTab('login');
      setError('');
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
            <View style={styles.tabRow}>
              {['login', 'signup'].map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setTab(key);
                    setError('');
                    setSignupError('');
                  }}
                  style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                    {key === 'login' ? 'Login' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.cardTitle}>
              {tab === 'login' ? 'Partner Login' : 'Become a Partner'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {tab === 'login'
                ? 'Schools & coaching center partners'
                : 'Your account is activated once an admin verifies it'}
            </Text>

            {/* The signup success notice lands on the LOGIN tab, because signup issues no token. */}
            {tab === 'login' && signupNotice ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{signupNotice}</Text>
              </View>
            ) : null}

            {tab === 'signup' ? (
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
            ) : (
              <>
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Email or Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={emailOrMobile}
                  onChangeText={setEmailOrMobile}
                  placeholder="Enter email or mobile"
                  placeholderTextColor={SLATE[500]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={SLATE[500]}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.forgotLink}
                  onPress={() => router.push('/auth/forgot-password?type=partner')}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Login</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 18,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: { fontSize: TYPE.heading, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#b0003a' },

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
  forgotLink: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 22 },
  forgotText: { fontSize: TYPE.body, color: '#b0003a', fontWeight: '600' },
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
});
