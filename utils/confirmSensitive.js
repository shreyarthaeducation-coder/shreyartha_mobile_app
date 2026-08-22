import { Alert } from 'react-native';

/**
 * A two-step confirmation before personal or financial details are put on screen.
 *
 * Covers the HR surfaces: salary breakup, EPF/ESI/PT/TDS, UAN and PF account numbers, bank
 * account and IFSC, Aadhaar and PAN, tax declarations, and — for approvers — other employees'
 * salary structures.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────────────────────────
 * This is a deliberate speed bump, not an access control. Anyone holding the unlocked phone can
 * tap "Show" and see everything; it proves nothing about who is looking. The real control is the
 * server's @PreAuthorize on /api/staff/hr, which is unchanged.
 *
 * What it does buy is the realistic classroom threat: a teacher hands their phone to a student or
 * a colleague, or opens Payroll with someone reading over their shoulder, and a salary slip is
 * simply there. With this, the sensitive fields start masked and a person has to deliberately ask
 * for them.
 *
 * If a genuine control is wanted later, the seam is here: swap the Alert for a password re-entry
 * sheet (POST the password to a new /api/staff/hr/verify-identity) or a device biometric via
 * expo-local-authentication. Every call site already awaits a boolean, so neither change touches
 * the screens.
 *
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {string} [options.confirmLabel]
 * @returns {Promise<boolean>} true when the user chose to reveal
 */
export default function confirmSensitive({
  title = 'Show personal information?',
  message =
    'This screen contains your personal and financial details, including salary and statutory '
    + 'information. Make sure nobody else can see your screen.',
  confirmLabel = 'Show',
} = {}) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      // `onDismiss` does not fire on Android for a tap outside, so the cancel button carries the
      // resolve. A promise that never settles would leave the caller's "revealing" flag stuck on.
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/**
 * Preset for an approver looking at somebody else's pay — worth naming the other person's data
 * explicitly, because the consequence of leaving it on screen is not the viewer's own privacy.
 */
export function confirmOthersPay() {
  return confirmSensitive({
    title: 'Show employee salary details?',
    message:
      'This shows other employees\' salary structures and statutory deductions. Only continue if '
      + 'nobody else can see your screen.',
  });
}

/** Preset for exporting a payslip out of the app, where the file outlives the screen. */
export function confirmPayslipExport() {
  return confirmSensitive({
    title: 'Download payslip?',
    message:
      'The payslip PDF contains your salary breakup, bank account and statutory details. It will '
      + 'be saved to this device and can be shared from there.',
    confirmLabel: 'Download',
  });
}
