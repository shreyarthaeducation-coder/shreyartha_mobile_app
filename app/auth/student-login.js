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
import { loginStudent, lookupInstitutionCode, signupStudent } from '../../services/authService';

/**
 * Student login and sign-up.
 *
 * Mirrors `frontendmain/src/student/StudentAuth.js`, which is one page with a Login/Sign Up tab
 * pair — sign-up was missing here entirely, so a new student had no way in from the app.
 *
 * ANDROID KEYBOARD: both forms stay mounted for the life of the screen and nothing unmounts on
 * focus. Switching tab swaps which one renders, but that only happens on an explicit tap, never
 * while a field is focused.
 */

const STUDENT_TYPES = [
  { value: 'SCHOOL', label: 'School' },
  { value: 'COLLEGE', label: 'College' },
];

const EMPTY_SIGNUP = {
  fullName: '',
  email: '',
  mobile: '',
  code: '',
  password: '',
  terms: false,
};

export default function StudentLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();

  const [tab, setTab] = useState('login'); // login | signup

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [studentType, setStudentType] = useState('SCHOOL');
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [notice, setNotice] = useState('');
  // Advisory only — a failed lookup never blocks submit, exactly as on the web.
  const [institution, setInstitution] = useState({ loading: false, name: '', error: '' });

  const isCollege = studentType === 'COLLEGE';
  const institutionLabel = isCollege ? 'College' : 'School';

  const patch = (key, value) => {
    setSignupError('');
    setNotice('');
    setSignup((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogin = async () => {
    const trimEmail = email.trim();
    if (!trimEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await loginStudent(trimEmail, password);
      const token = data.token;
      if (!token) throw new Error('Authentication failed. Please try again.');

      // ── CLEAR WHOEVER WAS HERE BEFORE, FIRST ────────────────────────────────
      // A login used to write its eight keys ON TOP of whatever was already stored. Nothing else
      // clears them: `AuthContext.logout` and `apiService.clearAuthAndRedirect` only run on an
      // explicit log out or a 401, so a session that ended by force-closing the app persisted
      // indefinitely. On a shared device — a staffroom tablet, a family phone — that left the
      // previous person's JWT, name, email, school code and cached photo in storage under the new
      // person's session, and each panel's route guard admits on the PRESENCE of its own token, so
      // `/teacher` would open the previous teacher's panel without asking for a password.
      //
      // Runs AFTER the token is in hand, never before: clearing on submit would log a student out
      // of a working session just because they mistyped their password.
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);

      await AsyncStorage.multiSet([
        ['studentToken', token],
        ['userToken', token],
        ['accessToken', token],
        ['token', token],
        ['studentLoggedIn', 'true'],
        ['studentRole', data.roles?.[0] || 'STUDENT'],
        ['userType', 'student'],
        ['userData', JSON.stringify({ id: data.id, email: data.email, roles: data.roles })],
      ]);

      setUserType('student');
      router.replace('/student/');
    } catch (e) {
      setError(e.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  /** Runs on blur, like the web's `handleSchoolCodeBlur`. "none" means no institution. */
  const checkCode = async () => {
    const code = signup.code.trim();
    if (!code || code.toLowerCase() === 'none') {
      setInstitution({ loading: false, name: '', error: '' });
      return;
    }
    setInstitution({ loading: true, name: '', error: '' });
    const found = await lookupInstitutionCode(code, studentType);
    setInstitution({
      loading: false,
      name: found?.name || '',
      error: found?.name ? '' : `Invalid ${institutionLabel} Code`,
    });
  };

  const changeType = (value) => {
    setStudentType(value);
    // The code belongs to one registry; carrying it across would show the wrong institution.
    setSignup((prev) => ({ ...prev, code: '' }));
    setInstitution({ loading: false, name: '', error: '' });
    setSignupError('');
  };

  const handleSignup = async () => {
    const fullName = signup.fullName.trim();
    const signupEmail = signup.email.trim();
    const mobile = signup.mobile.trim();

    if (!fullName || !signupEmail || !mobile) {
      setSignupError('Please fill in your name, email and mobile number.');
      return;
    }
    // Both rules copied from the web so the two clients reject the same inputs.
    if (!signup.password || signup.password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }
    if (!signup.terms) {
      setSignupError('You must agree to the terms and conditions.');
      return;
    }

    setSignupError('');
    setSignupBusy(true);
    try {
      const res = await signupStudent({
        fullName,
        email: signupEmail,
        mobile,
        studentType,
        code: signup.code,
        password: signup.password,
      });
      // Land on Login with the server's message, as the web does — the account is not signed in.
      setNotice(res?.message || res?.data?.message || 'Signup successful! Please login.');
      setEmail(signupEmail);
      setSignup({ ...EMPTY_SIGNUP });
      setInstitution({ loading: false, name: '', error: '' });
      setTab('login');
    } catch (e) {
      setSignupError(e?.message || 'Server error. Please try again.');
    } finally {
      setSignupBusy(false);
    }
  };

  const renderLogin = () => (
    <>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
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
          // These three matter ONLY once the eye toggle is tapped. While `secureTextEntry` is true
          // Android suppresses autocapitalise and autocorrect on its own; the moment the password is
          // revealed the field becomes ordinary text and RN's default `autoCapitalize="sentences"`
          // takes over, so the next character typed is silently capitalised and the login fails with
          // a password the student can see is right. `components/auth/PasswordField` — which every
          // other login funnels through — has always set all three.
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          editable={!loading}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.forgotLink}
        onPress={() => router.push('/auth/forgot-password?type=student')}
      >
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login</Text>}
      </TouchableOpacity>
    </>
  );

  const renderSignup = () => (
    <>
      {signupError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{signupError}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>I am a</Text>
      <View style={styles.typeRow}>
        {STUDENT_TYPES.map((t) => {
          const on = studentType === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => changeType(t.value)}
              style={[styles.typeBtn, on && styles.typeBtnOn]}
              disabled={signupBusy}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.typeText, on && styles.typeTextOn]}>{t.label} Student</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        value={signup.fullName}
        onChangeText={(v) => patch('fullName', v)}
        placeholder="Your full name"
        placeholderTextColor="#aaa"
        autoCapitalize="words"
        editable={!signupBusy}
      />

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        value={signup.email}
        onChangeText={(v) => patch('email', v)}
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
        onChangeText={(v) => patch('mobile', v)}
        placeholder="10-digit mobile number"
        placeholderTextColor="#aaa"
        keyboardType="phone-pad"
        editable={!signupBusy}
      />

      <Text style={styles.label}>{institutionLabel} Code</Text>
      <TextInput
        style={styles.input}
        value={signup.code}
        // The web forces this field uppercase as you type.
        onChangeText={(v) => patch('code', v.toUpperCase())}
        onBlur={checkCode}
        placeholder={`Enter your ${institutionLabel.toLowerCase()} code, or NONE`}
        placeholderTextColor="#aaa"
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!signupBusy}
      />
      {institution.loading ? (
        <Text style={styles.hint}>Checking code…</Text>
      ) : institution.name ? (
        <Text style={styles.hintOk}>✓ {institution.name}</Text>
      ) : institution.error ? (
        <Text style={styles.hintBad}>{institution.error}</Text>
      ) : (
        <Text style={styles.hint}>
          Not linked to a {institutionLabel.toLowerCase()}? Enter NONE.
        </Text>
      )}

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          value={signup.password}
          onChangeText={(v) => patch('password', v)}
          placeholder="At least 8 characters"
          placeholderTextColor="#aaa"
          secureTextEntry={!showSignupPassword}
          // Same reason as the login field above, and it bites harder here: a capital letter the
          // student never typed gets baked into the account they are creating.
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          editable={!signupBusy}
        />
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowSignupPassword(!showSignupPassword)}
        >
          <Text style={styles.eyeText}>{showSignupPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.termsRow}
        onPress={() => patch('terms', !signup.terms)}
        disabled={signupBusy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: signup.terms }}
      >
        <View style={[styles.checkbox, signup.terms && styles.checkboxOn]}>
          {signup.terms ? <Text style={styles.checkboxTick}>✓</Text> : null}
        </View>
        <Text style={styles.termsText}>I agree to the terms and conditions.</Text>
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
  );

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
            <Text style={styles.tagline}>Unlock Your Potential</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabRow}>
              {[
                { key: 'login', label: 'Login' },
                { key: 'signup', label: 'Sign Up' },
              ].map((t) => {
                const on = tab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => {
                      setTab(t.key);
                      setError('');
                      setSignupError('');
                    }}
                    style={[styles.tab, on && styles.tabOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.cardSubtitle}>
              {tab === 'login'
                ? 'Access your learning dashboard'
                : 'Create your student account'}
            </Text>

            {/* The signup confirmation lands here, on the Login tab, where the student now is. */}
            {notice && tab === 'login' ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {tab === 'login' ? renderLogin() : renderSignup()}
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

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  tabOn: { backgroundColor: '#b0003a' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  tabTextOn: { color: '#fff' },

  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#dc2626', fontSize: 13, lineHeight: 18 },
  noticeBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  noticeText: { color: '#15803d', fontSize: 13, lineHeight: 18 },

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

  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeBtnOn: { backgroundColor: '#fdf2f6', borderColor: '#b0003a' },
  typeText: { fontSize: 13.5, fontWeight: '600', color: '#6b7280' },
  typeTextOn: { color: '#b0003a', fontWeight: '700' },

  hint: { fontSize: 11.5, color: '#9ca3af', marginTop: 6 },
  hintOk: { fontSize: 11.5, color: '#15803d', fontWeight: '600', marginTop: 6 },
  hintBad: { fontSize: 11.5, color: '#dc2626', fontWeight: '600', marginTop: 6 },

  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 20 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#b0003a', borderColor: '#b0003a' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '800' },
  termsText: { flex: 1, fontSize: 12.5, color: '#4b5563', lineHeight: 18 },

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
