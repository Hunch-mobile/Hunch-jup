import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Theme constants (same as WithdrawSheet) ──
const YELLOW = "#e8d723";
const SHEET_BG = "#e8d723";
const SURFACE_BG = "rgba(0,0,0,0.06)";
const SURFACE_BORDER = "rgba(0,0,0,0.14)";
const TEXT_PRIMARY = "#11181C";
const TEXT_DIM = "rgba(0,0,0,0.62)";
const TEXT_MUTED = "rgba(0,0,0,0.45)";

type SendPayload = { toAddress: string; amount: number };

// ─────────────────────────────────────────────────────────
// SendSheet — Single-step (amount only) when recipientAddress
// is provided; otherwise falls back to two-step like WithdrawSheet.
// ─────────────────────────────────────────────────────────
export default function SendSheet({
    visible,
    onClose,
    onSubmit,
    submitting = false,
    balance = 0,
    recipientAddress,
    recipientName,
}: {
    visible: boolean;
    onClose: () => void;
    onSubmit: (payload: SendPayload) => Promise<void> | void;
    submitting?: boolean;
    balance?: number;
    /** Pre-filled recipient wallet address. If set, Step 2 is skipped. */
    recipientAddress?: string;
    /** Display name of the recipient (shown in header) */
    recipientName?: string;
}) {
    const insets = useSafeAreaInsets();
    const screenH = Dimensions.get("window").height;

    const [amount, setAmount] = useState("");

    // ── Animation ──
    const slideAnim = useRef(new Animated.Value(screenH)).current;

    // ── Pan responder for drag-to-close ──
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) slideAnim.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 140) {
                    handleClose();
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

    // ── Lifecycle ──
    useEffect(() => {
        if (visible) {
            setAmount("");
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 28,
                stiffness: 400,
                mass: 0.8,
            }).start();
        } else {
            slideAnim.setValue(screenH);
        }
    }, [visible]);

    const handleClose = useCallback(() => {
        Animated.timing(slideAnim, {
            toValue: screenH,
            duration: 250,
            useNativeDriver: true,
        }).start(() => onClose());
    }, [screenH, onClose]);

    // ── Amount logic ──
    const amountValue = useMemo(() => {
        const v = Number(amount);
        return Number.isFinite(v) ? v : 0;
    }, [amount]);

    const appendDigit = (digit: string) => {
        let next = amount || "";
        if (next === "0" && digit !== ".") next = "";
        if (digit === "." && next.includes(".")) return;
        next = `${next}${digit}`;
        if (next.includes(".")) {
            const [, decimals = ""] = next.split(".");
            if (decimals.length > 6) return;
        }
        setAmount(next);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const backspace = () => {
        if (!amount) return;
        setAmount(amount.length === 1 ? "" : amount.slice(0, -1));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const setPercentage = (pct: number) => {
        const val = balance * pct;
        if (val <= 0) return;
        setAmount(
            val % 1 === 0
                ? val.toString()
                : val
                    .toFixed(6)
                    .replace(/0+$/, "")
                    .replace(/\.$/, "")
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const canSend = amountValue > 0 && amountValue <= balance && !submitting;

    const handleSubmit = async () => {
        if (!canSend) return;
        const toAddress = recipientAddress || "";
        if (!toAddress) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await onSubmit({ toAddress, amount: amountValue });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            paddingTop: Math.max(insets.top - 28, 4),
                            paddingBottom: insets.bottom,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {/* ── Drag handle ── */}
                    <View style={styles.handleArea} {...panResponder.panHandlers}>
                        <View style={styles.dragHandle} />
                    </View>

                    {/* ── Top bar ── */}
                    <View style={styles.topBar}>
                        <View style={{ width: 36 }} />
                        <View style={styles.topBarCenter}>
                            <Text style={styles.topBarTitle}>Send USDC</Text>
                            {recipientName && (
                                <Text style={styles.topBarSub}>to {recipientName}</Text>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.iconBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Amount display ── */}
                    <View style={styles.amountArea}>
                        <Text
                            style={styles.bigAmount}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                        >
                            {amount || "0"}
                        </Text>

                        <View style={styles.dollarRow}>
                            <Text style={styles.dollarText}>${amountValue.toFixed(2)}</Text>
                            <Ionicons
                                name="swap-horizontal"
                                size={14}
                                color={TEXT_DIM}
                                style={{ marginLeft: 6 }}
                            />
                        </View>

                        {/* Balance pill */}
                        <View style={styles.balancePill}>
                            <Ionicons name="wallet-outline" size={14} color={TEXT_DIM} />
                            <Text style={styles.balanceText}>{balance.toFixed(6)} USDC</Text>
                        </View>

                        {/* Insufficient warning */}
                        {amountValue > balance && amount !== "" && (
                            <Text style={styles.warningText}>Insufficient balance</Text>
                        )}
                    </View>

                    {/* ── CTA + Keypad ── */}
                    <View style={styles.keypadSection}>
                        {/* Summary row */}
                        {amountValue > 0 && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Sending</Text>
                                <Text style={styles.summaryValue}>
                                    {amountValue.toFixed(6)} USDC
                                </Text>
                            </View>
                        )}

                        {/* Send Button */}
                        <TouchableOpacity
                            activeOpacity={0.85}
                            disabled={!canSend}
                            onPress={handleSubmit}
                            style={{ marginBottom: 14 }}
                        >
                            <LinearGradient
                                colors={
                                    canSend
                                        ? ["#000000", "#1A1A1A"]
                                        : ["#D1D5DB", "#E5E7EB"]
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.ctaButton}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text
                                        style={[
                                            styles.ctaText,
                                            !canSend && styles.ctaTextDisabled,
                                        ]}
                                    >
                                        {amountValue <= 0
                                            ? "Enter amount"
                                            : amountValue > balance
                                                ? "Insufficient balance"
                                                : `Send to ${recipientName || "User"}`}
                                    </Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Keypad */}
                        <View style={styles.keypadGrid}>
                            {[
                                { special: "MAX", pct: 1, digits: ["1", "2", "3"] },
                                { special: "75%", pct: 0.75, digits: ["4", "5", "6"] },
                                { special: "50%", pct: 0.5, digits: ["7", "8", "9"] },
                                { special: "CLEAR", pct: 0, digits: [".", "0", "⌫"] },
                            ].map((row, ri) => (
                                <View key={ri} style={styles.keyRow}>
                                    <TouchableOpacity
                                        style={styles.specialKey}
                                        onPress={() =>
                                            row.special === "CLEAR"
                                                ? setAmount("")
                                                : setPercentage(row.pct)
                                        }
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.specialKeyText}>{row.special}</Text>
                                    </TouchableOpacity>
                                    {row.digits.map((d) => (
                                        <TouchableOpacity
                                            key={d}
                                            style={styles.numKey}
                                            onPress={() => (d === "⌫" ? backspace() : appendDigit(d))}
                                            activeOpacity={0.6}
                                        >
                                            {d === "⌫" ? (
                                                <Ionicons
                                                    name="backspace-outline"
                                                    size={22}
                                                    color={TEXT_PRIMARY}
                                                />
                                            ) : (
                                                <Text style={styles.numKeyText}>{d}</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

// ── Styles ──
const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    container: {
        height: "82%",
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: "auto",
        overflow: "hidden",
    },
    handleArea: {
        alignItems: "center",
        paddingTop: 2,
        paddingBottom: 2,
    },
    dragHandle: {
        width: 60,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#47430e",
    },

    // ── Top bar ──
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    topBarCenter: {
        alignItems: "center",
    },
    topBarTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: TEXT_PRIMARY,
        letterSpacing: 0.3,
    },
    topBarSub: {
        fontSize: 12,
        color: TEXT_DIM,
        fontWeight: "500",
        marginTop: 1,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.08)",
        justifyContent: "center",
        alignItems: "center",
    },

    // ── Amount area ──
    amountArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 8,
    },
    bigAmount: {
        fontSize: 64,
        fontWeight: "800",
        color: TEXT_PRIMARY,
        letterSpacing: -2,
        lineHeight: 72,
        marginBottom: 6,
        paddingHorizontal: 32,
        textAlign: "center",
    },
    dollarRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    dollarText: {
        fontSize: 15,
        color: TEXT_DIM,
        fontWeight: "500",
    },
    balancePill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: SURFACE_BG,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
    },
    balanceText: {
        fontSize: 14,
        color: TEXT_DIM,
        fontWeight: "600",
    },
    warningText: {
        color: "#FF10F0",
        fontSize: 13,
        fontWeight: "600",
        marginTop: 12,
    },

    // ── Keypad section ──
    keypadSection: {
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    summaryLabel: {
        fontSize: 14,
        color: TEXT_DIM,
        fontWeight: "500",
    },
    summaryValue: {
        fontSize: 14,
        color: TEXT_PRIMARY,
        fontWeight: "700",
    },
    ctaButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    ctaText: {
        fontSize: 17,
        fontWeight: "800",
        color: "#FFFFFF",
        letterSpacing: 0.5,
    },
    ctaTextDisabled: {
        color: "rgba(17,24,28,0.55)",
    },
    keypadGrid: {
        gap: 6,
    },
    keyRow: {
        flexDirection: "row",
        gap: 6,
    },
    numKey: {
        flex: 1,
        height: 54,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    numKeyText: {
        fontSize: 24,
        fontWeight: "600",
        color: TEXT_PRIMARY,
    },
    specialKey: {
        width: 76,
        height: 54,
        borderRadius: 14,
        backgroundColor: SURFACE_BG,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
    },
    specialKeyText: {
        fontSize: 13,
        fontWeight: "700",
        color: TEXT_PRIMARY,
        letterSpacing: 0.5,
    },
});
