import CreditCard from "@/components/CreditCard";
import SettingsSheet from "@/components/SettingsSheet";
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { useFundSolanaWallet } from "@privy-io/expo/ui";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TradeTab = 'active' | 'previous';

// Trade item component
const TradeItem = ({ trade, onPress }: { trade: Trade; onPress: () => void }) => (
    <TouchableOpacity
        className="flex-row items-center justify-between px-3.5 py-3 border-b border-border"
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View className="flex-row items-center flex-1">
            <View className={`px-2 py-1 rounded-md mr-2.5 ${trade.side === 'yes' ? 'bg-txt-primary' : 'bg-app-bg border-[1.5px] border-txt-primary'}`}>
                <Text className={`text-[11px] font-bold ${trade.side === 'yes' ? 'text-txt-inverse' : 'text-txt-primary'}`}>
                    {trade.side.toUpperCase()}
                </Text>
            </View>
            <View className="flex-1">
                <Text className="text-sm font-medium text-txt-primary mb-0.5" numberOfLines={1}>
                    {trade.marketTicker}
                </Text>
                <Text className="text-xs text-txt-disabled">
                    {new Date(trade.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
            </View>
        </View>
        <Text className="text-sm font-semibold text-txt-primary">
            ${parseFloat(trade.amount).toFixed(2)}
        </Text>
    </TouchableOpacity>
);

export default function ProfileScreen() {
    const { user, logout } = usePrivy();
    const { backendUser, setBackendUser } = useUser();
    const router = useRouter();
    const { fundWallet } = useFundSolanaWallet();
    const [profileData, setProfileData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [activeTab, setActiveTab] = useState<TradeTab>('active');
    const [settingsVisible, setSettingsVisible] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;

    const animateToTab = useCallback((tab: TradeTab) => {
        const toValue = tab === 'active' ? 0 : -SCREEN_WIDTH + 40;
        Animated.spring(slideAnim, {
            toValue,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
        setActiveTab(tab);
    }, [slideAnim]);

    useEffect(() => {
        loadProfile();
        loadTrades();
    }, [backendUser]);

    const loadProfile = async () => {
        if (!backendUser) {
            setIsLoading(false);
            return;
        }
        try {
            const data = await api.getUser(backendUser.id);
            setProfileData(data);
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadTrades = async () => {
        if (!backendUser) return;
        try {
            const data = await api.getUserTrades(backendUser.id, 50);
            setTrades(data);
        } catch (error) {
            console.error("Failed to load trades:", error);
        }
    };

    const handleLogout = async () => {
        await logout();
        setBackendUser(null);
        router.replace("/login");
    };

    const twitterAccount = user?.linked_accounts?.find((a: any) => a.type === 'twitter_oauth');
    const rawProfileImageUrl = (twitterAccount as any)?.profile_picture_url;
    const profileImageUrl = rawProfileImageUrl?.replace('_normal', '');

    const displayName = profileData?.displayName || backendUser?.displayName || "User";
    const followerCount = profileData?.followerCount || 0;
    const followingCount = profileData?.followingCount || 0;

    const now = new Date();
    const activeTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff < 24;
    });
    const previousTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff >= 24;
    });

    if (isLoading) {
        return (
            <View className="flex-1 bg-app-bg">
                <SafeAreaView className="flex-1" edges={['top']}>
                    <View className="flex-1 justify-center items-center px-5">
                        <ActivityIndicator size="large" color={Theme.textPrimary} />
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                    {/* Profile Header */}
                    <View className="mb-6 pt-4">
                        {/* Menu Button */}
                        <View className="items-end mb-5">
                            <TouchableOpacity
                                className="justify-center items-center"
                                onPress={() => setSettingsVisible(true)}
                            >
                                <Ionicons name="menu-outline" size={24} color={Theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Avatar + Info Row */}
                        <View className="flex-row items-start gap-4 mb-4">
                            {/* Avatar */}
                            <View className="relative">
                                <View className="w-14 h-14 rounded-full bg-app-card justify-center items-center overflow-hidden">
                                    {profileImageUrl ? (
                                        <Image
                                            source={{ uri: profileImageUrl }}
                                            className="w-full h-full rounded-full"
                                        />
                                    ) : (
                                        <Text className="text-[22px] font-bold text-txt-primary">
                                            {displayName.charAt(0).toUpperCase()}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {/* Profile Info */}
                            <View className="flex-1 pt-1">
                                <Text className="text-xl font-bold text-txt-primary mb-3">{displayName}</Text>

                                <View className="flex-row gap-5 mb-2">
                                    <TouchableOpacity onPress={() => {
                                        if (backendUser?.id) {
                                            router.push({ pathname: '/user/followers/[userId]', params: { userId: backendUser.id, tab: 'following' } });
                                        }
                                    }}>
                                        <Text className="text-base text-txt-secondary">
                                            <Text className="font-semibold text-txt-primary">{followingCount}</Text> Following
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        if (backendUser?.id) {
                                            router.push({ pathname: '/user/followers/[userId]', params: { userId: backendUser.id, tab: 'followers' } });
                                        }
                                    }}>
                                        <Text className="text-base text-txt-secondary">
                                            <Text className="font-semibold text-txt-primary">{followerCount}</Text> Followers
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Add Cash Button */}
                                <TouchableOpacity
                                    className="flex-row items-center gap-1.5 px-3.5 py-[7px] bg-transparent rounded-full border-[1.5px] border-txt-primary self-start mt-1"
                                    onPress={() => {
                                        if (backendUser?.walletAddress) {
                                            fundWallet({ address: backendUser.walletAddress, amount: "0.2" });
                                        }
                                    }}
                                >
                                    <Ionicons name="add-circle-outline" size={18} color={Theme.textPrimary} />
                                    <Text className="text-[13px] font-semibold text-txt-primary">Add Cash</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Credit Card */}
                    <View className="mb-6">
                        <CreditCard
                            tradesCount={trades.length}
                            balance={0.00}
                            walletAddress={profileData?.walletAddress || backendUser?.walletAddress || ""}
                        />
                    </View>

                    {/* Trades Section */}
                    <View className="flex-1">
                        {/* Tab Header */}
                        <View className="flex-row mb-4 border-b border-border">
                            <TouchableOpacity
                                className="flex-1 items-center py-3 relative"
                                onPress={() => animateToTab('active')}
                            >
                                <Text className={`text-sm ${activeTab === 'active' ? 'font-semibold text-txt-primary' : 'font-medium text-txt-secondary'}`}>
                                    Active ({activeTrades.length})
                                </Text>
                                {activeTab === 'active' && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-txt-primary" />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 items-center py-3 relative"
                                onPress={() => animateToTab('previous')}
                            >
                                <Text className={`text-sm ${activeTab === 'previous' ? 'font-semibold text-txt-primary' : 'font-medium text-txt-secondary'}`}>
                                    Previous ({previousTrades.length})
                                </Text>
                                {activeTab === 'previous' && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-txt-primary" />}
                            </TouchableOpacity>
                        </View>

                        {/* Animated Sliding Lists */}
                        <View style={styles.listContainer}>
                            <Animated.View style={[styles.slidingContainer, { transform: [{ translateX: slideAnim }] }]}>
                                {/* Active Trades */}
                                <View style={styles.listPane}>
                                    {activeTrades.length === 0 ? (
                                        <View className="p-10 items-center gap-3">
                                            <Ionicons name="bar-chart-outline" size={32} color={Theme.textDisabled} />
                                            <Text className="text-sm text-txt-disabled">No active trades</Text>
                                        </View>
                                    ) : (
                                        <View className="bg-app-card rounded-xl overflow-hidden border border-border">
                                            {activeTrades.map((trade) => (
                                                <TradeItem
                                                    key={trade.id}
                                                    trade={trade}
                                                    onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: trade.marketTicker } })}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* Previous Trades */}
                                <View style={styles.listPane}>
                                    {previousTrades.length === 0 ? (
                                        <View className="p-10 items-center gap-3">
                                            <Ionicons name="time-outline" size={32} color={Theme.textDisabled} />
                                            <Text className="text-sm text-txt-disabled">No previous trades</Text>
                                        </View>
                                    ) : (
                                        <View className="bg-app-card rounded-xl overflow-hidden border border-border">
                                            {previousTrades.map((trade) => (
                                                <TradeItem
                                                    key={trade.id}
                                                    trade={trade}
                                                    onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: trade.marketTicker } })}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </Animated.View>
                        </View>
                    </View>

                    <View className="h-20" />
                </ScrollView>
            </SafeAreaView>

            <SettingsSheet
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                onSwitchTheme={() => console.log("Switch theme clicked")}
                onLogout={handleLogout}
            />
        </View>
    );
}

// Minimal styles for animated components requiring exact dimensions
const styles = StyleSheet.create({
    listContainer: {
        width: SCREEN_WIDTH - 40,
        overflow: 'hidden',
    },
    slidingContainer: {
        flexDirection: 'row',
        width: (SCREEN_WIDTH - 40) * 2,
    },
    listPane: {
        width: SCREEN_WIDTH - 40,
    },
});
