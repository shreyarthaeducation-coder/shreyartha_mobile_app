import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Root index — redirects to the tab navigator home
export default function RootIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)');
  }, []);
  return null;
}
