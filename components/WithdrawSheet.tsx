import { Theme } from '@/constants/theme';
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from 'expo-blur';
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
      <Pressable className="flex-1 justify-end" onPress={onClose} style={StyleSheet.absoluteFill}>
        <BlurView intensity={25} tint="default" style={StyleSheet.absoluteFill} />
        <View style={styles.backdropTint} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
          style={{ width: "100%" }}
        >
          <Animated.View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: slideAnim }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="items-center py-3" {...panResponder.panHandlers}>
                <View className="w-12 h-1.5 rounded-full bg-[#E5E7EB]" />
              </View>
              {/* Close Button */}
              <TouchableOpacity
                className="absolute right-5 top-4 w-10 h-10 rounded-full bg-[#F5F5F5] justify-center items-center z-10"
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Theme.textPrimary} />
              </TouchableOpacity>

              {/* Header */}
              <View className="pb-6 pt-2">
                <Text className="text-2xl font-bold text-txt-primary mb-1.5">Withdraw</Text>
                <Text className="text-[15px] text-txt-secondary leading-5">Send funds to a public address</Text>
              </View>

              {/* Form */}
              <View className="gap-5 pb-2">
                {/* To Address */}
                <View className="gap-2.5">
                  <Text className="text-[11px] font-semibold text-txt-secondary uppercase tracking-wider">To Address</Text>
                  <View className={`bg-white rounded-2xl border-2 px-4 h-[56px] justify-center ${errors.toAddress ? 'border-[#FF10F0]' : 'border-[#E5E7EB]'}`}>
                    <TextInput
                      value={toAddress}
                      onChangeText={setToAddress}
                      onBlur={() => setTouched(true)}
                      placeholder="Public address"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="text-txt-primary text-[16px]"
                    />
                  </View>
                  {errors.toAddress && <Text className="text-[#FF10F0] text-xs mt-1 font-medium">{errors.toAddress}</Text>}
                </View>

                {/* Amount */}
                <View className="gap-2.5">
                  <Text className="text-[11px] font-semibold text-txt-secondary uppercase tracking-wider">Amount</Text>
                  <View className={`bg-white rounded-2xl border-2 px-4 h-[56px] justify-center ${errors.amount ? 'border-[#FF10F0]' : 'border-[#E5E7EB]'}`}>
                    <Pressable onPress={() => setAmountKeypadOpen(true)}>
                      <Text className="text-txt-primary text-[16px] font-medium">
                        {amount || "0.00"}
                      </Text>
                    </Pressable>
                  </View>
                  {errors.amount && <Text className="text-[#FF10F0] text-xs mt-1 font-medium">{errors.amount}</Text>}
                </View>

                {/* Submit */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canSubmit}
                  onPress={handleSubmit}
                  className="mt-1"
                >
                  {canSubmit ? (
                    <LinearGradient
                      colors={['#000000', '#1F2937']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.ctaGrad}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="arrow-up" size={20} color="#fff" />
                          <Text className="text-white text-[16px] font-bold">Withdraw</Text>
                        </>
                      )}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.ctaGrad, { backgroundColor: '#F5F5F5' }]}>
                      <Ionicons name="arrow-up" size={20} color="#9CA3AF" />
                      <Text className="text-[#9CA3AF] text-[16px] font-semibold">Withdraw</Text>
                    </View>
                  )}
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
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 8,
    overflow: "hidden",
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaGrad: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});