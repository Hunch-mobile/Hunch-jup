import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

  useEffect(() => {
    if (!visible) return;
    // Reset each time it opens
    setToAddress("");
    setAmount("");
    setTouched(false);
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
          style={styles.kav}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Subtle dark gradient for depth */}
            <LinearGradient
              colors={["#0B0F16", "#07080B", "#07080B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={["rgba(63,227,255,0.06)", "transparent", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

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
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "flex-end",
  },
  kav: {
    width: "100%",
  },
  sheet: {
    backgroundColor: BG_SHEET,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    overflow: "hidden",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  closeBtn: {
    position: "absolute",
    right: 14,
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  form: {
    gap: 14,
    paddingBottom: 10,
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
    height: 50,
    justifyContent: "center",
  },
  inputWrapError: {
    borderColor: "rgba(248,113,113,0.45)",
  },
  input: {
    color: TEXT_PRIMARY,
    fontSize: 15,
  },
  errorText: {
    color: ERROR,
    fontSize: 12,
    marginTop: -2,
  },
  cta: {
    marginTop: 6,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaGrad: {
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  ctaText: {
    color: BG_MAIN,
    fontSize: 15,
    fontWeight: "800",
  },
});

