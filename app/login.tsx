import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get('window');

export default function LoginScreen() {
    const { user, isReady } = usePrivy();
    const { setBackendUser, backendUser, preferences } = useUser();
    const router = useRouter();
    const [error, setError] = useState("");
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showApple, setShowApple] = useState(false);
    const slideAnim = useRef(new Animated.Value(-70)).current;

    // Animation refs for mascot
    const mascotScale = useRef(new Animated.Value(0.8)).current;
    const mascotOpacity = useRef(new Animated.Value(0)).current;
    const buttonSlide = useRef(new Animated.Value(100)).current;

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
        },
    });

    // Entry animations
    useEffect(() => {
        Animated.parallel([
            Animated.spring(mascotScale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }),
            Animated.timing(mascotOpacity, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(buttonSlide, {
                toValue: 0,
                useNativeDriver: true,
                tension: 60,
                friction: 10,
                delay: 300,
            }),
        ]).start();
    }, []);

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
                        (a: any) => a.type === 'email' || a.type === 'google_oauth' || a.type === 'twitter_oauth' || a.type === 'apple_oauth'
                    );
                    const displayName = (emailAccount as any)?.email?.split('@')[0] ||
                        (emailAccount as any)?.name ||
                        (emailAccount as any)?.username;

                    if (walletAddress) {
                        const syncedUser = await api.syncUser({ privyId: user.id, walletAddress, displayName });
                        setBackendUser(syncedUser);

                        // Check if user has completed onboarding
                        try {
                            const userPrefs = await api.getUserPreferences(syncedUser.id);
                            if (!userPrefs?.hasCompletedOnboarding) {
                                router.replace("/preferences");
                            } else {
                                router.replace("/(tabs)");
                            }
                        } catch (err) {
                            // If preferences check fails, assume first time user
                            router.replace("/preferences");
                        }
                    }
                } catch (error) {
                    console.error("Failed to sync user:", error);
                    setError("Failed to sync user with backend");
                } finally {
                    setIsSyncing(false);
                }
            } else if (isReady && user && backendUser) {
                // Check preferences for existing user
                if (!preferences?.hasCompletedOnboarding) {
                    router.replace("/preferences");
                } else {
                    router.replace("/(tabs)");
                }
            }
        };

        syncUser();
    }, [isReady, user, backendUser, isSyncing]);

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: showApple ? 0 : -70,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
        }).start();
    }, [showApple]);

    const handleLogin = (provider: "google" | "twitter" | "apple") => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setError("");
        setLoadingProvider(provider);
        oauth.login({ provider });
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* Mascot Image with Animation */}
                    <Animated.View
                        style={[
                            styles.mascotContainer,
                            {
                                opacity: mascotOpacity,
                                transform: [{ scale: mascotScale }],
                            }
                        ]}
                    >
                        <View style={styles.mascotShadow}>
                            <Image
                                source={require('@/assets/hunch.jpg')}
                                style={styles.mascotImage}
                                resizeMode="contain"
                            />
                        </View>
                    </Animated.View>

                    {/* Taglines */}
                    <View style={styles.taglineContainer}>
                        <Text style={styles.tagline}>
                            Predict with frens
                        </Text>
                        <Text style={styles.taglineBold}>
                            Copy Trade
                        </Text>
                        <Text style={styles.taglineExtraBold}>
                            Win
                        </Text>
                    </View>

                    {/* Login Buttons - positioned at bottom */}
                    <Animated.View
                        style={[
                            styles.buttonContainer,
                            { transform: [{ translateY: buttonSlide }] }
                        ]}
                    >
                        {/* Continue with X - Primary Button */}
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => handleLogin("twitter")}
                            disabled={loadingProvider !== null}
                            activeOpacity={0.85}
                        >
                            {loadingProvider === "twitter" ? (
                                <ActivityIndicator size="small" color="#FFD700" />
                            ) : (
                                <>
                                    <Text style={styles.primaryButtonText}>
                                        Continue with X
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* More options toggle */}
                        <TouchableOpacity
                            style={styles.toggleButton}
                            onPress={() => setShowApple(!showApple)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.toggleText}>More options</Text>
                            <Ionicons
                                name={showApple ? "chevron-up" : "chevron-down"}
                                size={18}
                                color="#000000"
                            />
                        </TouchableOpacity>

                        {/* Continue with Apple - Revealed */}
                        <View style={styles.appleButtonWrapper}>
                            <Animated.View
                                style={{
                                    transform: [{ translateY: slideAnim }],
                                }}
                            >
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => handleLogin("apple")}
                                    disabled={loadingProvider !== null || !showApple}
                                    activeOpacity={0.85}
                                >
                                    {loadingProvider === "apple" ? (
                                        <ActivityIndicator size="small" color="#FFD700" />
                                    ) : (
                                        <>
                                            <Text style={styles.secondaryButtonText}>
                                                Continue with Apple
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                    </Animated.View>

                    {/* Error Message */}
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FEEC28', // Vibrant yellow
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    mascotContainer: {
        marginTop: 60,
        alignItems: 'center',
    },
    mascotShadow: {
        overflow: 'hidden',
    },
    mascotImage: {
        width: width * 0.7,
        height: width * 0.7,
    },
    taglineContainer: {
        marginTop: 28,
        alignItems: 'center',
    },
    tagline: {
        fontSize: 24,
        fontWeight: '600',
        color: '#000000',
        letterSpacing: 1,
        lineHeight: 36,
    },
    taglineBold: {
        fontSize: 24,
        fontWeight: '600',
        color: '#000000',
        letterSpacing: 1,
        lineHeight: 36,
    },
    taglineExtraBold: {
        fontSize: 24,
        fontWeight: '600',
        color: '#000000',
        letterSpacing: 1,
        lineHeight: 36,
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 40,
        width: '100%',
        paddingHorizontal: 8,
        gap: 12,
    },
    primaryButton: {
        backgroundColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderRadius: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    buttonIcon: {
        marginRight: 10,
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    toggleText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.7,
    },
    appleButtonWrapper: {
        height: 62,
        overflow: 'hidden',
    },
    secondaryButton: {
        backgroundColor: '#1a1a1a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#333333',
    },
    secondaryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    errorContainer: {
        position: 'absolute',
        bottom: 180,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        borderRadius: 12,
    },
    errorText: {
        color: '#CC0000',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
});

