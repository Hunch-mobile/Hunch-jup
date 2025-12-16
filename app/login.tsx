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

// Theme constants
const ACCENT = '#3FE3FF';
const BG_MAIN = '#000000';
const BG_CARD = '#111827';
const BG_ELEVATED = '#161C24';
const BORDER = '#1F2937';
const TEXT_PRIMARY = '#E5E7EB';
const TEXT_SECONDARY = '#9CA3AF';
const TEXT_DISABLED = '#6B7280';

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

    // Sync user with backend after Privy authentication
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
                        router.replace("/(tabs)");
                    }
                } catch (error) {
                    console.error("Failed to sync user:", error);
                    setError("Failed to sync user with backend");
                } finally {
                    setIsSyncing(false);
                }
            }
        };

        syncUser();
    }, [isReady, user, backendUser, isSyncing]);

    // Redirect to home if already authenticated and synced
    useEffect(() => {
        if (isReady && user && backendUser) {
            router.replace("/(tabs)");
        }
    }, [isReady, user, backendUser, router]);

    const handleLogin = (provider: "google" | "twitter") => {
        setError("");
        setLoadingProvider(provider);
        oauth.login({ provider });
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[BG_MAIN, '#0D1117', BG_CARD, BG_ELEVATED, BG_CARD]}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Decorative orbits with cyan accent */}
            <Orbit size={300} duration={20000} delay={0} color={`${ACCENT}20`} offsetX={-80} offsetY={-100} />
            <Orbit size={400} duration={30000} delay={1000} color={`${ACCENT}15`} offsetX={60} offsetY={50} />
            <Orbit size={200} duration={15000} delay={500} color={`${ACCENT}18`} offsetX={100} offsetY={-150} />

            {/* Soft glow effect at bottom */}
            <LinearGradient
                colors={['transparent', `${ACCENT}08`, `${ACCENT}12`]}
                style={styles.bottomGlow}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

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
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[ACCENT, '#00B8D4']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.getStartedGradient}
                            >
                                <Text style={styles.getStartedText}>Get Started</Text>
                                <Ionicons name="arrow-forward" size={18} color={BG_MAIN} />
                            </LinearGradient>
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
    },
    bottomGlow: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.4,
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
        fontWeight: "200",
        color: TEXT_PRIMARY,
        letterSpacing: 12,
        textTransform: "lowercase",
    },
    tagline: {
        fontSize: 13,
        color: TEXT_SECONDARY,
        letterSpacing: 3,
        marginTop: 16,
        textTransform: "lowercase",
    },
    buttonContainer: {
        position: "absolute",
        bottom: 80,
        left: 32,
        right: 32,
    },
    getStartedButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    getStartedGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        gap: 8,
    },
    getStartedText: {
        color: BG_MAIN,
        fontSize: 16,
        fontWeight: "600",
        letterSpacing: 0.5,
    },
    // Orbit styles
    orbit: {
        position: "absolute",
        borderWidth: 1,
        borderRadius: 9999,
        borderStyle: "dashed",
    },
    orbitDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        position: "absolute",
        top: -3,
        left: "50%",
        marginLeft: -3,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: BG_ELEVATED,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 48,
        minHeight: SCREEN_HEIGHT * 0.45,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: BORDER,
    },
    modalHandle: {
        width: 36,
        height: 4,
        backgroundColor: BORDER,
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
        backgroundColor: BG_CARD,
        borderWidth: 1,
        borderColor: BORDER,
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
        backgroundColor: BG_CARD,
        borderWidth: 1,
        borderColor: BORDER,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
        gap: 12,
    },
    authButtonText: {
        color: TEXT_PRIMARY,
        fontSize: 15,
        fontWeight: "500",
    },
    errorContainer: {
        backgroundColor: "rgba(248, 113, 113, 0.15)",
        padding: 12,
        borderRadius: 12,
        marginTop: 16,
        borderWidth: 1,
        borderColor: "rgba(248, 113, 113, 0.2)",
    },
    errorText: {
        color: "#f87171",
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
