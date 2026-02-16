import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function UsernameScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ suggested?: string }>();
    const { backendUser, setBackendUser } = useUser();
    const [username, setUsername] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [helperText, setHelperText] = useState("3-20 chars, lowercase letters, numbers, underscore");
    const [error, setError] = useState("");

    useEffect(() => {
        const suggested = typeof params.suggested === "string" ? params.suggested : "";
        if (!suggested || username) return;
        setUsername(suggested.replace(/\s/g, "").replace(/^@+/, "").toLowerCase());
    }, [params.suggested, username]);

    useEffect(() => {
        const trimmed = username.trim().toLowerCase();
        if (!trimmed) {
            setIsAvailable(null);
            setHelperText("3-20 chars, lowercase letters, numbers, underscore");
            return;
        }

        if (!USERNAME_REGEX.test(trimmed)) {
            setIsAvailable(false);
            setHelperText("Use 3-20 chars: a-z, 0-9, and _");
            return;
        }

        setIsChecking(true);
        const timeoutId = setTimeout(async () => {
            try {
                const result = await api.checkUsernameAvailability(trimmed);
                setIsAvailable(result.available);
                setHelperText(result.available ? "Great! This username is available." : (result.reason || "Username is already taken"));
            } catch (availabilityError) {
                console.error("[Username] Availability check failed:", availabilityError);
                setIsAvailable(false);
                setHelperText("Could not verify username right now. Please retry.");
            } finally {
                setIsChecking(false);
            }
        }, 350);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [username]);

    const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username]);
    const canContinue = !!normalizedUsername && isAvailable === true && !isChecking && !isClaiming;

    const handleContinue = async () => {
        if (!canContinue) {
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsClaiming(true);
        setError("");

        try {
            const updatedUser = await api.claimUsername(normalizedUsername);
            const merged = {
                ...(backendUser || updatedUser),
                ...updatedUser,
                onboardingStep: 'INTERESTS' as const,
            };
            await setBackendUser(merged);
            await api.saveOnboardingProgress({ step: "INTERESTS" });
            router.replace("/preferences");
        } catch (claimError: any) {
            console.error("[Username] Claim failed:", claimError);
            setError(claimError?.message || "Failed to claim username");
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1">
                <View className="flex-1 px-6 pt-10">
                    <Text className="text-sm text-gray-400 mb-2 tracking-wide">STEP 2</Text>
                    <Text className="text-3xl font-bold text-gray-900 mb-2">
                        Pick your username
                    </Text>
                    <Text className="text-lg text-gray-400 mb-10">
                        This is how people discover and follow you.
                    </Text>

                    <View className="border border-gray-200 rounded-2xl px-4 py-3 mb-4">
                        <View className="flex-row items-center">
                            <Text className="text-lg text-gray-500 mr-1">@</Text>
                            <TextInput
                                value={username}
                                onChangeText={(value) => {
                                    setError("");
                                    setUsername(value.replace(/\s/g, "").toLowerCase());
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="john_doe"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 text-lg text-gray-900"
                            />
                            {isChecking ? <ActivityIndicator size="small" color="#6B7280" /> : null}
                        </View>
                    </View>

                    <Text
                        className={`text-sm ${isAvailable === true ? "text-green-600" : isAvailable === false ? "text-red-600" : "text-gray-400"}`}
                    >
                        {helperText}
                    </Text>

                    {error ? <Text className="text-sm text-red-600 mt-4">{error}</Text> : null}
                </View>

                <View
                    className="px-6 pb-10 pt-6 bg-white"
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: "#F3F4F6",
                    }}
                >
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={!canContinue}
                        activeOpacity={0.8}
                        className={`rounded-full py-4 flex-row items-center justify-center ${canContinue ? "bg-[#FEEC28]" : "bg-gray-200"}`}
                    >
                        {isClaiming ? (
                            <ActivityIndicator size="small" color={canContinue ? "#111827" : "#6B7280"} />
                        ) : (
                            <>
                                <Text className={`text-lg font-semibold ${canContinue ? "text-gray-900" : "text-gray-500"}`}>
                                    Continue
                                </Text>
                                <Ionicons
                                    name="arrow-forward"
                                    size={20}
                                    color={canContinue ? "#111827" : "#6B7280"}
                                    style={{ marginLeft: 8 }}
                                />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
