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
import { loginParent, signupParent } from '../../services/authService';

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
  const { setUserType } = useAuth();
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // login | signup. Mirrors app/auth/student-login.js, which is the shipped precedent for adding a
  // sign-up tab to one of these hand-rolled login screens.
  const [tab, setTab] = useState('login');
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');

  const patchSignup = (next) => setSignup((prev) => ({ ...prev, ...next }));

  const handleLogin = async () => {
    const trimInput = emailOrMobile.trim();
    if (!trimInput || !password) {
      setError('Please enter your email/mobile and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await loginParent(trimInput, password);
      if (!res.success || !res.data?.token) {
        throw new Error(res.message || 'Login failed. Please try again.');
      }
      const { data } = res;

      // Drop whoever was signed in before writing this session. Nothing else does: logout and the
      // 401 handler are the only two clears, so a session ended by force-closing the app used to
      // survive under the next person's login — and every panel's guard admits on the mere presence
      // of its own token. See app/auth/student-login.js for the full note. After the token is in
      // hand, never before, so a mistyped password cannot end a working session.
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);

      await AsyncStorage.multiSet([
        ['parentUserToken', data.token],
        ['parentLoggedIn', 'true'],
        // FAIL CLOSED. This read `data.verified === false ? 'false' : 'true'`, so anything that was
        // not literally `false` — null, undefined, a missing field — stored the parent as VERIFIED.
        // `services/schoolSession.js` carries a note about that exact expression: the school login
        // had it, and it let an unverified teacher past the pending-verification gate. It is correct
        // today only because `ParentUser.verified` is `@Column(nullable = false)` with a Java-side
        // default, so `ParentUserResponse.verified` is always a real boolean — a property of the
        // schema, not of this line. `=== true` does not depend on that.
        ['parentUserVerified', data.verified === true ? 'true' : 'false'],
        ['parentUserName', data.fullName || ''],
        // THE ONLY SOURCE OF THE PARENT'S EMAIL ANYWHERE. There is no `GET /api/parent/me` — the
        // account controller serves exactly one endpoint, change-password — so `ParentUserResponse`
        // from this login is the sole place `email` is ever returned. Not storing it here means the
        // dashboard's "Email ID" row can never be filled at all.
        //
        // `ParentFeatureScreen` has read this key since the WebView port and it has always resolved
        // to '' because nothing wrote it. It is in ALL_AUTH_KEYS, so it dies with the session.
        ['parentUserEmail', data.email || ''],
        ['linkedStudentName', data.studentName || ''],
        ['linkedStudentEmail', data.studentEmail || ''],
        ['userType', 'parent'],
        ['userData', JSON.stringify(data)],
      ]);

      setUserType('parent');
      router.replace('/parent');
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
      // NO TOKEN COMES BACK — the account waits for admin verification. So return the user to the
      // Login tab with the server's message rather than trying to enter the panel.
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
              source={require('../../assets/images/AppLogo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Shreyartha</Text>
            <Text style={styles.tagline}>Parent Portal</Text>
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
              {tab === 'login' ? 'Parent Login' : 'Create a Parent Account'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {tab === 'login'
                ? "Monitor your child's progress"
                : 'We will link your account to your child once an admin verifies it'}
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
                  placeholderTextColor="#aaa"
                  editable={!signupBusy}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={signup.email}
                  onChangeText={(email) => patchSignup({ email })}
                  placeholder="you@example.com"
                  placeholderTextColor="#aaa"
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
                  placeholderTextColor="#aaa"
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
                  placeholderTextColor="#aaa"
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
                  placeholderTextColor="#aaa"
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
              placeholderTextColor="#aaa"
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
                placeholderTextColor="#aaa"
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
              onPress={() => router.push('/auth/forgot-password?type=parent')}
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
  backText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoContainer: { alignItems: 'center', marginVertical: 28 },
  logo: { width: 90, height: 90, borderRadius: 18 },
  appName: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  tagline: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
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
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  // ── Sign-up tab ──────────────────────────────────────────────────────────
  // The accent matches the screen's existing `loginBtn` (#b0003a) rather than the web's purple:
  // this file already paints a dark #1a1a2e ground with a crimson primary, and changing that
  // wholesale is a design pass, not a sign-up feature.
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
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#b0003a' },

  noticeBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  noticeText: { color: '#15803d', fontSize: 13, lineHeight: 18 },

  helper: { fontSize: 11.5, color: '#64748b', marginTop: 5, lineHeight: 16 },

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
  termsText: { flex: 1, fontSize: 12.5, color: '#475569', lineHeight: 18 },

  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#dc2626', fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
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
  forgotText: { fontSize: 13, color: '#b0003a', fontWeight: '600' },
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
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
