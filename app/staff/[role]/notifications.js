import StaffNotificationsScreen from '../../../components/staff/StaffNotificationsScreen';

/**
 * The staff inbox behind the notification bell.
 *
 * Imported BY PATH, not through the components/staff barrel: expo-router scans every route file,
 * so a barrel import here is an app-wide import — the trap that once boot-crashed the whole app
 * through a top-level react-native-pdf import.
 */
export default function StaffRoute() {
  return <StaffNotificationsScreen />;
}
