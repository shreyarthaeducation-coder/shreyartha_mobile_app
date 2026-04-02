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
      <ScrollView style={styles.container} contentContainerStyle={{ padding: SPACING.lg, paddingTop: 60 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Image source={{ uri: 'https://the3cedge.com/assets/img/logo.png' }} style={styles.logo} resizeMode="contain" />

        <Text style={styles.title}>Admin Login</Text>
        <Text style={styles.subtitle}>Sign in to access the admin dashboard</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter admin email"
          placeholderTextColor="#aaa"
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
            placeholderTextColor="#aaa"
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
  label: { fontSize: 14, fontWeight: '600', color: COLORS.secondary, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: COLORS.surface, marginBottom: 4, color: COLORS.text,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eyeBtn: { marginLeft: 8, padding: 8 },
  primaryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', marginTop: SPACING.lg,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  error: { backgroundColor: '#ffe6e6', color: COLORS.error, padding: 12, borderRadius: 8, marginBottom: 12, textAlign: 'center' },
});
