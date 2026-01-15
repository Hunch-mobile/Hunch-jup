import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails } from "@/lib/api";
import { Market, Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'active' | 'previous';

interface TradeWithMarket extends Trade {
    marketDetails?: Market;
}

// Trade item component
const TradeItem = ({ trade, onPress }: { trade: TradeWithMarket; onPress: () => void }) => (
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

export default function UserProfileScreen() {
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { backendUser: currentUser } = useUser();

    const [profile, setProfile] = useState<User | null>(null);
    const [trades, setTrades] = useState<TradeWithMarket[]>([]);
    const [loading, setLoading] = useState(true);
    const [tradesLoading, setTradesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('active');

    const slideAnim = useRef(new Animated.Value(0)).current;

    const animateToTab = useCallback((tab: TabType) => {
        Animated.spring(slideAnim, {
            toValue: tab === 'active' ? 0 : -SCREEN_WIDTH + 40,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
        setActiveTab(tab);
    }, [slideAnim]);

    const isOwnProfile = currentUser?.id === userId;

    useEffect(() => {
        if (userId) {
            loadProfile();
            loadTrades();
            if (currentUser && !isOwnProfile) checkFollowStatus();
        }
    }, [userId, currentUser]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getUser(userId as string);
            setProfile(data);
        } catch (err: any) {
            console.error("Failed to fetch profile:", err);
            setError(err.message || "Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const loadTrades = async () => {
        try {
            setTradesLoading(true);
            const data = await api.getUserTrades(userId as string, 50);
            setTrades(data);
            data.forEach(async (trade, index) => {
                const marketDetails = await getMarketDetails(trade.marketTicker);
                if (marketDetails) {
                    setTrades(prev => {
                        const updated = [...prev];
                        updated[index] = { ...updated[index], marketDetails };
                        return updated;
                    });
                }
            });
        } catch (err) {
            console.error("Failed to fetch trades:", err);
        } finally {
            setTradesLoading(false);
        }
    };

    const checkFollowStatus = async () => {
        if (!currentUser) return;
        try {
            const following = await api.getFollowing(currentUser.id);
            setIsFollowing(following.some(f => f.followingId === userId));
        } catch (err) {
            console.error("Failed to check follow status:", err);
        }
    };

    const handleFollow = async () => {
        if (!currentUser || isOwnProfile || followLoading) return;
        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setFollowLoading(true);
        try {
            if (wasFollowing) {
                await api.unfollowUser(currentUser.id, userId as string);
                setProfile(prev => prev ? { ...prev, followerCount: Math.max(0, prev.followerCount - 1) } : prev);
            } else {
                await api.followUser(currentUser.id, userId as string);
                setProfile(prev => prev ? { ...prev, followerCount: prev.followerCount + 1 } : prev);
            }
        } catch (error) {
            console.error("Failed to follow/unfollow:", error);
            setIsFollowing(wasFollowing);
        } finally {
            setFollowLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-app-bg">
                <SafeAreaView className="flex-1">
                    <View className="flex-1 justify-center items-center px-10">
                        <ActivityIndicator size="large" color={Theme.accentSubtle} />
                        <Text className="text-txt-secondary text-sm mt-3">Loading profile...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    if (error || !profile) {
        return (
            <View className="flex-1 bg-app-bg">
                <SafeAreaView className="flex-1">
                    <TouchableOpacity className="flex-row items-center gap-2 p-5" onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Theme.textPrimary} />
                        <Text className="text-txt-primary text-base font-medium">Back</Text>
                    </TouchableOpacity>
                    <View className="flex-1 justify-center items-center px-10">
                        <Ionicons name="alert-circle-outline" size={64} color={Theme.error} />
                        <Text className="text-status-error text-base mt-4 mb-3 text-center">{error || "User not found"}</Text>
                        <TouchableOpacity className="bg-app-card py-2.5 px-5 rounded-lg" onPress={loadProfile}>
                            <Text className="text-txt-primary text-sm font-semibold">Retry</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    const displayName = profile.displayName || `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`;
    const profileImageUrl = profile.avatarUrl?.replace('_normal', '');

    const now = new Date();
    const activeTrades = trades.filter(trade => {
        const hoursDiff = (now.getTime() - new Date(trade.createdAt).getTime()) / (1000 * 60 * 60);
        return hoursDiff < 24;
    });
    const historyTrades = trades.filter(trade => {
        const hoursDiff = (now.getTime() - new Date(trade.createdAt).getTime()) / (1000 * 60 * 60);
        return hoursDiff >= 24;
    });

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between pt-4 pb-5">
                        <TouchableOpacity className="justify-center items-center" onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={24} color={Theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="justify-center items-center"
                            onPress={() => Share.share({ message: `${displayName} on Hunch\n${profile.walletAddress}` })}
                        >
                            <Ionicons name="share-outline" size={20} color={Theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Profile Row */}
                    <View className="flex-row items-start gap-4 mb-4">
                        {/* Avatar */}
                        <View className="w-14 h-14 rounded-full bg-app-card justify-center items-center overflow-hidden">
                            {profileImageUrl ? (
                                <Image source={{ uri: profileImageUrl }} className="w-full h-full rounded-full" contentFit="cover" />
                            ) : (
                                <Text className="text-[22px] font-bold text-txt-primary">
                                    {displayName.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>

                        {/* Info */}
                        <View className="flex-1 pt-1">
                            <View className="flex-row items-center justify-between mb-2.5 gap-3">
                                <Text className="text-xl font-bold text-txt-primary flex-1" numberOfLines={1}>{displayName}</Text>

                                {!isOwnProfile && currentUser && (
                                    <TouchableOpacity
                                        className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.5px] ${isFollowing ? 'bg-txt-primary border-txt-primary' : 'bg-transparent border-txt-primary'
                                            }`}
                                        onPress={handleFollow}
                                        disabled={followLoading}
                                    >
                                        {followLoading ? (
                                            <ActivityIndicator size="small" color={Theme.textPrimary} />
                                        ) : (
                                            <Text className={`text-[13px] font-semibold ${isFollowing ? 'text-txt-inverse' : 'text-txt-primary'}`}>
                                                {isFollowing ? "Following" : "Follow"}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View className="flex-row gap-5">
                                <TouchableOpacity onPress={() => router.push({ pathname: '/user/followers/[userId]', params: { userId: userId as string, tab: 'following' } })}>
                                    <Text className="text-base text-txt-secondary">
                                        <Text className="font-semibold text-txt-primary">{profile.followingCount || 0}</Text> Following
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => router.push({ pathname: '/user/followers/[userId]', params: { userId: userId as string, tab: 'followers' } })}>
                                    <Text className="text-base text-txt-secondary">
                                        <Text className="font-semibold text-txt-primary">{profile.followerCount || 0}</Text> Followers
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View className="h-5" />

                    {/* Trades */}
                    <View className="flex-1">
                        {/* Tab Header */}
                        <View className="flex-row mb-4 border-b border-border">
                            <TouchableOpacity className="flex-1 items-center py-3 relative" onPress={() => animateToTab('active')}>
                                <Text className={`text-sm ${activeTab === 'active' ? 'font-semibold text-txt-primary' : 'font-medium text-txt-secondary'}`}>
                                    Active ({activeTrades.length})
                                </Text>
                                {activeTab === 'active' && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-txt-primary" />}
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-1 items-center py-3 relative" onPress={() => animateToTab('previous')}>
                                <Text className={`text-sm ${activeTab === 'previous' ? 'font-semibold text-txt-primary' : 'font-medium text-txt-secondary'}`}>
                                    Previous ({historyTrades.length})
                                </Text>
                                {activeTab === 'previous' && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-txt-primary" />}
                            </TouchableOpacity>
                        </View>

                        {/* Sliding Lists */}
                        <View style={styles.listContainer}>
                            <Animated.View style={[styles.slidingContainer, { transform: [{ translateX: slideAnim }] }]}>
                                {/* Active */}
                                <View style={styles.listPane}>
                                    {tradesLoading ? (
                                        <View className="py-10 items-center">
                                            <ActivityIndicator size="small" color={Theme.accentSubtle} />
                                        </View>
                                    ) : activeTrades.length === 0 ? (
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

                                {/* Previous */}
                                <View style={styles.listPane}>
                                    {tradesLoading ? (
                                        <View className="py-10 items-center">
                                            <ActivityIndicator size="small" color={Theme.accentSubtle} />
                                        </View>
                                    ) : historyTrades.length === 0 ? (
                                        <View className="p-10 items-center gap-3">
                                            <Ionicons name="time-outline" size={32} color={Theme.textDisabled} />
                                            <Text className="text-sm text-txt-disabled">No previous trades</Text>
                                        </View>
                                    ) : (
                                        <View className="bg-app-card rounded-xl overflow-hidden border border-border">
                                            {historyTrades.map((trade) => (
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
        </View>
    );
}

// Minimal styles for animated sliding
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
