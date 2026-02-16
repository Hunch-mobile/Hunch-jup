import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const INTERESTS = [
    'Sports',
    'Politics',
    'Crypto',
    'Economics',
    'Companies',
    'Science & Tech',
    'Entertainment',
    'Elections',
    'Mentions',
    'Climate',
    'Financials',
    'Social',
];

export default function PreferencesScreen() {
    const router = useRouter();
    const { backendUser, loadPreferences, setBackendUser } = useUser();
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const toggleInterest = (interest: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedInterests(prev =>
            prev.includes(interest)
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    const handleContinue = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsSaving(true);

        try {
            // Save preferences
            if (backendUser?.id) {
                // Save preferences to backend
                await api.savePreferences(backendUser.id, {
                    interests: selectedInterests,
                    hasCompletedOnboarding: false,
                });

                // Save to local storage as backup
                const prefs = { interests: selectedInterests, hasCompletedOnboarding: false };
                await AsyncStorage.setItem('userPreferences', JSON.stringify(prefs));

                try {
                    await api.saveOnboardingProgress({ step: "SUGGESTED_FOLLOWERS" });
                } catch (progressError) {
                    console.warn("Failed to save onboarding step:", progressError);
                }

                // Update context so AuthFlowGate stays in sync
                if (backendUser) {
                    await setBackendUser({ ...backendUser, onboardingStep: 'SUGGESTED_FOLLOWERS' });
                }

                // Reload preferences in context
                await loadPreferences();
            }

            // Navigate to suggested followers
            router.replace("/suggested-followers");
        } catch (error) {
            console.error("Failed to save preferences:", error);
            // Still navigate to suggested followers even if save fails
            router.replace("/suggested-followers");
        } finally {
            setIsSaving(false);
        }
    };

    const hasSelection = selectedInterests.length > 0;

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 140 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View className="px-6 pt-10">
                        {/* Minimal Header */}
                        <Text className="text-sm text-gray-400 mb-2 tracking-wide">
                            STEP 3
                        </Text>
                        <Text className="text-3xl font-bold text-gray-900 mb-2">
                            What interests you?
                        </Text>
                        <Text className="text-lg text-gray-400 mb-10">
                            Pick topics to personalize your feed
                        </Text>

                        {/* Clean Tag Selection */}
                        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                            {INTERESTS.map((interest) => {
                                const isSelected = selectedInterests.includes(interest);
                                return (
                                    <TouchableOpacity
                                        key={interest}
                                        onPress={() => toggleInterest(interest)}
                                        activeOpacity={0.7}
                                        style={{ marginHorizontal: 6, marginBottom: 12 }}
                                    >
                                        <View
                                            className={`px-5 py-3 rounded-full ${isSelected
                                                ? 'bg-gray-900'
                                                : 'bg-gray-100'
                                                }`}
                                        >
                                            <Text
                                                className={`text-base font-medium ${isSelected ? 'text-white' : 'text-gray-700'
                                                    }`}
                                            >
                                                {interest}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Selection indicator */}
                        {hasSelection && (
                            <Text className="text-sm text-gray-400 mt-6 text-center">
                                {selectedInterests.length} selected
                            </Text>
                        )}
                    </View>
                </ScrollView>

                {/* Fixed Bottom Button */}
                <View
                    className="absolute bottom-0 left-0 right-0 px-6 pb-10 pt-6 bg-white"
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: '#F3F4F6',
                    }}
                >
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={isSaving}
                        activeOpacity={0.8}
                        className={`rounded-full py-4 flex-row items-center justify-center ${hasSelection ? 'bg-[#FEEC28]' : 'bg-gray-200'
                            }`}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={hasSelection ? "#111827" : "#6B7280"} />
                        ) : (
                            <>
                                <Text className={`text-lg font-semibold ${hasSelection ? 'text-gray-900' : 'text-gray-500'
                                    }`}>
                                    {hasSelection ? "Continue" : "Skip"}
                                </Text>
                                <Ionicons
                                    name="arrow-forward"
                                    size={20}
                                    color={hasSelection ? "#111827" : "#6B7280"}
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
