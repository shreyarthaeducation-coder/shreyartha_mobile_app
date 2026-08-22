import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Banner, PasswordField, PrimaryButton } from '../auth';
import { SLATE, SPACING } from '../../constants/theme';
import StaffHeader from './StaffHeader';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native change-password form for all school-staff roles — the mobile counterpart of
 * frontendmain/src/common/ChangePassword/ChangePasswordForm.js, same endpoint and payload.
 *
 * Deliberately uses raw `fetch`, not services/apiService: the backend gates
 * POST /api/school/change-password with a role list that omits the SHREYARTHA_* roles
 * (SchoolAccountController), so those roles get a 403 — and apiService treats any non-auth
 * 401/403 as "session dead" and force-logs the user out. Here a 403 just shows an error.
 */

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'https://shreyartha.com'
).replace(/\/+$/, '');

const MIN_PASSWORD_LENGTH = 6;

export default function StaffChangePasswordScreen({ homeRoute }) {
  const styles = useStyles();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setError('');
    setSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all the fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('schoolUserToken');
      const res = await fetch(`${BASE_URL}/api/school/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok || payload?.success === false) {
        setError(payload?.message || 'Failed to change password. Please try again.');
        return;
      }

      setSuccess(payload?.message || 'Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StaffHeader title="Change Password" fallbackRoute={homeRoute} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Banner variant="error" message={error} />
          <Banner variant="success" message={success} />

          <PasswordField
            palette={PALETTE}
            label="Old Password"
            required
            placeholder="Enter your current password"
            value={oldPassword}
            onChangeText={(v) => {
              setError('');
              setOldPassword(v);
            }}
            textContentType="password"
          />
          <PasswordField
            palette={PALETTE}
            label="New Password"
            required
            placeholder="Enter new password (min 8 characters)"
            value={newPassword}
            onChangeText={(v) => {
              setError('');
              setNewPassword(v);
            }}
            textContentType="newPassword"
          />
          <PasswordField
            palette={PALETTE}
            label="Confirm New Password"
            required
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChangeText={(v) => {
              setError('');
              setConfirmPassword(v);
            }}
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <PrimaryButton
            title="Change Password"
            onPress={handleSubmit}
            loading={submitting}
            palette={PALETTE}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: p.headerBg },
  scroll: {
    flexGrow: 1,
    backgroundColor: SLATE[50],
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
}));
