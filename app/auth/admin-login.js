import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING } from '../../constants/theme';
import ChatbotWidget from '../components/ChatbotWidget';

const LOGO_URL = 'https://the3cedge.com/images/The3CEdge.png';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!loginData.email || !loginData.password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await AsyncStorage.multiRemove(['studentToken', 'userToken', 'adminToken', 'schoolUserToken', 'parentUserToken']);
      const res = await api.post('/api/admin/auth/login', loginData);
      const responseData = res?.data?.data ?? res?.data ?? res;
      const token = responseData?.token ?? res?.token;
      if (token) {
        await AsyncStorage.setItem('adminToken', token);
        await AsyncStorage.setItem('userType', 'admin');
        setUserType('admin');
      }
      router.replace({
        pathname: '/webpages/dashboard',
        params: {
          url: 'https://the3cedge.com/admin/dashboard',
          tokenKey: 'adminToken',
          title: 'Admin Dashboard',
        },
      });
    } catch (err) {
      setError(err?.message || 'Invalid credentials. Please try again.');
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
          <TouchableOpacity style={styles.backBtnHeader} onPress={() => router.back()}>
            <Text style={styles.backBtnHeaderText}>← Back</Text>
          </TouchableOpacity>
          <Image source={{ uri: LOGO_URL }} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.headerTitle}>🔐 Admin Portal</Text>
          <Text style={styles.headerSubtitle}>Platform administration & management</Text>
        </View>

        <View style={styles.formContainer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter admin email"
            placeholderTextColor="#bbb"
            value={loginData.email}
            onChangeText={(v) => { setError(''); setLoginData({ ...loginData, email: v }); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter password"
              placeholderTextColor="#bbb"
              value={loginData.password}
              onChangeText={(v) => { setError(''); setLoginData({ ...loginData, password: v }); }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
              <Text style={{ fontSize: 20 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Login</Text>}
          </TouchableOpacity>

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
  label: { fontSize: 13, fontWeight: '700', color: COLORS.secondary, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    backgroundColor: COLORS.surface, marginBottom: 4, color: COLORS.text,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn: { marginLeft: 8, padding: 8 },
  primaryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', marginTop: SPACING.lg,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  error: {
    backgroundColor: '#fce4ec', color: COLORS.error, padding: 12,
    borderRadius: 10, marginBottom: 12, textAlign: 'center', fontSize: 13,
  },
});
