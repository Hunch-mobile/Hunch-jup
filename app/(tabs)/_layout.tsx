import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#4ade80", // Green accent
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.4)",
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => (
          <View style={styles.tabBackground} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Markets",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    elevation: 0,
    height: 60,
    backgroundColor: 'transparent',
    paddingBottom: 8,
  },
  tabBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
});
