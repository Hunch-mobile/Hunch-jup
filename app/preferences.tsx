import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const INTERESTS = [
    'Sports',
    'Politics',
    'Crypto',
    'Economics',
    'Companies',
    'Science and Technology',
    'Entertainment',
    'Elections',
    'Climate and Weather',
    'Financials',
    'Social',
];

export default function PreferencesScreen() {
    const router = useRouter();
    const { backendUser, loadPreferences } = useUser();
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const toggleInterest = (interest: string) => {
        Haptics.selectionAsync();
        setSelectedInterests(prev => 
            prev.includes(interest) 
                ? prev.filter(i => i !== interest)
                : [...prev, interest]
        );
    };

    const handleContinue = async () => {
        if (selectedInterests.length === 0) {
            // Allow continuing without selection
        }
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsSaving(true);

        try {
            // Save preferences
            if (backendUser?.id) {
                await api.savePreferences(backendUser.id, {
                    interests: selectedInterests,
                    hasCompletedOnboarding: true,
                });
                
                // Save to local storage
                const prefs = { interests: selectedInterests, hasCompletedOnboarding: true };
                await AsyncStorage.setItem('userPreferences', JSON.stringify(prefs));
                
                // Reload preferences in context
                await loadPreferences();
            }

            // Navigate to homepage
            router.replace("/(tabs)");
        } catch (error) {
            console.error("Failed to save preferences:", error);
            // Still navigate to homepage even if save fails
            router.replace("/(tabs)");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1">
                <View className="flex-1 px-6 pt-8">
                    {/* Header */}
                    <View className="mb-8">
                        <Text className="text-sm text-gray-500 mb-2">
                            Step 5
                        </Text>
                        <View className="flex-row items-center flex-wrap">
                            <Text className="text-3xl font-bold text-black">
                                Pick your interests to personalize your{' '}
                            </Text>
                            <View className="flex-row items-center">
                                <Text className="text-3xl font-bold text-black">feed</Text>
                                <Ionicons name="trending-up" size={24} color="#FFA500" style={{ marginLeft: 4 }} />
                            </View>
                        </View>
                    </View>

                    {/* Interest Selection Tags */}
                    <View className="flex-row flex-wrap gap-3 mb-8">
                        {INTERESTS.map((interest) => {
                            const isSelected = selectedInterests.includes(interest);
                            return (
                                <TouchableOpacity
                                    key={interest}
                                    onPress={() => toggleInterest(interest)}
                                    activeOpacity={0.7}
                                    className={`px-6 py-3 rounded-full border-2 ${
                                        isSelected
                                            ? 'bg-black border-black'
                                            : 'bg-white border-gray-300'
                                    }`}
                                >
                                    <Text
                                        className={`text-base font-medium ${
                                            isSelected ? 'text-white' : 'text-black'
                                        }`}
                                    >
                                        {interest}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Continue Button */}
                <View className="px-6 pb-8">
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={isSaving}
                        activeOpacity={0.8}
                        className="bg-black rounded-lg py-4 items-center justify-center"
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text className="text-white text-base font-semibold">
                                Continue
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
