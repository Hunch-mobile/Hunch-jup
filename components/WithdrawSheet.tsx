import { Theme } from '@/constants/theme';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import CustomKeypad from "./CustomKeypad";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type WithdrawPayload = {
  toAddress: string;
  amount: number;
};

export default function WithdrawSheet({
  visible,
  onClose,
  onSubmit,
  submitting = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: WithdrawPayload) => Promise<void> | void;
  submitting?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [amountKeypadOpen, setAmountKeypadOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          slideAnim.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120) {
          onClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 30,
            stiffness: 500,
            mass: 0.8,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setToAddress("");
      setAmount("");
      setTouched(false);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 30,
        stiffness: 500,
        mass: 0.8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const amountValue = useMemo(() => {
    const v = Number(amount);
    return Number.isFinite(v) ? v : NaN;
  }, [amount]);

  const errors = useMemo(() => {
    const e: { toAddress?: string; amount?: string } = {};
    if (touched && toAddress.trim().length < 10) e.toAddress = "Enter a valid address";
    if (touched && (!Number.isFinite(amountValue) || amountValue <= 0)) e.amount = "Enter a valid amount";
    return e;
  }, [touched, toAddress, amountValue]);

  const canSubmit = toAddress.trim().length >= 10 && Number.isFinite(amountValue) && amountValue > 0 && !submitting;

  const handleSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    await onSubmit({ toAddress: toAddress.trim(), amount: amountValue });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
          style={{ width: "100%" }}
        >
          <Animated.View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: slideAnim }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="items-center py-2" {...panResponder.panHandlers}>
                <View className="w-12 h-1.5 rounded-full bg-border" />
              </View>
              {/* Close Button */}
              <TouchableOpacity
                className="absolute right-4 top-3 w-9 h-9 rounded-xl bg-app-card border border-border justify-center items-center z-10"
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Theme.textSecondary} />
              </TouchableOpacity>

              {/* Header */}
              <View className="pb-4">
                <Text className="text-xl font-bold text-txt-primary">Withdraw</Text>
                <Text className="mt-1 text-sm text-txt-secondary">Send funds to a public address</Text>
              </View>

              {/* Form */}
              <View className="gap-4 pb-2">
                {/* To Address */}
                <View className="gap-2">
                  <Text className="text-xs font-bold text-txt-secondary uppercase tracking-wide">To address</Text>
                  <View className={`bg-app-card rounded-[14px] border px-3.5 h-[52px] justify-center ${errors.toAddress ? 'border-status-error' : 'border-border'}`}>
                    <TextInput
                      value={toAddress}
                      onChangeText={setToAddress}
                      onBlur={() => setTouched(true)}
                      placeholder="Public address"
                      placeholderTextColor={Theme.textDisabled}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="text-txt-primary text-base"
                    />
                  </View>
                  {errors.toAddress && <Text className="text-status-error text-xs mt-0.5">{errors.toAddress}</Text>}
                </View>

                {/* Amount */}
                <View className="gap-2">
                  <Text className="text-xs font-bold text-txt-secondary uppercase tracking-wide">Amount</Text>
                  <View className={`bg-app-card rounded-[14px] border px-3.5 h-[52px] justify-center ${errors.amount ? 'border-status-error' : 'border-border'}`}>
                    <Pressable onPress={() => setAmountKeypadOpen(true)}>
                      <Text className="text-txt-primary text-base">
                        {amount || "0.00"}
                      </Text>
                    </Pressable>
                  </View>
                  {errors.amount && <Text className="text-status-error text-xs mt-0.5">{errors.amount}</Text>}
                </View>

                {/* Submit */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!canSubmit}
                  onPress={handleSubmit}
                  className={`mt-2 ${!canSubmit ? 'opacity-60' : ''}`}
                >
                  <LinearGradient
                    colors={canSubmit ? [Theme.accentSubtle, '#00B8D4'] : [Theme.bgElevated, Theme.bgElevated]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGrad}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={Theme.bgMain} />
                    ) : (
                      <>
                        <Ionicons name="arrow-up" size={18} color={Theme.bgMain} />
                        <Text className="text-app-bg text-base font-extrabold">Withdraw</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
      <CustomKeypad
        visible={amountKeypadOpen}
        value={amount}
        onChange={(next) => setAmount(next.replace(",", "."))}
        onClose={() => setAmountKeypadOpen(false)}
      />
    </Modal>
  );
}

// Minimal styles for sheet and gradient
const styles = StyleSheet.create({
  sheet: {
    backgroundColor: Theme.bgMain,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    overflow: "hidden",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Theme.border,
  },
  ctaGrad: {
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
});
