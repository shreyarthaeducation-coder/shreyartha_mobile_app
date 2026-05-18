import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { api } from '../../services/apiService';
import { COLORS } from '../../constants/theme';

const LOGO_URL = 'https://the3cedge.com/images/The3CEdge.png';
const AUTH_STORAGE_KEYS = ['studentToken', 'userToken', 'token', 'adminToken', 'schoolUserToken'];
const MODES = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  FORGOT: 'forgot',
};

const extractResponseData = (response) =>
  response?.data && typeof response.data === 'object' ? response.data : response || {};

const extractErrorMessage = (err) =>
  err?.response?.data?.message || err?.message || 'Server error. Please try again.';

const extractRoleFromResponse = (response) => {
  const data = extractResponseData(response);
  return (
    data?.role ||
    data?.user?.role ||
    data?.student?.role ||
    data?.userType ||
    data?.type ||
    ''
  );
};

const cacheStudentRole = async (role) => {
  if (!role) return;
  await AsyncStorage.multiSet([
    ['studentRole', String(role)],
    ['cachedStudentRole', String(role)],
  ]);
};

export default function StudentLoginScreen() {
  const router = useRouter();
  const { setUserType, setUser } = useAuth();
  const [mode, setMode] = useState(MODES.LOGIN);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    schoolCode: '',
    schoolName: '',
    password: '',
    termsAccepted: false,
  });
  const [forgotEmail, setForgotEmail] = useState('');
  const [schoolLookup, setSchoolLookup] = useState({ state: 'idle', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearFeedback = () => {
    setError('');
    setSuccess('');
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  const isNoneSchoolCode = (value) => String(value || '').trim().toLowerCase() === 'none';

  const titleMeta = useMemo(() => {
    if (mode === MODES.SIGNUP) {
      return { title: 'Create Account', subtitle: 'Join The 3C Edge platform' };
    }
    if (mode === MODES.FORGOT) {
      return { title: 'Reset Password', subtitle: 'Enter your email to receive a reset link' };
    }
    return { title: 'Welcome Back!', subtitle: 'Sign in to access your dashboard' };
  }, [mode]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    clearFeedback();
    if (nextMode !== MODES.SIGNUP) {
      setSchoolLookup({ state: 'idle', message: '' });
    }
  };

  const handleSchoolLookup = async () => {
    const code = signupData.schoolCode.trim();
    if (!code || isNoneSchoolCode(code)) {
      setSchoolLookup({ state: 'idle', message: '' });
      setSignupData((prev) => ({ ...prev, schoolName: '' }));
      return;
    }

    setSchoolLookup({ state: 'loading', message: 'Checking school code...' });
    try {
      const response = await api.get(`/api/admin/schools/code/${encodeURIComponent(code)}`);
      const data = extractResponseData(response);
      const schoolName = String(
        data?.schoolName || data?.name || data?.school?.name || data?.data?.schoolName || ''
      ).trim();

      if (!schoolName) {
        setSchoolLookup({ state: 'error', message: 'Invalid School Code' });
        setSignupData((prev) => ({ ...prev, schoolName: '' }));
        return;
      }

      setSignupData((prev) => ({ ...prev, schoolName }));
      setSchoolLookup({ state: 'success', message: schoolName });
    } catch {
      setSchoolLookup({ state: 'error', message: 'Invalid School Code' });
      setSignupData((prev) => ({ ...prev, schoolName: '' }));
    }
  };

  const handleLogin = async () => {
    if (!loginData.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!isValidEmail(loginData.email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!loginData.password) {
      setError('Password is required.');
      return;
    }

    clearFeedback();
    setLoading(true);
    try {
      await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);

      const response = await api.post('/api/auth/login', {
        email: loginData.email.trim(),
        password: loginData.password,
      });
      const data = extractResponseData(response);
      const token =
        response?.data?.token ??
        response?.token ??
        data?.token ??
        data?.accessToken ??
        data?.studentToken ??
        data?.userToken ??
        data?.jwtToken;

      if (!token) {
        throw new Error('Server error. Please try again.');
      }

      await AsyncStorage.multiSet([
        ['studentToken', token],
        ['userToken', token],
        ['studentLoggedIn', 'true'],
        ['userType', 'student'],
      ]);

      const studentRole = extractRoleFromResponse(response);
      await cacheStudentRole(studentRole);

      const name = data?.name || data?.fullName || data?.username || data?.email || '';
      const userEmail = data?.email || data?.username || loginData.email.trim();
      const userData = { name, email: userEmail };
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);
      setUserType('student');
      router.replace('/student/');
    } catch (err) {
      const status = err?.status || err?.response?.status || null;
      const message = extractErrorMessage(err);
      if (!status && /network|fetch|timed out/i.test(String(err?.message || ''))) {
        console.warn('Network error — cannot reach backend API', {
          baseMessage: err?.message,
          configuredHint: 'Check API base URL and device/server reachability.',
        });
      }
      console.warn('Student login failed', { status, message, raw: err });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupData.fullName.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (!signupData.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!isValidEmail(signupData.email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!/^\d{10}$/.test(signupData.mobile.trim())) {
      setError('Mobile must be a 10-digit number.');
      return;
    }
    if (!signupData.schoolCode.trim()) {
      setError('School Code is required.');
      return;
    }
    if (!signupData.password) {
      setError('Password is required.');
      return;
    }
    if (signupData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!signupData.termsAccepted) {
      setError('Please acknowledge and agree to the terms and conditions.');
      return;
    }
    if (
      signupData.schoolCode.trim() &&
      !isNoneSchoolCode(signupData.schoolCode) &&
      schoolLookup.state === 'error'
    ) {
      setError('Invalid School Code');
      return;
    }

    clearFeedback();
    setLoading(true);
    try {
      const response = await api.post('/api/auth/signup', {
        fullName: signupData.fullName.trim(),
        email: signupData.email.trim(),
        mobile: signupData.mobile.trim(),
        schoolCode: signupData.schoolCode.trim(),
        schoolName: '',
        password: signupData.password,
      });

      const message =
        response?.data?.message ||
        response?.message ||
        'Signup successful! Please login.';
      setLoginData((prev) => ({ ...prev, email: signupData.email.trim(), password: '' }));
      setSignupData((prev) => ({ ...prev, password: '' }));
      setMode(MODES.LOGIN);
      setSchoolLookup({ state: 'idle', message: '' });
      setError('');
      setSuccess(message);
    } catch (err) {
      const status = err?.status || err?.response?.status || null;
      const message = extractErrorMessage(err);
      console.warn('Student signup failed', { status, message, raw: err });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setError('Email is required.');
      return;
    }
    if (!isValidEmail(forgotEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    clearFeedback();
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: forgotEmail.trim() });
      setForgotEmail('');
      setMode(MODES.LOGIN);
      setError('');
      setSuccess('Password reset link sent to your email.');
    } catch (err) {
      const status = err?.status || err?.response?.status || null;
      const message = extractErrorMessage(err);
      console.warn('Forgot password failed', { status, message, raw: err });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.bg}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/auth/login-select')}>
              <Text style={styles.backText}>← Back to Home</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>{titleMeta.title}</Text>
              <Text style={styles.subtitle}>{titleMeta.subtitle}</Text>

              {mode !== MODES.FORGOT ? (
                <View style={styles.tabs}>
                  <TouchableOpacity
                    style={[styles.tab, mode === MODES.LOGIN ? styles.tabActive : null]}
                    onPress={() => switchMode(MODES.LOGIN)}
                    disabled={loading}
                  >
                    <Text style={[styles.tabText, mode === MODES.LOGIN ? styles.tabTextActive : null]}>
                      Login
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, mode === MODES.SIGNUP ? styles.tabActive : null]}
                    onPress={() => switchMode(MODES.SIGNUP)}
                    disabled={loading}
                  >
                    <Text style={[styles.tabText, mode === MODES.SIGNUP ? styles.tabTextActive : null]}>
                      Signup
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{success}</Text>
                </View>
              ) : null}

              {mode === MODES.LOGIN ? (
                <>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Email <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#9ca3af"
                      value={loginData.email}
                      onChangeText={(t) => {
                        setLoginData((prev) => ({ ...prev, email: t }));
                        clearFeedback();
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Password <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        placeholder="Enter your password"
                        placeholderTextColor="#9ca3af"
                        value={loginData.password}
                        onChangeText={(t) => {
                          setLoginData((prev) => ({ ...prev, password: t }));
                          clearFeedback();
                        }}
                        secureTextEntry={!showLoginPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowLoginPassword((prev) => !prev)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.eyeText}>{showLoginPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && styles.primaryBtnPressed,
                      loading && styles.primaryBtnDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Login</Text>}
                  </Pressable>

                  <TouchableOpacity style={styles.forgotWrap} onPress={() => switchMode(MODES.FORGOT)} disabled={loading}>
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <View style={styles.footerRow}>
                    <Text style={styles.footerLabel}>Don&apos;t have an account?</Text>
                    <TouchableOpacity onPress={() => switchMode(MODES.SIGNUP)} disabled={loading}>
                      <Text style={styles.footerLink}>Sign up</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {mode === MODES.SIGNUP ? (
                <>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Full Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your full name"
                      placeholderTextColor="#9ca3af"
                      value={signupData.fullName}
                      onChangeText={(t) => {
                        setSignupData((prev) => ({ ...prev, fullName: t }));
                        clearFeedback();
                      }}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Email <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#9ca3af"
                      value={signupData.email}
                      onChangeText={(t) => {
                        setSignupData((prev) => ({ ...prev, email: t }));
                        clearFeedback();
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Mobile <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 10-digit mobile number"
                      placeholderTextColor="#9ca3af"
                      value={signupData.mobile}
                      onChangeText={(t) => {
                        setSignupData((prev) => ({ ...prev, mobile: t.replace(/[^\d]/g, '').slice(0, 10) }));
                        clearFeedback();
                      }}
                      keyboardType="number-pad"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      School Code <Text style={styles.helperText}>(type NONE if not available)</Text>{' '}
                      <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter school code"
                      placeholderTextColor="#9ca3af"
                      value={signupData.schoolCode}
                      onChangeText={(t) => {
                        setSignupData((prev) => ({ ...prev, schoolCode: t }));
                        setSchoolLookup({ state: 'idle', message: '' });
                        clearFeedback();
                      }}
                      onBlur={handleSchoolLookup}
                      autoCapitalize="characters"
                      returnKeyType="next"
                    />
                    {schoolLookup.state === 'loading' ? (
                      <Text style={styles.lookupLoading}>Checking school code...</Text>
                    ) : null}
                    {schoolLookup.state === 'success' ? (
                      <Text style={styles.lookupSuccess}>{schoolLookup.message}</Text>
                    ) : null}
                    {schoolLookup.state === 'error' ? (
                      <Text style={styles.lookupError}>Invalid School Code</Text>
                    ) : null}
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Password <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        placeholder="Create a password"
                        placeholderTextColor="#9ca3af"
                        value={signupData.password}
                        onChangeText={(t) => {
                          setSignupData((prev) => ({ ...prev, password: t }));
                          clearFeedback();
                        }}
                        secureTextEntry={!showSignupPassword}
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowSignupPassword((prev) => !prev)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.eyeText}>{showSignupPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.helperText}>Create a password (min 6 characters)</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      setSignupData((prev) => ({ ...prev, termsAccepted: !prev.termsAccepted }));
                      clearFeedback();
                    }}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    <View style={[styles.checkbox, signupData.termsAccepted ? styles.checkboxChecked : null]}>
                      {signupData.termsAccepted ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkboxText}>
                      I acknowledge and agree to the terms and conditions of The 3C Edge platform.
                    </Text>
                  </TouchableOpacity>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && styles.primaryBtnPressed,
                      loading && styles.primaryBtnDisabled,
                    ]}
                    onPress={handleSignup}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Create Account</Text>
                    )}
                  </Pressable>

                  <View style={styles.footerRow}>
                    <Text style={styles.footerLabel}>Already have an account?</Text>
                    <TouchableOpacity onPress={() => switchMode(MODES.LOGIN)} disabled={loading}>
                      <Text style={styles.footerLink}>Login</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {mode === MODES.FORGOT ? (
                <>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>
                      Email <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor="#9ca3af"
                      value={forgotEmail}
                      onChangeText={(t) => {
                        setForgotEmail(t);
                        clearFeedback();
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleForgotPassword}
                    />
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && styles.primaryBtnPressed,
                      loading && styles.primaryBtnDisabled,
                    ]}
                    onPress={handleForgotPassword}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                    )}
                  </Pressable>

                  <TouchableOpacity style={styles.backToLoginBtn} onPress={() => switchMode(MODES.LOGIN)} disabled={loading}>
                    <Text style={styles.footerLink}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0f1f4d' },
  glowOne: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(176,0,58,0.20)',
  },
  glowTwo: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(22, 41, 89, 0.40)',
  },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dbe2ef',
  },
  logo: { width: 128, height: 44, alignSelf: 'center', marginBottom: 12 },
  title: { color: '#10224e', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  subtitle: { color: '#4b5563', fontSize: 14, marginBottom: 18, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c9d3e6',
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: '#10224e', fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: '#ffffff' },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  successBox: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  errorText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  successText: { color: '#166534', fontSize: 13, fontWeight: '600' },
  fieldWrap: { marginBottom: 14 },
  label: { color: '#1f2937', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  required: { color: '#b0003a' },
  helperText: { color: '#6b7280', fontSize: 12, fontWeight: '500' },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    color: '#111827',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeBtn: { position: 'absolute', right: 12, padding: 2 },
  eyeText: { fontSize: 18 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnPressed: { backgroundColor: '#8a002e' },
  primaryBtnDisabled: { opacity: 0.75 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgotWrap: { alignItems: 'flex-end', marginTop: 10, marginBottom: 8 },
  forgotText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  footerRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  footerLabel: { color: '#374151', fontSize: 13 },
  footerLink: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    marginRight: 10,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkboxText: { flex: 1, color: '#374151', fontSize: 12, lineHeight: 18 },
  lookupLoading: { marginTop: 6, color: '#334155', fontSize: 12, fontWeight: '500' },
  lookupSuccess: { marginTop: 6, color: '#166534', fontSize: 12, fontWeight: '600' },
  lookupError: { marginTop: 6, color: '#b91c1c', fontSize: 12, fontWeight: '600' },
  backToLoginBtn: { marginTop: 14, alignSelf: 'center' },
});
