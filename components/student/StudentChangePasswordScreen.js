import { useState } from 'react';
import { View } from 'react-native';
import { Banner, PasswordField, PrimaryButton } from '../auth';
import { SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import StudentScaffold from './StudentScaffold';
import { StudentCard } from './StudentCard';
import { studentApi } from '../../services/studentApi';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native change-password form for the student panel — the counterpart of
 * frontendmain/src/student/platform/ChangePassword.js, which renders the shared
 * common/ChangePassword/ChangePasswordForm against `/api/students/change-password`.
 *
 * THIS SCREEN WAS MISSING. `constants/studentMenu.js` has pointed a header chip at
 * `/student/change-password` and `app/student/_layout.js` has registered the route, but no file
 * existed — so the chip navigated nowhere at all.
 *
 * Unlike the staff equivalent, this can use `studentApi` rather than raw `fetch`: that client
 * already treats 403 as an ordinary renderable error instead of a dead session, and the endpoint
 * is guarded for all five student roles anyway.
 */

const MIN_PASSWORD_LENGTH = 6;

export default function StudentChangePasswordScreen() {
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

    // The web's three checks, in its order, so the same first message surfaces.
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
      const res = await studentApi.post('/api/students/change-password', {
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
    <StudentScaffold title="Change Password">
      <StudentCard>
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
      </StudentCard>
    </StudentScaffold>
  );
}

const useStyles = makeStyles(() => ({
  action: { marginTop: SPACING.sm },
}));
