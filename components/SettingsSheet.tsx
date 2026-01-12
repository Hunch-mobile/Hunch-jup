import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import theme from central location
import { Theme } from '@/constants/theme';

// Use theme constants
const BG_MAIN = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const ERROR = Theme.error;

export default function SettingsSheet({
    visible,
    onClose,
    onSwitchTheme,
    onLogout,
}: {
    visible: boolean;
    onClose: () => void;
    onSwitchTheme: () => void;
    onLogout: () => void;
}) {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 25,
                stiffness: 400,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 300,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            paddingBottom: Math.max(insets.bottom, 20),
                            transform: [{ translateY: slideAnim }],
                        }
                    ]}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Settings</Text>
                        </View>

                        <View style={styles.menuContainer}>
                            {/* Switch Theme Option */}
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    onSwitchTheme();
                                    onClose();
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="moon-outline" size={22} color={TEXT_PRIMARY} />
                                    <Text style={styles.menuItemText}>Switch Theme</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
                            </TouchableOpacity>

                            {/* Logout Option */}
                            <TouchableOpacity
                                style={[styles.menuItem, styles.logoutItem]}
                                onPress={() => {
                                    onLogout();
                                    onClose();
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.menuItemLeft}>
                                    <Ionicons name="log-out-outline" size={22} color={ERROR} />
                                    <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={ERROR} />
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Animated.View>
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
    sheet: {
        backgroundColor: BG_MAIN,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: BORDER,
    },

    header: {
        paddingBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: TEXT_PRIMARY,
    },
    menuContainer: {
        gap: 8,
        paddingBottom: 8,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 4,
        backgroundColor: 'transparent',
    },
    menuItemLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    menuItemText: {
        fontSize: 16,
        fontWeight: "600",
        color: TEXT_PRIMARY,
    },
    logoutItem: {
        // No special background for logout
    },
    logoutText: {
        color: ERROR,
    },
});
