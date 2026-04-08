// App.js
// The active entry point for this project is expo-router/entry (see "main" in
// package.json). This file is kept as a conventional React Native export for
// tooling compatibility; it is not executed by the Expo runtime when
// expo-router/entry is the main entry.
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Shreyartha Education</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  text: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
});