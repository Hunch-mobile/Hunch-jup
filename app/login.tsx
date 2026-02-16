import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import * as Haptics from "expo-haptics";

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get('window');

export default function LoginScreen() {
    const { user, isReady } = usePrivy();
    const { setBackendUser, backendUser } = useUser();
    const [error, setError] = useState("");
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showApple, setShowApple] = useState(false);
    const [walletPendingRetry, setWalletPendingRetry] = useState(false);
    const syncLockRef = useRef(false);
    const slideAnim = useRef(new Animated.Value(-70)).current;

    // Animation refs for mascot
    const mascotScale = useRef(new Animated.Value(0.8)).current;
    const mascotOpacity = useRef(new Animated.Value(0)).current;
    const buttonSlide = useRef(new Animated.Value(100)).current;



    const inferProvider = (linkedAccounts: Array<any> = []): "apple" | "twitter" | "google" => {
        if (linkedAccounts.some((a) => a.type === "apple_oauth")) return "apple";
        if (linkedAccounts.some((a) => a.type === "google_oauth")) return "google";
        return "twitter";
    };

    const extractUsernameAndDisplayName = (linkedAccounts: Array<any> = []): { username?: string; displayName?: string } => {
        const twitter = linkedAccounts.find((a: any) => a.type === "twitter_oauth");
        const apple = linkedAccounts.find((a: any) => a.type === "apple_oauth");
        const google = linkedAccounts.find((a: any) => a.type === "google_oauth");
        const email = linkedAccounts.find((a: any) => a.type === "email");

        const account = twitter || apple || google || email;
        if (!account) return {};

        const rawUsername = (account as any)?.username ?? (account as any)?.screen_name;
        const username = rawUsername ? String(rawUsername).replace(/^@+/, "").trim() : undefined;
        const displayName =
            (account as any)?.name ||
            (account as any)?.email?.split("@")[0] ||
            username;

        return { username: username || undefined, displayName: displayName || undefined };
    };

    const oauth = useLoginWithOAuth({
        onError: (err) => {
            console.error('[Apple OAuth Error]', JSON.stringify(err, null, 2));
            console.error('[Error Details]', {
                message: err.message,
                name: err.name,
                stack: err.stack,
                cause: err.cause
            });
            setLoadingProvider(null);
            if (err.message && !err.message.includes("cancelled")) {
                if (err.message.includes("Unable to exchange oauth code for provider")) {
                    setError("Apple login is temporarily unavailable. Please retry, or continue with X.");
                } else {
                    setError(err.message);
                }
            }
        },
        onSuccess: (...args: any[]) => {
            const [user, isNewUser, wasAlreadyAuthenticated, loginMethod, linkedAccount] = args;
            console.log('========== APPLE OAUTH SUCCESS ==========');
            console.log('[OAuth Success] Is New User:', isNewUser);
            console.log('[OAuth Success] Was Already Authenticated:', wasAlreadyAuthenticated);
            console.log('[OAuth Success] Login Method:', loginMethod);
            console.log('[OAuth Success] Linked Account:', JSON.stringify(linkedAccount, null, 2));
            console.log('[OAuth Success] Full User Object:', JSON.stringify(user, null, 2));

            // Log specific Apple account details
            const appleAccount = user?.linked_accounts?.find((a: any) => a.type === 'apple_oauth');
            if (appleAccount) {
                console.log('========== APPLE ACCOUNT DETAILS ==========');
                console.log('[Apple Account]', JSON.stringify(appleAccount, null, 2));
            }

            console.log('==========================================');
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
            if (!isReady || !user || backendUser || walletPendingRetry || syncLockRef.current) return;

            syncLockRef.current = true;
            setIsSyncing(true);
            setError("");
            console.log('========== SYNCING USER WITH BACKEND ==========');
            console.log('[Sync] Privy User ID:', user.id);
            console.log('[Sync] Linked Accounts:', JSON.stringify(user.linked_accounts, null, 2));

            const maxRetries = 3;
            const retryDelayMs = 2000;
            const walletAccount = (user.linked_accounts || []).find((a: any) => a.type === "wallet" || a.type === "embedded_wallet");
            const walletAddress = (walletAccount as any)?.address as string | undefined;

            try {
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        const { username: extractedUsername, displayName: extractedDisplayName } = extractUsernameAndDisplayName(
                            user.linked_accounts || []
                        );

                        const bootstrap = await api.bootstrapOAuthUser({
                            privyId: user.id,
                            provider: inferProvider(user.linked_accounts || []),
                            linkedAccounts: (user.linked_accounts || []) as Array<Record<string, any>>,
                            username: extractedUsername,
                            displayName: extractedDisplayName,
                        });

                        if (!bootstrap.walletReady) {
                            if (attempt < maxRetries) {
                                setError(`Creating your wallet... (${attempt}/${maxRetries})`);
                                await new Promise((r) => setTimeout(r, retryDelayMs));
                                continue;
                            }
                            setError("Wallet setup is still in progress. Please try again in a moment.");
                            setWalletPendingRetry(true);
                            return;
                        }

                        // Set the backend user — AuthFlowGate will handle navigation
                        await setBackendUser(bootstrap.user);
                        return;
                    } catch (err: any) {
                        const message = err?.message || "";
                        const shouldFallbackToSync = walletAddress && (message.includes("Unique constraint failed") || message.includes("privyId"));
                        if (shouldFallbackToSync) {
                            const { username: extractedUsername, displayName: extractedDisplayName } = extractUsernameAndDisplayName(
                                user.linked_accounts || []
                            );
                            const syncedUser = await api.syncUser({
                                privyId: user.id,
                                walletAddress,
                                displayName: extractedDisplayName || extractedUsername,
                            });
                            // Set the backend user — AuthFlowGate will handle navigation
                            await setBackendUser(syncedUser);
                            return;
                        }

                        console.error("Failed to sync user:", err);
                        if (attempt >= maxRetries) {
                            setError("Failed to sync user with backend");
                            setWalletPendingRetry(true);
                            return;
                        }
                        await new Promise((r) => setTimeout(r, retryDelayMs));
                    }
                }
            } finally {
                setIsSyncing(false);
                syncLockRef.current = false;
                console.log('========== SYNC COMPLETE ==========');
            }
        };

        syncUser();
    }, [isReady, user, backendUser, walletPendingRetry]);

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
        setWalletPendingRetry(false);
        setLoadingProvider(provider);
        console.log(`[Login] Starting ${provider} OAuth flow...`);
        console.log('[Login] App Config:', {
            bundleId: 'com.hunch.run',
            scheme: 'hunch',
            privyAppId: 'cmiq91u0h006jl70cuyb6az3f'
        });
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
                            {walletPendingRetry ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        setWalletPendingRetry(false);
                                        setError("");
                                    }}
                                    style={styles.retryButton}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.retryButtonText}>Retry</Text>
                                </TouchableOpacity>
                            ) : null}
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
        alignItems: 'center',
    },
    errorText: {
        color: '#CC0000',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    retryButton: {
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: '#000000',
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

