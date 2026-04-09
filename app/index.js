import { Redirect } from 'expo-router';

// Root index — redirects to the tab navigator home
export default function RootIndex() {
  return <Redirect href="/(tabs)" />;
}
