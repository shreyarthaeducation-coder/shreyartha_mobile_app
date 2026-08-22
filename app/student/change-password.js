import { StudentChangePasswordScreen } from '../../components/student';

/**
 * Change Password — reached from the student header chip.
 *
 * This route was registered in _layout.js and linked from constants/studentMenu.js, but the file
 * did not exist, so the chip navigated nowhere.
 */
export default function StudentChangePassword() {
  return <StudentChangePasswordScreen />;
}
