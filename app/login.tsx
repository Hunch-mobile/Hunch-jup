import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
    const { user, isReady } = usePrivy();
    const { setBackendUser, backendUser, preferences } = useUser();
    const router = useRouter();
    const [error, setError] = useState("");
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showApple, setShowApple] = useState(false);
    const slideAnim = useRef(new Animated.Value(-60)).current;

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
            toValue: showApple ? 0 : -60,
            useNativeDriver: true,
            tension: 100,
            friction: 5,
        }).start();
    }, [showApple]);

    const handleLogin = (provider: "google" | "twitter" | "apple") => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setError("");
        setLoadingProvider(provider);
        oauth.login({ provider });
    };

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1">
                <View className="flex-1 items-center px-8">
                    {/* Minimal Branding */}
                    <View className="items-center mt-20">
                        <Text className="text-5xl font-bold text-txt-primary ">
                            Hunch
                        </Text>
                        <Text className=" pt-6  text-2xl font-light">
                            Predict with frens
                        </Text>
                    </View>

                    {/* Login Buttons - positioned at bottom */}
 <View className="w-full absolute bottom-24 gap-3 px-4">
                        {/* Continue with X - shown first */}
                        <TouchableOpacity
                            className="bg-yellow-400 flex-row items-center justify-center py-4  px-6 rounded-lg"
                            onPress={() => handleLogin("twitter")}
                            disabled={loadingProvider !== null}
                            activeOpacity={0.7}
                        >
                            {loadingProvider === "twitter" ? (
                                <ActivityIndicator size="small" color="#000000" />
                            ) : (
                                <Text className="text-black text-base font-bold">
                                    Continue with X
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* Arrow button */}
                        <TouchableOpacity
                            className="flex-row items-center justify-center py-3"
                            onPress={() => setShowApple(!showApple)}
                            activeOpacity={0.7}
                        >
                            <Ionicons 
                                name={showApple ? "chevron-up" : "chevron-down"} 
                                size={24} 
                                color={Theme.textPrimary} 
                            />
                        </TouchableOpacity>

                        {/* Continue with Apple - revealed when arrow is clicked */}
                        <View 
                            style={{
                                height: 56,
                                overflow: 'hidden',
                            }}
                        >
                            <Animated.View
                                style={{
                                    transform: [{ translateY: slideAnim }],
                                }}
                            >
                                <TouchableOpacity
                                    className="bg-yellow-400 flex-row items-center justify-center py-4 px-6 rounded-lg"
                                    onPress={() => handleLogin("apple")}
                                    disabled={loadingProvider !== null || !showApple}
                                    activeOpacity={0.7}
                                >
                                    {loadingProvider === "apple" ? (
                                        <ActivityIndicator size="small" color="#000000" />
                                    ) : (
                                        <Text className="text-black text-base font-bold">
                                            Continue with Apple
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                    </View>

                    {/* Error Message */}
                    {error ? (
                        <View className="mt-6 px-4">
                            <Text className="text-status-error text-sm text-center">{error}</Text>
                        </View>
                    ) : null}
                </View>
            </SafeAreaView>

        </View>
    );
}

