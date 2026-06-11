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
import { loginPartner } from '../../services/authService';

export default function PartnerLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      await AsyncStorage.multiSet([
        ['partnerUserToken', data.token],
        ['partnerLoggedIn', 'true'],
        ['partnerUserVerified', data.verified === false ? 'false' : 'true'],
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              source={require('../../assets/images/ShreyarthaLogo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Shreyartha</Text>
            <Text style={styles.tagline}>Partner Portal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Partner Login</Text>
            <Text style={styles.cardSubtitle}>Schools & coaching center partners</Text>

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
