import { Tabs } from 'expo-router';
import { ImageBackground, View, Text, StyleSheet } from 'react-native';
import { STUDENT } from '../../constants/theme';

function TabIcon({ emoji, focused }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </View>
  );
}

export default function StudentLayout() {
  return (
    <ImageBackground source={require('../../assets/images/Background.png')} style={styles.background} resizeMode="cover">
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: styles.scene,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: STUDENT.accent,
          tabBarInactiveTintColor: STUDENT.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowLabel: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Support',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🛟" focused={focused} />,
          }}
        />
        <Tabs.Screen name="academic" options={{ href: null }} />
        <Tabs.Screen name="academic-iq" options={{ href: null }} />
        <Tabs.Screen name="psychometric-assessment" options={{ href: null }} />
        <Tabs.Screen name="subject-career" options={{ href: null }} />
        <Tabs.Screen name="skills-edge" options={{ href: null }} />
        <Tabs.Screen name="language-pro" options={{ href: null }} />
        <Tabs.Screen name="resources" options={{ href: null }} />
        <Tabs.Screen name="coding-pro" options={{ href: null }} />
        <Tabs.Screen name="coding-pro-stream" options={{ href: null }} />
        <Tabs.Screen name="coding-pro-projects" options={{ href: null }} />
        <Tabs.Screen name="events" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="speak-to-counsellor" options={{ href: null }} />
      </Tabs>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  scene: {
    backgroundColor: 'transparent',
  },
  tabBar: {
    backgroundColor: 'rgba(15, 23, 41, 0.95)',
    borderTopWidth: 1,
    borderTopColor: STUDENT.tabBarBorder,
    height: 62,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 28,
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
  },
  emoji: {
    fontSize: 18,
  },
});
