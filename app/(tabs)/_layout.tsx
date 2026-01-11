import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Dimensions, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import theme
import { Theme } from "@/constants/theme";

// Tab configuration
const TAB_CONFIG = [
  { name: "index", title: "Home", icon: "home", iconOutline: "home-outline" },
  { name: "social", title: "Feed", icon: "compass", iconOutline: "compass-outline" },
  { name: "profile", title: "Profile", icon: "person", iconOutline: "person-outline" },
] as const;

const TAB_COUNT = TAB_CONFIG.length;
const NAVBAR_HORIZONTAL_MARGIN = 20;
const NAVBAR_HEIGHT = 64;
const NAVBAR_WIDTH = Dimensions.get('window').width - (NAVBAR_HORIZONTAL_MARGIN * 2);
const TAB_WIDTH = NAVBAR_WIDTH / TAB_COUNT;
const INDICATOR_WIDTH = 56;
const INDICATOR_HEIGHT = 48;
const INDICATOR_VERTICAL_PADDING = (NAVBAR_HEIGHT - INDICATOR_HEIGHT) / 2;

// Clean minimalist tab bar
function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Shared value for smooth indicator animation
  const activeIndex = useSharedValue(state.index);

  // Update activeIndex when tab changes
  useEffect(() => {
    activeIndex.value = withSpring(state.index, {
      damping: 18,
      stiffness: 150,
      mass: 1,
    });
  }, [state.index]);

  // Animated style for sliding indicator position
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const inputRange = state.routes.map((_, i) => i);
    const outputRange = inputRange.map(
      (i) => i * TAB_WIDTH + (TAB_WIDTH - INDICATOR_WIDTH) / 2
    );
    const translateX = interpolate(
      activeIndex.value,
      inputRange,
      outputRange
    );

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={[styles.floatingContainer, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
      {/* Clean white background with subtle shadow */}
      <View style={styles.tabBarContainer}>
        {/* Sliding indicator - minimalist black rounded rectangle */}
        <Animated.View style={[styles.indicatorContainer, animatedIndicatorStyle]}>
          <View style={styles.indicatorBackground} />
        </Animated.View>
      </View>

      {/* Tab buttons - clean icons */}
      <View style={styles.tabsContainer}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tabConfig = TAB_CONFIG.find(t => t.name === route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          if (!tabConfig) return null;

          return (
            <TabButton
              key={route.key}
              focused={isFocused}
              iconName={tabConfig.icon}
              iconOutline={tabConfig.iconOutline}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

// Minimalist tab button
function TabButton({
  focused,
  iconName,
  iconOutline,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  iconName: string;
  iconOutline: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scaleValue = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }],
    };
  });

  const handlePressIn = () => {
    scaleValue.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scaleValue.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      android_ripple={null}
    >
      <Animated.View style={[styles.iconWrapper, animatedStyle]}>
        <Ionicons
          name={focused ? iconName as any : iconOutline as any}
          size={24}
          color={focused ? Theme.textInverse : Theme.textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="social" options={{ title: "Feed" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: NAVBAR_HORIZONTAL_MARGIN,
    right: NAVBAR_HORIZONTAL_MARGIN,
    height: NAVBAR_HEIGHT,
  },
  tabBarContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Theme.bgMain,
    borderRadius: NAVBAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: Theme.border,
    overflow: 'hidden',
    // Clean shadow
    shadowColor: Theme.shadowColor,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  // Indicator styles - minimalist black pill
  indicatorContainer: {
    position: 'absolute',
    top: INDICATOR_VERTICAL_PADDING,
    left: 0,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    zIndex: 0,
  },
  indicatorBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Theme.textPrimary,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
  // Tab container
  tabsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});