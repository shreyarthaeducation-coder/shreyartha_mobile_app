import F2FScreen from '../../../components/staff/f2f/F2FScreen';

/**
 * Face-to-Face Counselling — the room the counsellor panels' centre + button opens.
 *
 * Imported BY PATH, not through the components/staff barrel: expo-router scans every route file,
 * so a barrel import here is an app-wide import. That is the trap that once boot-crashed the whole
 * app through a top-level react-native-pdf import.
 *
 * The screen returns null for any role without a counsellor portal, which is how the other four
 * panels are unaffected by a route the shared shell registers for all of them.
 */
export default function StaffRoute() {
  return <F2FScreen />;
}
