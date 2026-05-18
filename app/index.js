import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const WELCOME_BG = require('../assets/images/welcome.png');

const CTA_OPTIONS = [
  { label: 'Login as Student', route: '/auth/student-login', style: 'primary' },
  { label: 'Login as School Staff', route: '/auth/school-login', style: 'secondary' },
  { label: 'Login as Parent', route: '/auth/parent-login', style: 'secondary' },
  { label: 'Login as Admin', route: '/auth/admin-login', style: 'secondary' },
];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ImageBackground source={WELCOME_BG} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome to The 3C Edge</Text>
          <Text style={styles.tagline}>YOUR LEARNING. OUR AI INTELLIGENCE.</Text>

          <View style={styles.actions}>
            {CTA_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                style={({ pressed }) => [
                  styles.button,
                  option.style === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push(option.route)}
              >
                <Text style={option.style === 'primary' ? styles.buttonPrimaryText : styles.buttonSecondaryText}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.guestButton} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.guestText}>Explore Platform</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#020617',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.56)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  tagline: {
    marginTop: 10,
    marginBottom: 34,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: '#b0003a',
    borderColor: '#b0003a',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  buttonSecondaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  guestButton: {
    marginTop: 22,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  guestText: {
    color: 'rgba(255,255,255,0.82)',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
