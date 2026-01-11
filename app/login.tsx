import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Import theme from central location
import { Theme } from '@/constants/theme';

// Theme constants
const ACCENT = Theme.accent;
const BG_MAIN = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BG_ELEVATED = Theme.bgElevated;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;

interface OrbitProps {
    size: number;
    duration: number;
    delay: number;
    color: string;
    offsetX: number;
    offsetY: number;
}

const Orbit = ({ size, duration, delay, color, offsetX, offsetY }: OrbitProps) => {
    const rotation = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.timing(rotation, {
                toValue: 1,
                duration,
                delay,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const rotateInterpolate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View
            style={[
                styles.orbit,
                {
                    width: size,
                    height: size,
                    borderColor: color,
                    left: SCREEN_WIDTH / 2 - size / 2 + offsetX,
                    top: SCREEN_HEIGHT / 2 - size / 2 + offsetY,
                    transform: [{ rotate: rotateInterpolate }],
                },
            ]}
        >
            <View style={[styles.orbitDot, { backgroundColor: color }]} />
        </Animated.View>
    );
};

export default function LoginScreen() {
    const { user, isReady } = usePrivy();
    const { setBackendUser, backendUser } = useUser();
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState("");
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const oauth = useLoginWithOAuth({
        onError: (err) => {
            console.log(err);
            setLoadingProvider(null);
            if (err.message && !err.message.includes("cancelled")) {
                setError(err.message);
            }
        },
        onSuccess: () => {
            setLoadingProvider(null);
            setShowModal(false);
        },
    });

    // Sync user with backend after Privy authentication and redirect only after successful sync
    useEffect(() => {
        const syncUser = async () => {
            if (isReady && user && !backendUser && !isSyncing) {
                setIsSyncing(true);
                try {
                    const walletAccount = user.linked_accounts?.find(
                        (a: any) => a.type === 'wallet' || a.type === 'embedded_wallet'
                    );
                    const walletAddress = (walletAccount as any)?.address;

                    const emailAccount = user.linked_accounts?.find(
                        (a: any) => a.type === 'email' || a.type === 'google_oauth' || a.type === 'twitter_oauth'
                    );
                    const displayName = (emailAccount as any)?.email?.split('@')[0] ||
                        (emailAccount as any)?.name ||
                        (emailAccount as any)?.username;

                    if (walletAddress) {
                        const syncedUser = await api.syncUser({ privyId: user.id, walletAddress, displayName });
                        setBackendUser(syncedUser);
                        // Only redirect after successful backend sync
                        router.replace("/(tabs)");
                    }
                } catch (error) {
                    console.error("Failed to sync user:", error);
                    setError("Failed to sync user with backend");
                } finally {
                    setIsSyncing(false);
                }
            } else if (isReady && user && backendUser) {
                // User is already synced, redirect immediately
                router.replace("/(tabs)");
            }
        };

        syncUser();
    }, [isReady, user, backendUser, isSyncing]);

    const handleLogin = (provider: "google" | "twitter") => {
        setError("");
        setLoadingProvider(provider);
        oauth.login({ provider });
    };

    return (
        <View style={styles.container}>
            {/* Clean white background - no gradients for minimal look */}
            <View style={styles.gradient} />

            {/* Minimal geometric patterns - subtle gray circles */}
            <Orbit size={300} duration={20000} delay={0} color={Theme.borderLight} offsetX={-80} offsetY={-100} />
            <Orbit size={400} duration={30000} delay={1000} color={Theme.border} offsetX={60} offsetY={50} />
            <Orbit size={200} duration={15000} delay={500} color={Theme.borderLight} offsetX={100} offsetY={-150} />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* Centered Branding */}
                    <View style={styles.brandingContainer}>
                        <Text style={styles.brandName}>hunch</Text>
                        <Text style={styles.tagline}>bet on what you believe</Text>
                    </View>

                    {/* Get Started Button */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.getStartedButton}
                            onPress={() => setShowModal(true)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.getStartedGradient}>
                                <Text style={styles.getStartedText}>Get Started</Text>
                                <Ionicons name="arrow-forward" size={18} color={Theme.textInverse} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {/* Bottom Sheet Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowModal(false)}
                >
                    <Pressable
                        style={styles.modalContent}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Modal Handle */}
                        <View style={styles.modalHandle} />

                        {/* Close Button */}
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowModal(false)}
                        >
                            <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
                        </TouchableOpacity>

                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Join Hunch</Text>
                            <Text style={styles.modalSubtitle}>
                                Make predictions on events that matter
                            </Text>
                        </View>

                        {/* Login Buttons */}
                        <View style={styles.authButtonsContainer}>
                            {/* Google Login Button */}
                            <TouchableOpacity
                                style={styles.authButton}
                                onPress={() => handleLogin("google")}
                                disabled={loadingProvider !== null}
                                activeOpacity={0.7}
                            >
                                {loadingProvider === "google" ? (
                                    <ActivityIndicator size="small" color={TEXT_PRIMARY} />
                                ) : (
                                    <>
                                        <Ionicons name="logo-google" size={20} color={TEXT_PRIMARY} />
                                        <Text style={styles.authButtonText}>Continue with Google</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* X/Twitter Login Button */}
                            <TouchableOpacity
                                style={styles.authButton}
                                onPress={() => handleLogin("twitter")}
                                disabled={loadingProvider !== null}
                                activeOpacity={0.7}
                            >
                                {loadingProvider === "twitter" ? (
                                    <ActivityIndicator size="small" color={TEXT_PRIMARY} />
                                ) : (
                                    <>
                                        <Ionicons name="logo-twitter" size={20} color={TEXT_PRIMARY} />
                                        <Text style={styles.authButtonText}>Continue with X</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Error Message */}
                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        {/* Terms */}
                        <Text style={styles.termsText}>
                            By continuing, you agree to our Terms of Service and Privacy Policy
                        </Text>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_MAIN,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: BG_MAIN,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
    },
    brandingContainer: {
        alignItems: "center",
        marginBottom: SCREEN_HEIGHT * 0.15,
    },
    brandName: {
        fontSize: 56,
        fontWeight: "100",
        color: TEXT_PRIMARY,
        letterSpacing: 8,
        textTransform: "lowercase",
    },
    tagline: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        letterSpacing: 2,
        marginTop: 16,
        textTransform: "uppercase",
        fontWeight: "500",
    },
    buttonContainer: {
        position: "absolute",
        bottom: 80,
        left: 32,
        right: 32,
    },
    getStartedButton: {
        borderRadius: 8,
        backgroundColor: Theme.bgDark,
        shadowColor: Theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    getStartedGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 36,
        gap: 10,
    },
    getStartedText: {
        color: Theme.textInverse,
        fontSize: 16,
        fontWeight: "500",
        letterSpacing: 0.5,
    },
    // Orbit styles - minimal
    orbit: {
        position: "absolute",
        borderWidth: 0.5,
        borderRadius: 9999,
        borderStyle: "solid",
        opacity: 0.3,
    },
    orbitDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        position: "absolute",
        top: -2,
        left: "50%",
        marginLeft: -2,
        opacity: 0.5,
    },
    // Modal styles - clean white design
    modalOverlay: {
        flex: 1,
        backgroundColor: Theme.overlay,
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: Theme.bgMain,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 48,
        minHeight: SCREEN_HEIGHT * 0.45,
        shadowColor: Theme.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 16,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: Theme.border,
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 20,
    },
    closeButton: {
        position: "absolute",
        top: 20,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Theme.bgCard,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    modalHeader: {
        alignItems: "center",
        marginTop: 20,
        marginBottom: 32,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: "600",
        color: TEXT_PRIMARY,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    modalSubtitle: {
        fontSize: 14,
        color: TEXT_SECONDARY,
        textAlign: "center",
    },
    authButtonsContainer: {
        gap: 12,
    },
    authButton: {
        backgroundColor: Theme.bgMain,
        borderWidth: 1.5,
        borderColor: Theme.textPrimary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 15,
        paddingHorizontal: 24,
        borderRadius: 8,
        gap: 12,
    },
    authButtonText: {
        color: TEXT_PRIMARY,
        fontSize: 15,
        fontWeight: "600",
    },
    errorContainer: {
        backgroundColor: Theme.errorMuted,
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        borderWidth: 1,
        borderColor: Theme.error,
    },
    errorText: {
        color: Theme.error,
        fontSize: 14,
        textAlign: "center",
    },
    termsText: {
        fontSize: 11,
        color: TEXT_DISABLED,
        textAlign: "center",
        marginTop: 24,
        lineHeight: 16,
    },
});
