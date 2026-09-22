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
import { lookupInstitutionCode, signupStudent } from '../../services/authService';
import { SLATE, TYPE, leading } from '../../constants/theme';

/**
 * Student sign-up.
 *
 * Sign-up only: students sign in at /auth/sign-in with every other school-bound role. The route
 * keeps its old name so existing links still resolve. Mirrors
 * `frontendmain/src/student/StudentAuth.js`, which is sign-up only for the same reason.
 *
 * ANDROID KEYBOARD: the form stays mounted for the life of the screen and nothing unmounts on
 * focus.
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

  // SIGN-UP ONLY. Students sign in at /auth/sign-in — one gate for every school-bound role, which
  // also owns forgot-password. This screen registers a new student and nothing else; the session
  // writes it used to carry now live in services/portalSession.js.


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
      // Stay here with the server's message; the "Sign in" link below goes to the gate.
      setNotice(res?.message || res?.data?.message || 'Signup successful! You can now sign in.');
      setSignup({ ...EMPTY_SIGNUP });
      setInstitution({ loading: false, name: '', error: '' });
    } catch (e) {
      setSignupError(e?.message || 'Server error. Please try again.');
    } finally {
      setSignupBusy(false);
    }
  };

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
        placeholderTextColor={SLATE[500]}
        autoCapitalize="words"
        editable={!signupBusy}
      />

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        value={signup.email}
        onChangeText={(v) => patch('email', v)}
        placeholder="you@example.com"
        placeholderTextColor={SLATE[500]}
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
        placeholderTextColor={SLATE[500]}
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
        placeholderTextColor={SLATE[500]}
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
          placeholderTextColor={SLATE[500]}
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
              source={require('../../assets/images/The3CEdge.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Shreyartha</Text>
            <Text style={styles.tagline}>Unlock Your Potential</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create your student account</Text>

            {notice ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {renderSignup()}

            <TouchableOpacity
              style={styles.signInRow}
              onPress={() => router.replace('/auth/sign-in')}
              accessibilityRole="button"
            >
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
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
  backText: { color: '#fff', fontWeight: '700', fontSize: TYPE.heading },
  logoContainer: { alignItems: 'center', marginVertical: 28 },
  logo: { width: 190, height: 122, borderRadius: 18 },
  appName: { color: '#fff', fontSize: TYPE.headline, fontWeight: '800', marginTop: 12 },
  tagline: { color: 'rgba(255,255,255,0.6)', fontSize: TYPE.body, marginTop: 2 },
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

  cardTitle: { fontSize: TYPE.title, fontWeight: '800', color: '#1a1a2e', marginBottom: 12 },
  cardSubtitle: { fontSize: TYPE.body, color: '#64748b', marginBottom: 12 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#dc2626', fontSize: TYPE.body, lineHeight: leading(TYPE.body) },
  noticeBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  noticeText: { color: '#15803d', fontSize: TYPE.body, lineHeight: leading(TYPE.body) },

  label: { fontSize: TYPE.body, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: TYPE.heading,
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
  typeText: { fontSize: TYPE.heading, fontWeight: '600', color: '#6b7280' },
  typeTextOn: { color: '#b0003a', fontWeight: '700' },

  hint: { fontSize: TYPE.caption, color: '#9ca3af', marginTop: 6 },
  hintOk: { fontSize: TYPE.caption, color: '#15803d', fontWeight: '600', marginTop: 6 },
  hintBad: { fontSize: TYPE.caption, color: '#dc2626', fontWeight: '600', marginTop: 6 },

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
  termsText: { flex: 1, fontSize: TYPE.label, color: '#4b5563', lineHeight: leading(TYPE.label) },

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
  loginBtnText: { color: '#fff', fontSize: TYPE.heading, fontWeight: '700', letterSpacing: 0.3 },
  signInRow: { marginTop: 16, alignItems: 'center', paddingVertical: 6 },
  signInText: { fontSize: TYPE.body, color: '#64748b' },
  signInLink: { fontWeight: '800', color: '#b0003a' },
});
