import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import theme from central location
import { Theme } from '@/constants/theme';

// Use theme constants
const ACCENT = Theme.accentSubtle;
const BG_MAIN = Theme.bgMain;
const BG_SHEET = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BG_ELEVATED = Theme.bgElevated;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;
const ERROR = Theme.error;

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
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      // Reset each time it opens
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

  const canSubmit =
    toAddress.trim().length >= 10 && Number.isFinite(amountValue) && amountValue > 0 && !submitting;

  const handleSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    await onSubmit({ toAddress: toAddress.trim(), amount: amountValue });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
          style={styles.kav}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 20),
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
            >
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
              </TouchableOpacity>

              <View style={styles.header}>
                <Text style={styles.title}>Withdraw</Text>
                <Text style={styles.subtitle}>Send funds to a public address</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>To address</Text>
                  <View style={[styles.inputWrap, errors.toAddress && styles.inputWrapError]}>
                    <TextInput
                      value={toAddress}
                      onChangeText={(t) => setToAddress(t)}
                      onBlur={() => setTouched(true)}
                      placeholder="Public address"
                      placeholderTextColor={TEXT_DISABLED}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </View>
                  {!!errors.toAddress && <Text style={styles.errorText}>{errors.toAddress}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Amount</Text>
                  <View style={[styles.inputWrap, errors.amount && styles.inputWrapError]}>
                    <TextInput
                      value={amount}
                      onChangeText={(t) => setAmount(t.replace(",", "."))}
                      onBlur={() => setTouched(true)}
                      placeholder="0.00"
                      placeholderTextColor={TEXT_DISABLED}
                      keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                      style={styles.input}
                    />
                  </View>
                  {!!errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!canSubmit}
                  onPress={handleSubmit}
                  style={[styles.cta, !canSubmit && styles.ctaDisabled]}
                >
                  <LinearGradient
                    colors={canSubmit ? [ACCENT, "#00B8D4"] : [BG_ELEVATED, BG_ELEVATED]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGrad}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={BG_MAIN} />
                    ) : (
                      <>
                        <Ionicons name="arrow-up" size={18} color={BG_MAIN} />
                        <Text style={styles.ctaText}>Withdraw</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  kav: {
    width: "100%",
  },
  sheet: {
    backgroundColor: BG_MAIN,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    overflow: "hidden",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  header: {
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  form: {
    gap: 16,
    paddingBottom: 8,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_SECONDARY,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputWrap: {
    backgroundColor: BG_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: "center",
  },
  inputWrapError: {
    borderColor: ERROR,
  },
  input: {
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  errorText: {
    color: ERROR,
    fontSize: 12,
    marginTop: 2,
  },
  cta: {
    marginTop: 8,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaGrad: {
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  ctaText: {
    color: BG_MAIN,
    fontSize: 16,
    fontWeight: "800",
  },
});

