import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OrbitProps {
    size: number;
    duration: number;
    delay: number;
    color: string;
    offsetX: number;
    offsetY: number;
}

// Orbit component uses Animated.View which requires style prop for animations
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
            <View style={styles.orbitDot} />
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
            } else if (isReady && user && backendUser) {
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
        <View className="flex-1 bg-app-bg">
            {/* Background */}
            <View className="absolute inset-0 bg-app-bg" />

            {/* Minimal geometric patterns */}
            <Orbit size={300} duration={20000} delay={0} color={Theme.borderLight} offsetX={-80} offsetY={-100} />
            <Orbit size={400} duration={30000} delay={1000} color={Theme.border} offsetX={60} offsetY={50} />
            <Orbit size={200} duration={15000} delay={500} color={Theme.borderLight} offsetX={100} offsetY={-150} />

            <SafeAreaView className="flex-1">
                <View className="flex-1 justify-center items-center px-8">
                    {/* Centered Branding */}
                    <View className="items-center" style={{ marginBottom: SCREEN_HEIGHT * 0.15 }}>
                        <Text className="text-[56px] font-thin text-txt-primary tracking-[8px] lowercase">
                            hunch
                        </Text>
                        <Text className="text-xs text-txt-secondary tracking-widest mt-4 uppercase font-medium">
                            bet on what you believe
                        </Text>
                    </View>

                    {/* Get Started Button */}
                    <View className="absolute bottom-20 left-8 right-8">
                        <TouchableOpacity
                            className="rounded-lg bg-app-dark shadow-lg"
                            onPress={() => setShowModal(true)}
                            activeOpacity={0.9}
                        >
                            <View className="flex-row items-center justify-center py-[18px] px-9 gap-2.5">
                                <Text className="text-txt-inverse text-base font-medium tracking-wide">
                                    Get Started
                                </Text>
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
                    className="flex-1 justify-end"
                    style={{ backgroundColor: Theme.overlay }}
                    onPress={() => setShowModal(false)}
                >
                    <Pressable
                        className="bg-app-bg rounded-t-[20px] px-6 pt-3 pb-12 shadow-lg"
                        style={{ minHeight: SCREEN_HEIGHT * 0.45 }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <TouchableOpacity
                            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-app-card items-center justify-center z-10"
                            onPress={() => setShowModal(false)}
                        >
                            <Ionicons name="close" size={20} color={Theme.textSecondary} />
                        </TouchableOpacity>

                        {/* Modal Header */}
                        <View className="items-center mt-5 mb-8">
                            <Text className="text-2xl font-semibold text-txt-primary mb-2 tracking-wide">
                                Join Hunch
                            </Text>
                            <Text className="text-sm text-txt-secondary text-center">
                                Make predictions on events that matter
                            </Text>
                        </View>

                        {/* Login Buttons */}
                        <View className="gap-3">
                            {/* Google Login */}
                            <TouchableOpacity
                                className="bg-app-bg border-[1.5px] border-txt-primary flex-row items-center justify-center py-4 px-6 rounded-lg gap-3"
                                onPress={() => handleLogin("google")}
                                disabled={loadingProvider !== null}
                                activeOpacity={0.7}
                            >
                                {loadingProvider === "google" ? (
                                    <ActivityIndicator size="small" color={Theme.textPrimary} />
                                ) : (
                                    <>
                                        <Ionicons name="logo-google" size={20} color={Theme.textPrimary} />
                                        <Text className="text-txt-primary text-[15px] font-semibold">
                                            Continue with Google
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* X/Twitter Login */}
                            <TouchableOpacity
                                className="bg-app-bg border-[1.5px] border-txt-primary flex-row items-center justify-center py-4 px-6 rounded-lg gap-3"
                                onPress={() => handleLogin("twitter")}
                                disabled={loadingProvider !== null}
                                activeOpacity={0.7}
                            >
                                {loadingProvider === "twitter" ? (
                                    <ActivityIndicator size="small" color={Theme.textPrimary} />
                                ) : (
                                    <>
                                        <Ionicons name="logo-twitter" size={20} color={Theme.textPrimary} />
                                        <Text className="text-txt-primary text-[15px] font-semibold">
                                            Continue with X
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Error Message */}
                        {error ? (
                            <View className="bg-red-50 p-3 rounded-lg mt-4 border border-status-error">
                                <Text className="text-status-error text-sm text-center">{error}</Text>
                            </View>
                        ) : null}

                        {/* Terms */}
                        <Text className="text-[11px] text-txt-disabled text-center mt-6 leading-4">
                            By continuing, you agree to our Terms of Service and Privacy Policy
                        </Text>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

// Minimal styles needed for animated components
const styles = StyleSheet.create({
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
        backgroundColor: Theme.border,
    },
});
