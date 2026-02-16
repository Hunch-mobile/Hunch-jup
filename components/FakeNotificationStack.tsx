import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

const FAKE_NOTIFICATIONS = [
  "vzy just bought YES",
  "alex bought NO on $50",
  "sarah bought YES on Trump",
  "mike bought YES",
  "jordan bought NO",
  "emma bought YES on Bitcoin",
  "dave bought NO",
  "lisa just bought YES",
];

const DISPLAY_DURATION = 1800;
const ANIM_DURATION = 250;
const STACK_OFFSET = 8;
const STACK_SCALE = 0.95;

export default function FakeNotificationStack() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(-1);
  
  const currentSlideAnim = useRef(new Animated.Value(-1)).current;
  const currentOpacityAnim = useRef(new Animated.Value(0)).current;
  const currentScaleAnim = useRef(new Animated.Value(1)).current;
  
  const prevSlideAnim = useRef(new Animated.Value(0)).current;
  const prevOpacityAnim = useRef(new Animated.Value(0)).current;
  const prevScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const triggerHaptic = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const runCycle = () => {
      // Move current to back (scale down, move up slightly, fade a bit)
      Animated.parallel([
        Animated.timing(currentSlideAnim, {
          toValue: 0.15,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(currentScaleAnim, {
          toValue: STACK_SCALE,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(currentOpacityAnim, {
          toValue: 0.5,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        
        // Store the previous notification
        setPrevIndex(currentIndex);
        prevSlideAnim.setValue(0.15);
        prevScaleAnim.setValue(STACK_SCALE);
        prevOpacityAnim.setValue(0.5);
        
        // Update to next notification
        setCurrentIndex((i) => (i + 1) % FAKE_NOTIFICATIONS.length);
        currentSlideAnim.setValue(-1);
        currentOpacityAnim.setValue(0);
        currentScaleAnim.setValue(1);
        triggerHaptic();

        // Animate new notification in while fading out the stacked one
        Animated.parallel([
          // New notification slides in
          Animated.timing(currentSlideAnim, {
            toValue: 0,
            duration: ANIM_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(currentOpacityAnim, {
            toValue: 1,
            duration: ANIM_DURATION,
            useNativeDriver: true,
          }),
          // Old notification fades out behind
          Animated.timing(prevOpacityAnim, {
            toValue: 0,
            duration: ANIM_DURATION * 1.5,
            useNativeDriver: true,
          }),
          Animated.timing(prevSlideAnim, {
            toValue: 0.3,
            duration: ANIM_DURATION * 1.5,
            useNativeDriver: true,
          }),
        ]).start(({ finished: done }) => {
          if (done) {
            timeoutRef.current = setTimeout(runCycle, DISPLAY_DURATION);
          }
        });
      });
    };

    const timeoutRef = { current: null as ReturnType<typeof setTimeout> | null };

    // Initial entrance from top
    triggerHaptic();
    Animated.parallel([
      Animated.timing(currentSlideAnim, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(currentOpacityAnim, {
        toValue: 1,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        timeoutRef.current = setTimeout(runCycle, DISPLAY_DURATION);
      }
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const currentTranslateY = currentSlideAnim.interpolate({
    inputRange: [-1, 0, 0.15, 0.3, 1],
    outputRange: [-60, 0, STACK_OFFSET, STACK_OFFSET * 2, 60],
  });

  const prevTranslateY = prevSlideAnim.interpolate({
    inputRange: [0, 0.15, 0.3, 1],
    outputRange: [0, STACK_OFFSET, STACK_OFFSET * 2, 60],
  });

  const renderNotification = (text: string, isStacked: boolean = false) => {
    if (Platform.OS === "ios") {
      return (
        <BlurView intensity={40} tint="light" style={styles.notification}>
          <View style={styles.glassOverlay}>
            <Text style={styles.notificationText}>{text}</Text>
          </View>
        </BlurView>
      );
    }
    return (
      <View style={[styles.notification, styles.androidFallback]}>
        <Text style={styles.notificationText}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Previous notification (stacked behind) */}
      {prevIndex >= 0 && (
        <Animated.View
          style={[
            styles.notificationWrapper,
            styles.stackedNotification,
            {
              opacity: prevOpacityAnim,
              transform: [
                { translateY: prevTranslateY },
                { scale: prevScaleAnim },
              ],
            },
          ]}
        >
          {renderNotification(FAKE_NOTIFICATIONS[prevIndex], true)}
        </Animated.View>
      )}
      
      {/* Current notification (front) */}
      <Animated.View
        style={[
          styles.notificationWrapper,
          {
            opacity: currentOpacityAnim,
            transform: [
              { translateY: currentTranslateY },
              { scale: currentScaleAnim },
            ],
          },
        ]}
      >
        {renderNotification(FAKE_NOTIFICATIONS[currentIndex])}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 90,
  },
  notificationWrapper: {
    width: 320,
    borderRadius: 20,
    overflow: "hidden",
  },
  stackedNotification: {
    position: "absolute",
    zIndex: -1,
  },
  notification: {
    borderRadius: 20,
    overflow: "hidden",
  },
  glassOverlay: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: "rgba(128, 128, 128, 0.5)",
    borderRadius: 20,
  },
  androidFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: "rgba(128, 128, 128, 0.5)",
  },
  notificationText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
