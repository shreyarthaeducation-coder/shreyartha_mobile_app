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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { forgotPassword } from '../../services/authService';

const TYPE_LABELS = {
  student: 'Student',
  school: 'School Staff',
  parent: 'Parent',
  partner: 'Partner',
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { type = 'student' } = useLocalSearchParams();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const trimInput = emailOrPhone.trim();
    if (!trimInput) {
      setError('Please enter your email or phone number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await forgotPassword(type, trimInput);
      setSuccess(true);
    } catch (e) {
      setError(e.message || 'Request failed. Please try again.');
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
          </View>

          <View style={styles.card}>
            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>Email Sent!</Text>
                <Text style={styles.successMsg}>
                  If an account exists for that email or phone, a password reset link has been sent.
                  {'\n\n'}Please check your inbox (and spam folder) and follow the instructions to reset your password.
                </Text>
                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={() => router.back()}
                >
                  <Text style={styles.loginBtnText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>Forgot Password</Text>
                <Text style={styles.cardSubtitle}>
                  {TYPE_LABELS[type] || 'User'} account — enter your registered email or phone number and we'll send you a reset link.
                </Text>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Email or Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                  placeholder="Enter email or phone"
                  placeholderTextColor="#aaa"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!loading}
                />

                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Send Reset Link</Text>
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
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 19 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#dc2626', fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    marginBottom: 22,
  },
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
  successContainer: { alignItems: 'center', paddingVertical: 8 },
  successIcon: { fontSize: 52, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e', marginBottom: 12 },
  successMsg: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
});
