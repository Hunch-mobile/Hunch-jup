import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
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
const BG_ELEVATED = Theme.bgElevated;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;
const SUCCESS = Theme.success;
const ERROR = Theme.error;

interface TradeQuoteSheetProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (quote: string) => Promise<void> | void;
    onSkip: () => void;
    submitting?: boolean;
    tradeInfo: {
        side: 'yes' | 'no';
        amount: string;
        marketTitle: string;
    };
}

export default function TradeQuoteSheet({
    visible,
    onClose,
    onSubmit,
    onSkip,
    submitting = false,
    tradeInfo,
}: TradeQuoteSheetProps) {
    const insets = useSafeAreaInsets();
    const [quote, setQuote] = useState("");

    const handleSubmit = async () => {
        if (quote.trim()) {
            await onSubmit(quote.trim());
        }
    };

    const isYes = tradeInfo.side === 'yes';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                    style={styles.kav}
                >
                    <Pressable
                        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Animated Success Icon */}
                        <View style={styles.iconContainer}>
                            <View style={[styles.glowCircle, isYes ? styles.glowYes : styles.glowNo]} />
                            <LinearGradient
                                colors={isYes ? ['#00FF88', '#00CC6E'] : ['#FF3B5C', '#CC2E49']}
                                style={styles.iconCircle}
                            >
                                <Ionicons name="checkmark-sharp" size={40} color="#000" />
                            </LinearGradient>
                        </View>

                        {/* Trade Summary */}
                        <View style={styles.summary}>
                            <Text style={styles.amount}>${tradeInfo.amount}</Text>
                            <View style={styles.sideContainer}>
                                <Text style={styles.onText}>on</Text>
                                <View style={[styles.sideBadge, isYes ? styles.yesBadge : styles.noBadge]}>
                                    <Text style={styles.sideText}>{tradeInfo.side.toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Quote Input */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Share your reasoning... (optional)"
                                placeholderTextColor={TEXT_DISABLED}
                                value={quote}
                                onChangeText={setQuote}
                                multiline
                                maxLength={280}
                                textAlignVertical="top"
                                autoFocus
                            />
                            {quote.length > 0 && (
                                <Text style={styles.charCount}>{quote.length}/280</Text>
                            )}
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.skipButton}
                                onPress={onSkip}
                                disabled={submitting}
                            >
                                <Text style={styles.skipText}>Skip</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.shareButton, !quote.trim() && styles.disabled]}
                                onPress={handleSubmit}
                                disabled={!quote.trim() || submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color={TEXT_PRIMARY} />
                                ) : (
                                    <>
                                        <Ionicons 
                                            name="arrow-forward" 
                                            size={20} 
                                            color={quote.trim() ? TEXT_PRIMARY : TEXT_DISABLED} 
                                        />
                                        <Text style={[styles.shareText, !quote.trim() && styles.disabledText]}>
                                            Post
                                        </Text>
                                    </>
                                )}
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
        backgroundColor: "rgba(0,0,0,0.92)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    kav: {
        width: "100%",
        maxWidth: 440,
    },
    sheet: {
        backgroundColor: BG_SHEET,
        borderRadius: 32,
        paddingHorizontal: 28,
        paddingTop: 40,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    iconContainer: {
        alignItems: "center",
        marginBottom: 32,
        position: "relative",
    },
    glowCircle: {
        position: "absolute",
        width: 100,
        height: 100,
        borderRadius: 50,
        opacity: 0.3,
        ...Platform.select({
            ios: {
                shadowColor: SUCCESS,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 30,
            },
            android: {
                elevation: 20,
            },
        }),
    },
    glowYes: {
        backgroundColor: SUCCESS,
    },
    glowNo: {
        backgroundColor: ERROR,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    summary: {
        alignItems: "center",
        marginBottom: 32,
    },
    amount: {
        fontSize: 48,
        fontWeight: "800",
        color: TEXT_PRIMARY,
        letterSpacing: -1,
        marginBottom: 12,
    },
    sideContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    onText: {
        fontSize: 16,
        color: TEXT_SECONDARY,
        fontWeight: "500",
    },
    sideBadge: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    yesBadge: {
        backgroundColor: "rgba(0, 255, 136, 0.15)",
    },
    noBadge: {
        backgroundColor: "rgba(255, 59, 92, 0.15)",
    },
    sideText: {
        fontSize: 15,
        fontWeight: "700",
        color: TEXT_PRIMARY,
        letterSpacing: 0.5,
    },
    inputContainer: {
        marginBottom: 24,
    },
    input: {
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        padding: 18,
        minHeight: 120,
        color: TEXT_PRIMARY,
        fontSize: 16,
        lineHeight: 24,
    },
    charCount: {
        fontSize: 12,
        color: TEXT_DISABLED,
        textAlign: "right",
        marginTop: 8,
        fontWeight: "500",
    },
    actions: {
        flexDirection: "row",
        gap: 12,
    },
    skipButton: {
        flex: 1,
        height: 56,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    skipText: {
        fontSize: 16,
        fontWeight: "600",
        color: TEXT_SECONDARY,
    },
    shareButton: {
        flex: 1,
        height: 56,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        backgroundColor: TEXT_PRIMARY,
        borderRadius: 16,
    },
    disabled: {
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    shareText: {
        fontSize: 16,
        fontWeight: "700",
        color: BG_MAIN,
    },
    disabledText: {
        color: TEXT_DISABLED,
    },
});
