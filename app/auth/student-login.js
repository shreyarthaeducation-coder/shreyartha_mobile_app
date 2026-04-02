import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING } from '../../constants/theme';

export default function StudentLoginScreen() {
  const router = useRouter();
  const { setUser, setUserType } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    fullName: '', email: '', mobile: '', schoolCode: '', schoolName: '', password: '', terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // School code verification state
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [verifiedSchoolName, setVerifiedSchoolName] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!loginData.email || !loginData.password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await AsyncStorage.multiRemove(['studentToken', 'userToken', 'adminToken', 'schoolUserToken', 'parentUserToken']);
      const res = await api.post('/api/students/auth/login', loginData);
      const token = res?.data?.token ?? res?.token;
      if (token) {
        await AsyncStorage.setItem('studentToken', token);
        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('studentLoggedIn', 'true');
        await AsyncStorage.setItem('userType', 'student');
        setUserType('student');
      }
      router.replace({
        pathname: '/webpages/dashboard',
        params: {
          url: 'https://the3cedge.com/student/platform/dashboard',
          tokenKey: 'studentToken',
          title: 'Student Dashboard',
        },
      });
    } catch (err) {
      setError(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setError('Please enter your email address');
      return;
    }
    setForgotLoading(true);
    setError('');
    try {
      await api.post('/api/students/auth/forgot-password', { email: forgotEmail });
      Alert.alert('Email Sent', 'Password reset instructions have been sent to your email.');
      setForgotMode(false);
      setForgotEmail('');
    } catch (err) {
      setError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const verifySchoolCode = async (code) => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.toLowerCase() === 'none') {
      setVerifiedSchoolName('');
      setCodeError('');
      return;
    }
    setCodeVerifying(true);
    setCodeError('');
    setVerifiedSchoolName('');
    try {
      const res = await api.get(`/api/admin/schools/code/${trimmed}`);
      const name = res?.data?.schoolName ?? res?.schoolName ?? res?.name ?? '';
      setVerifiedSchoolName(name || 'School verified ✓');
    } catch {
      setCodeError('Invalid school code');
    } finally {
      setCodeVerifying(false);
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!signupData.fullName || !signupData.email || !signupData.mobile || !signupData.password) {
      setError('Please fill in all required fields');
      return;
    }
    if (!signupData.terms) {
      setError('Please accept the terms and conditions');
      return;
    }
    if (codeError) {
      setError('Please fix the school code error before submitting');
      return;
    }
    const isNoneCode = signupData.schoolCode.trim().toLowerCase() === 'none';
    if (isNoneCode && !signupData.schoolName.trim()) {
      setError('Please enter your school name');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        fullName: signupData.fullName,
        email: signupData.email,
        mobile: signupData.mobile,
        schoolCode: signupData.schoolCode,
        password: signupData.password,
      };
      if (isNoneCode) {
        payload.schoolName = signupData.schoolName;
      }
      await api.post('/api/students/auth/signup', payload);
      Alert.alert('Success', 'Account created! Please login.');
      setActiveTab('login');
      setLoginData({ email: signupData.email, password: '' });
      setSignupData({ fullName: '', email: '', mobile: '', schoolCode: '', schoolName: '', password: '', terms: false });
      setVerifiedSchoolName('');
      setCodeError('');
    } catch (err) {
      setError(err?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isNoneCode = signupData.schoolCode.trim().toLowerCase() === 'none';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: SPACING.lg, paddingTop: 60 }}>
        <TouchableOpacity onPress={() => { if (forgotMode) { setForgotMode(false); setError(''); } else { router.back(); } }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Image source={{ uri: 'https://the3cedge.com/assets/img/logo.png' }} style={styles.logo} resizeMode="contain" />

        {forgotMode ? (
          <>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>Enter your email to receive reset instructions</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input} placeholder="Enter your email" placeholderTextColor="#aaa"
              value={forgotEmail} onChangeText={(v) => { setError(''); setForgotEmail(v); }}
              keyboardType="email-address" autoCapitalize="none"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Reset Email</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>{activeTab === 'login' ? 'Welcome Back!' : 'Create Account'}</Text>
            <Text style={styles.subtitle}>{activeTab === 'login' ? 'Sign in to access your dashboard' : 'Join The 3C Edge platform'}</Text>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity style={[styles.tab, activeTab === 'login' && styles.tabActive]} onPress={() => { setActiveTab('login'); setError(''); }}>
                <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeTab === 'signup' && styles.tabActive]} onPress={() => { setActiveTab('signup'); setError(''); }}>
                <Text style={[styles.tabText, activeTab === 'signup' && styles.tabTextActive]}>Signup</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {activeTab === 'login' ? (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input} placeholder="Enter your email" placeholderTextColor="#aaa"
                  value={loginData.email} onChangeText={(v) => { setError(''); setLoginData({ ...loginData, email: v }); }}
                  keyboardType="email-address" autoCapitalize="none"
                />
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Enter your password" placeholderTextColor="#aaa"
                    value={loginData.password} onChangeText={(v) => { setError(''); setLoginData({ ...loginData, password: v }); }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                    <Text style={{ fontSize: 20 }}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => { setForgotMode(true); setError(''); setForgotEmail(loginData.email); }}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Login</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput style={styles.input} placeholder="Enter full name" placeholderTextColor="#aaa" value={signupData.fullName} onChangeText={(v) => setSignupData({ ...signupData, fullName: v })} />

                <Text style={styles.label}>Email *</Text>
                <TextInput style={styles.input} placeholder="Enter email" placeholderTextColor="#aaa" value={signupData.email} onChangeText={(v) => setSignupData({ ...signupData, email: v })} keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.label}>Mobile *</Text>
                <TextInput style={styles.input} placeholder="Enter mobile number" placeholderTextColor="#aaa" value={signupData.mobile} onChangeText={(v) => setSignupData({ ...signupData, mobile: v })} keyboardType="phone-pad" />

                <Text style={styles.label}>School Code (optional — enter "none" if not applicable)</Text>
                <TextInput
                  style={[styles.input, codeError ? styles.inputError : null]}
                  placeholder="Enter school code or 'none'"
                  placeholderTextColor="#aaa"
                  value={signupData.schoolCode}
                  onChangeText={(v) => {
                    setSignupData({ ...signupData, schoolCode: v.toUpperCase(), schoolName: '' });
                    setVerifiedSchoolName('');
                    setCodeError('');
                  }}
                  onBlur={() => verifySchoolCode(signupData.schoolCode)}
                  autoCapitalize="characters"
                />
                {codeVerifying && <Text style={styles.codeStatus}>Verifying school code...</Text>}
                {verifiedSchoolName ? <Text style={styles.codeSuccess}>{verifiedSchoolName}</Text> : null}
                {codeError ? <Text style={styles.codeError}>{codeError}</Text> : null}

                {isNoneCode && (
                  <>
                    <Text style={styles.label}>School Name *</Text>
                    <TextInput
                      style={styles.input} placeholder="Enter your school name" placeholderTextColor="#aaa"
                      value={signupData.schoolName} onChangeText={(v) => setSignupData({ ...signupData, schoolName: v })}
                    />
                  </>
                )}

                <Text style={styles.label}>Password *</Text>
                <TextInput style={styles.input} placeholder="Create a password" placeholderTextColor="#aaa" value={signupData.password} onChangeText={(v) => setSignupData({ ...signupData, password: v })} secureTextEntry />

                <TouchableOpacity style={styles.checkboxRow} onPress={() => setSignupData({ ...signupData, terms: !signupData.terms })}>
                  <Text style={{ fontSize: 20 }}>{signupData.terms ? '☑️' : '⬜'}</Text>
                  <Text style={styles.checkboxText}>I accept the Terms & Conditions</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600', marginBottom: SPACING.lg },
  logo: { width: 140, height: 50, alignSelf: 'center', marginBottom: SPACING.md },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.secondary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
  tabs: { flexDirection: 'row', marginBottom: SPACING.lg, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.surface },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.secondary, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: COLORS.surface, marginBottom: 4, color: COLORS.text,
  },
  inputError: { borderColor: COLORS.error },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn: { marginLeft: 8, padding: 8 },
  forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '600', textAlign: 'right', marginTop: 4, marginBottom: 4 },
  primaryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', marginTop: SPACING.md,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  error: { backgroundColor: '#ffe6e6', color: COLORS.error, padding: 12, borderRadius: 8, marginBottom: 12, textAlign: 'center' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  checkboxText: { marginLeft: 8, fontSize: 13, color: COLORS.textSecondary },
  codeStatus: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  codeSuccess: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginBottom: 8 },
  codeError: { fontSize: 12, color: COLORS.error, marginBottom: 8 },
});