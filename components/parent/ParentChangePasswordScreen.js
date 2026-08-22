import { useState } from 'react';
import { View } from 'react-native';
import { Banner, PasswordField, PrimaryButton } from '../auth';
import { SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, ScreenScaffold } from '../ui';
import { parentApi } from '../../services/parentApi';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Change password for a parent — the counterpart of
 * frontendmain/src/Parent/platform/pages/ParentChangePassword.js.
 *
 * ONE ENDPOINT, NOT THREE. The web passes a candidate list and walks it on 404/405:
 *   /api/parent/change-password, /api/parents/change-password, /api/parent/auth/change-password
 * Only the first exists (`ParentAccountController` = `/api/parent` + `POST /change-password`); the
 * other two are guesses that never fire. Copying the fallback chain would just add two doomed
 * requests to every wrong-password attempt.
 *
 * This is also the ONLY parent endpoint an unverified account can reach — its @PreAuthorize spells
 * out `hasRole('PARENT') or hasRole('UNVERIFIED_PARENT')`, because the two roles are unrelated in
 * the role hierarchy. That is why the pending-verification screen links here.
 */

const MIN_PASSWORD_LENGTH = 6;

export default function ParentChangePasswordScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setError('');
    setSuccess('');

    // The shared web form's checks, in its order, so the same first message surfaces.
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
      const res = await parentApi.post('/api/parent/change-password', {
        oldPassword,
        newPassword,
      });
      // This controller answers 200 with `{success:false, message}` for a wrong old password, so
      // an OK status is not on its own a success.
      if (res?.success === false) {
        setError(res.message || 'Could not change your password.');
        return;
      }
      setSuccess(res?.message || 'Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(e?.message || 'Could not change your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenScaffold title="Change Password" fallbackRoute="/parent">
      <Card>
        <Banner variant="error" message={error} />
        <Banner variant="success" message={success} />

        <PasswordField
          label="Old Password"
          value={oldPassword}
          onChangeText={setOldPassword}
          placeholder="Your current password"
          palette={palette}
        />
        <PasswordField
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="At least 8 characters"
          palette={palette}
        />
        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repeat the new password"
          palette={palette}
        />

        <View style={styles.action}>
          <PrimaryButton
            title="Change Password"
            onPress={submit}
            loading={submitting}
            palette={palette}
          />
        </View>
      </Card>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  action: { marginTop: SPACING.sm },
}));
