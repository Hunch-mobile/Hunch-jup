import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Theme colors
const ACCENT = '#3FE3FF';

// Tab configuration
const TAB_CONFIG = [
  { name: "index", title: "Home", icon: "home", iconOutline: "home-outline" },
  { name: "social", title: "Feed", icon: "compass", iconOutline: "compass-outline" },
  { name: "profile", title: "Profile", icon: "person", iconOutline: "person-outline" },
] as const;

const TAB_COUNT = TAB_CONFIG.length;
const NAVBAR_HORIZONTAL_MARGIN = 60;
const NAVBAR_HEIGHT = 56;
const NAVBAR_WIDTH = Dimensions.get('window').width - (NAVBAR_HORIZONTAL_MARGIN * 2);
const TAB_WIDTH = NAVBAR_WIDTH / TAB_COUNT;
const INDICATOR_WIDTH = 70;
const INDICATOR_HEIGHT = 44;
const INDICATOR_VERTICAL_PADDING = (NAVBAR_HEIGHT - INDICATOR_HEIGHT) / 2;

// Custom floating tab bar with sliding indicator behind icons
function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Shared value for smooth indicator animation
  const activeIndex = useSharedValue(state.index);

  // Update activeIndex when tab changes - moved to useEffect to avoid render warning
  useEffect(() => {
    activeIndex.value = withSpring(state.index, {
      damping: 20,
      stiffness: 180,
      mass: 0.8,
    });
  }, [state.index]);

  // Animated style for sliding indicator position
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      activeIndex.value,
      [0, 1, 2],
      [
        (TAB_WIDTH - INDICATOR_WIDTH) / 2,
        TAB_WIDTH + (TAB_WIDTH - INDICATOR_WIDTH) / 2,
        TAB_WIDTH * 2 + (TAB_WIDTH - INDICATOR_WIDTH) / 2,
      ]
    );

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={[styles.floatingContainer, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
      {/* Shadow layer */}
      <View style={styles.shadowLayer} />

      {/* Dark frosted glass background like reference */}
      <View style={styles.liquidGlassContainer}>
        {/* Base dark frosted gradient */}
        <LinearGradient
          colors={['rgba(45, 45, 50, 0.95)', 'rgba(50, 50, 55, 0.98)', 'rgba(45, 45, 50, 0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.liquidGlassGradient}
        />

        {/* Subtle top highlight */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.liquidHighlight}
        />

        {/* Glass overlay */}
        <View style={styles.glassOverlay} />

        {/* Outer border */}
        <View style={styles.borderOverlay} />

        {/* Sliding indicator - simple dark pill */}
        <Animated.View style={[styles.indicatorContainer, animatedIndicatorStyle]}>
          {/* Dark background */}
          <View style={styles.indicatorDarkBg} />
        </Animated.View>
      </View>

      {/* Tab buttons - rendered OUTSIDE for crisp icons */}
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

// Tab button - icons only, no background (indicator provides background)
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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(focused ? 1 : 0.5, { damping: 15, stiffness: 200 }),
      transform: [
        { scale: withSpring(focused ? 1.05 : 1, { damping: 15, stiffness: 250 }) }
      ],
    };
  }, [focused]);

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
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
        <Animated.View style={animatedIconStyle}>
          <Ionicons
            name={focused ? iconName as any : iconOutline as any}
            size={22}
            color={focused ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)"}
          />
        </Animated.View>
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
  shadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NAVBAR_HEIGHT / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  // Liquid glass container
  liquidGlassContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NAVBAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  liquidGlassGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NAVBAR_HEIGHT / 2,
  },
  liquidHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: NAVBAR_HEIGHT / 2,
    borderTopLeftRadius: NAVBAR_HEIGHT / 2,
    borderTopRightRadius: NAVBAR_HEIGHT / 2,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NAVBAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  // Indicator styles - simple dark pill
  indicatorContainer: {
    position: 'absolute',
    top: INDICATOR_VERTICAL_PADDING,
    left: 0,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    zIndex: 1,
    overflow: 'hidden',
  },
  indicatorDarkBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_HEIGHT / 2,
    backgroundColor: 'rgba(30, 30, 35, 0.95)',
  },
  // Tab container rendered above indicator
  tabsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 2,
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


