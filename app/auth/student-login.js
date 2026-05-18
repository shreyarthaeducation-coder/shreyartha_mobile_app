// Native student login screen — no WebView.
// Posts directly to the backend auth endpoint, stores the JWT, and navigates to
// the native student panel on success.

import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
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
import { STUDENT } from '../../constants/theme';

const API_BASE_URL = 'https://shreyartha.com';
const LOGIN_ENDPOINT = '/api/auth/login';
const BG = require('../../assets/images/Background.png');

export default function StudentLoginScreen() {
  const router = useRouter();
  const { setUserType, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return '';
  };

  const handleLogin = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}${LOGIN_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const msg = contentType.includes('application/json')
          ? ((await response.json()).message || 'Invalid credentials. Please try again.')
          : 'Invalid credentials. Please try again.';
        setError(msg);
        return;
      }

      // Expected response: { token, accessToken, studentToken, or userToken } plus optional
      // name/fullName/username/email fields. Accept any of the common Spring Boot JWT shapes.
      const data = await response.json();
      const token =
        data.token || data.accessToken || data.studentToken || data.userToken || data.jwtToken;
      if (!token) {
        setError('Login failed: no token received. Please try again.');
        return;
      }

      await AsyncStorage.multiSet([
        ['studentToken', token],
        ['userToken', token],
        ['accessToken', token],
        ['token', token],
        ['studentLoggedIn', 'true'],
        ['userType', 'student'],
      ]);

      const name = data.name || data.fullName || data.username || data.email || '';
      const userEmail = data.email || data.username || email.trim();
      const userData = { name, email: userEmail };
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);

      setUserType('student');
      router.replace('/student/');
    } catch {
      setError('Unable to connect. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
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
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <Text style={styles.title}>Student Login</Text>
              <Text style={styles.subtitle}>Sign in to your Shreyartha account</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={STUDENT.textMuted}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Enter your password"
                    placeholderTextColor={STUDENT.textMuted}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.loginBtn,
                  pressed && styles.loginBtnPressed,
                  loading && styles.loginBtnDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.loginBtnText}>Sign In</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: STUDENT.bg },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 30, 0.55)',
  },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
  },
  backText: { color: STUDENT.textSecondary, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: STUDENT.textSecondary, fontSize: 14, marginBottom: 22 },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  errorText: { color: '#f43f5e', fontSize: 13 },
  fieldWrap: { marginBottom: 16 },
  label: { color: STUDENT.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: STUDENT.bgCardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: STUDENT.border,
    color: '#fff',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeBtn: { position: 'absolute', right: 12 },
  eyeText: { fontSize: 18 },
  loginBtn: {
    backgroundColor: STUDENT.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnPressed: { backgroundColor: '#3730a3' },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
