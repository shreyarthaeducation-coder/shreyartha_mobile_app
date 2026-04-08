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
import ChatbotWidget from '../components/ChatbotWidget';

const LOGO_URL = 'https://the3cedge.com/images/The3CEdge.png';

export default function ParentLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [loginData, setLoginData] = useState({ emailOrMobile: '', password: '' });
  const [signupData, setSignupData] = useState({
    fullName: '', email: '', mobile: '', studentMobileOrEmail: '', password: '', terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!loginData.emailOrMobile || !loginData.password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/parent/auth/login', loginData);
      const responseData = res?.data?.data ?? res?.data;
      const token = responseData?.token;
      if (token) {
        await AsyncStorage.setItem('parentUserToken', token);
        await AsyncStorage.setItem('parentLoggedIn', 'true');
        await AsyncStorage.setItem('userType', 'parent');
        setUserType('parent');
      }
      router.replace('/screens/dashboard/ParentDashboard');
    } catch (err) {
      setError(err?.message || 'Invalid credentials. Please try again.');
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
      await api.post('/api/parent/auth/forgot-password', { email: forgotEmail });
      Alert.alert('Email Sent', 'Password reset instructions have been sent to your email.');
      setForgotMode(false);
      setForgotEmail('');
    } catch (err) {
      setError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!signupData.fullName || !signupData.email || !signupData.mobile || !signupData.studentMobileOrEmail || !signupData.password) {
      setError('Please fill in all required fields');
      return;
    }
    if (!signupData.terms) {
      setError('Please accept the terms and conditions');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/parent/auth/signup', {
        fullName: signupData.fullName,
        email: signupData.email,
        mobile: signupData.mobile,
        studentMobileOrEmail: signupData.studentMobileOrEmail,
        password: signupData.password,
      });
      Alert.alert('Success', 'Account created! Please login.');
      setActiveTab('login');
      setSignupData({ fullName: '', email: '', mobile: '', studentMobileOrEmail: '', password: '', terms: false });
    } catch (err) {
      setError(err?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Branded header band */}
        <View style={styles.headerBand}>
          <View style={styles.headerCircle1} />
          <View style={styles.headerCircle2} />
          <TouchableOpacity
            style={styles.backBtnHeader}
            onPress={() => { if (forgotMode) { setForgotMode(false); setError(''); } else { router.back(); } }}
          >
            <Text style={styles.backBtnHeaderText}>← Back</Text>
          </TouchableOpacity>
          <Image source={{ uri: LOGO_URL }} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.headerTitle}>👨‍👩‍👧 Parent Portal</Text>
          <Text style={styles.headerSubtitle}>{forgotMode ? 'Reset your password' : activeTab === 'login' ? 'Monitor your child\'s progress' : 'Create a parent account'}</Text>
        </View>

        <View style={styles.formContainer}>
          {forgotMode ? (
            <>
              <Text style={styles.title}>Forgot Password</Text>
              <Text style={styles.subtitle}>Enter your email to receive reset instructions</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input} placeholder="Enter your email" placeholderTextColor="#bbb"
                value={forgotEmail} onChangeText={(v) => { setError(''); setForgotEmail(v); }}
                keyboardType="email-address" autoCapitalize="none"
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleForgotPassword} disabled={forgotLoading}>
                {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Reset Email</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Tabs */}
              <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, activeTab === 'login' && styles.tabActive]} onPress={() => { setActiveTab('login'); setError(''); }}>
                  <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'signup' && styles.tabActive]} onPress={() => { setActiveTab('signup'); setError(''); }}>
                  <Text style={[styles.tabText, activeTab === 'signup' && styles.tabTextActive]}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {activeTab === 'login' ? (
                <>
                  <Text style={styles.label}>Email / Mobile</Text>
                  <TextInput
                    style={styles.input} placeholder="Enter email or mobile" placeholderTextColor="#bbb"
                    value={loginData.emailOrMobile}
                    onChangeText={(v) => { setError(''); setLoginData({ ...loginData, emailOrMobile: v }); }}
                    autoCapitalize="none"
                  />
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Enter password" placeholderTextColor="#bbb"
                      value={loginData.password}
                      onChangeText={(v) => { setError(''); setLoginData({ ...loginData, password: v }); }}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                      <Text style={{ fontSize: 20 }}>{showPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => { setForgotMode(true); setError(''); }}>
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Login</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput style={styles.input} placeholder="Enter full name" placeholderTextColor="#bbb" value={signupData.fullName} onChangeText={(v) => setSignupData({ ...signupData, fullName: v })} />

                  <Text style={styles.label}>Email *</Text>
                  <TextInput style={styles.input} placeholder="Enter email" placeholderTextColor="#bbb" value={signupData.email} onChangeText={(v) => setSignupData({ ...signupData, email: v })} keyboardType="email-address" autoCapitalize="none" />

                  <Text style={styles.label}>Mobile *</Text>
                  <TextInput style={styles.input} placeholder="Enter mobile number" placeholderTextColor="#bbb" value={signupData.mobile} onChangeText={(v) => setSignupData({ ...signupData, mobile: v })} keyboardType="phone-pad" />

                  <Text style={styles.label}>Child's Mobile or Email *</Text>
                  <TextInput
                    style={styles.input} placeholder="Enter child's mobile or email" placeholderTextColor="#bbb"
                    value={signupData.studentMobileOrEmail}
                    onChangeText={(v) => setSignupData({ ...signupData, studentMobileOrEmail: v })}
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>Password *</Text>
                  <TextInput style={styles.input} placeholder="Create a password" placeholderTextColor="#bbb" value={signupData.password} onChangeText={(v) => setSignupData({ ...signupData, password: v })} secureTextEntry />

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
        </View>
      </ScrollView>
      <ChatbotWidget />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceAlt },
  headerBand: {
    backgroundColor: COLORS.secondary, paddingTop: 50, paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg, alignItems: 'center', overflow: 'hidden',
  },
  headerCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(176,0,58,0.14)', top: -60, right: -40,
  },
  headerCircle2: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(176,0,58,0.08)', bottom: -30, left: -20,
  },
  backBtnHeader: { alignSelf: 'flex-start', marginBottom: SPACING.md },
  backBtnHeaderText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  headerLogo: { width: 120, height: 40, marginBottom: SPACING.md },
  headerTitle: { color: COLORS.white, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  headerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  formContainer: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -16, padding: SPACING.lg, paddingTop: SPACING.xl,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.secondary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
  tabs: {
    flexDirection: 'row', marginBottom: SPACING.lg,
    borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.surface },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 14 },
  tabTextActive: { color: COLORS.white },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.secondary, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    backgroundColor: COLORS.surface, marginBottom: 4, color: COLORS.text,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn: { marginLeft: 8, padding: 8 },
  forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 6, marginBottom: 4 },
  primaryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', marginTop: SPACING.lg,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  error: {
    backgroundColor: '#fce4ec', color: COLORS.error, padding: 12,
    borderRadius: 10, marginBottom: 12, textAlign: 'center', fontSize: 13,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 8 },
  checkboxText: { marginLeft: 8, fontSize: 13, color: COLORS.textSecondary },
});