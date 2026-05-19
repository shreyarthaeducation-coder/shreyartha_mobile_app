import { Tabs } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#eeeeee',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={focused ? '🏠' : '🏡'} label="Home tab" />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: (_) => (
            <TabIcon emoji="🔍" label="Explore tab" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'About Us',
          tabBarIcon: (_) => (
            <TabIcon emoji="⚙️" label="About Us tab" />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji={focused ? '🎧' : '💬'} label="Support tab" />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, label }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }} accessibilityLabel={label}>{emoji}</Text>;
}
