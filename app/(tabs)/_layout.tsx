import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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
      {/* Shadow layer */}
      <View style={styles.shadowLayer} />

      {/* Dark frosted glass background like reference */}
      <View style={styles.liquidGlassContainer}>
        {/* True iOS “liquid glass” blur (Android uses fallback) */}
        {Platform.OS === "android" ? (
          <View style={styles.androidGlassFallback} />
        ) : (
          <BlurView
            intensity={32}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Subtle tint to deepen the blur */}
        <View style={styles.glassTint} />

        {/* Subtle top highlight */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.liquidHighlight}
        />

        {/* Outer border */}
        <View style={styles.borderOverlay} />

        {/* Sliding indicator - simple dark pill */}
        <Animated.View style={[styles.indicatorContainer, animatedIndicatorStyle]}>
          {/* Active “liquid” capsule */}
          {Platform.OS === "android" ? (
            <View style={styles.indicatorAndroidBg} />
          ) : (
            <BlurView
              intensity={42}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0.10)",
              "rgba(255, 255, 255, 0.04)",
              "rgba(0, 0, 0, 0.18)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.indicatorBorder} />
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
  const pressYOffset = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: pressYOffset.value }],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(focused ? 1 : 0.5, { damping: 15, stiffness: 200 }),
    };
  }, [focused]);

  const handlePressIn = () => {
    // Avoid scaling font-icons (can look blurry mid-animation)
    pressYOffset.value = withSpring(-1.5, { damping: 18, stiffness: 420 });
  };

  const handlePressOut = () => {
    pressYOffset.value = withSpring(0, { damping: 18, stiffness: 320 });
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
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 18,
  },
  // Liquid glass container
  liquidGlassContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NAVBAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  androidGlassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24, 24, 28, 0.72)",
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12, 12, 14, 0.28)",
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
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NAVBAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
  indicatorAndroidBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_HEIGHT / 2,
    backgroundColor: 'rgba(18, 18, 22, 0.92)',
  },
  indicatorBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
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


