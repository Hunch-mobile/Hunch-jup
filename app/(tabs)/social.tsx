import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails } from "@/lib/api";
import { User as BackendUser, Market, Trade } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface FeedItem extends Trade {
    type: 'trade';
    marketDetails?: Market;
    quote?: string | null;
}

// Search result row component
const SearchResultRow = ({
    item,
    isFollowing,
    inProgress,
    isSelf,
    onFollow,
    onPress
}: {
    item: BackendUser;
    isFollowing: boolean;
    inProgress: boolean;
    isSelf: boolean;
    onFollow: () => void;
    onPress: () => void;
}) => (
    <TouchableOpacity
        className="flex-row items-center py-3.5 px-5"
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View className="w-12 h-12 rounded-full justify-center items-center mr-3.5 bg-app-card border border-border">
            <Text className="text-lg font-semibold text-txt-primary">
                {(item.displayName || item.walletAddress).charAt(0).toUpperCase()}
            </Text>
        </View>
        <View className="flex-1">
            <Text className="text-base font-semibold text-txt-primary mb-0.5">
                {item.displayName || "Anonymous"}
            </Text>
            <Text className="text-[13px] text-txt-disabled font-mono mb-1.5">
                {item.walletAddress.slice(0, 6)}...{item.walletAddress.slice(-4)}
            </Text>
            <View className="flex-row items-center">
                <Text className="text-xs text-txt-secondary">
                    <Text className="font-semibold text-txt-primary">{item.followerCount || 0}</Text> followers
                </Text>
                <Text className="text-txt-disabled mx-1.5">•</Text>
                <Text className="text-xs text-txt-secondary">
                    <Text className="font-semibold text-txt-primary">{item.followingCount || 0}</Text> following
                </Text>
            </View>
        </View>
        {!isSelf && (
            <TouchableOpacity
                className={`py-2 px-[18px] rounded-md min-w-[90px] items-center justify-center ${isFollowing ? 'bg-app-bg border-[1.5px] border-txt-primary' : 'bg-txt-primary'
                    } ${inProgress ? 'opacity-60' : ''}`}
                onPress={(e) => { e.stopPropagation(); onFollow(); }}
                disabled={inProgress}
            >
                {inProgress ? (
                    <ActivityIndicator size="small" color={isFollowing ? Theme.textPrimary : Theme.accentSubtle} />
                ) : (
                    <Text className={`text-[13px] font-semibold ${isFollowing ? 'text-txt-primary' : 'text-txt-inverse'}`}>
                        {isFollowing ? "Following" : "Follow"}
                    </Text>
                )}
            </TouchableOpacity>
        )}
    </TouchableOpacity>
);

// Feed card component
const FeedCard = ({ item, onPress, onUserPress }: { item: FeedItem; onPress: () => void; onUserPress: () => void }) => {
    const isYes = item.side === 'yes';
    const market = item.marketDetails;
    const subtitle = isYes ? market?.yesSubTitle : market?.noSubTitle;
    const currentPrice = isYes ? market?.yesAsk : market?.noAsk;
    const hasQuote = item.quote && item.quote.trim().length > 0;

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <TouchableOpacity className="mx-5 mb-5 py-3" onPress={onPress} activeOpacity={0.8}>
            {/* Header */}
            <View className="flex-row mb-3.5">
                <TouchableOpacity className="mr-3" onPress={(e) => { e.stopPropagation(); onUserPress(); }}>
                    <View className="w-[42px] h-[42px] rounded-full justify-center items-center bg-app-card border border-border">
                        <Text className="text-base font-semibold text-txt-primary">
                            {(item.user?.displayName || item.user?.walletAddress || "U").charAt(0).toUpperCase()}
                        </Text>
                    </View>
                </TouchableOpacity>
                <View className="flex-1 justify-center">
                    <View className="flex-row items-center mb-0.5">
                        <Text className="text-txt-primary font-semibold text-[15px] mr-2">
                            {item.user?.displayName || "Anonymous"}
                        </Text>
                        <Text className="text-txt-disabled text-sm">
                            @{item.user?.walletAddress?.slice(0, 6)}
                        </Text>
                    </View>
                    <Text className="text-txt-disabled text-[13px]">{getTimeAgo(item.createdAt)}</Text>
                </View>
            </View>

            {/* Quote */}
            {hasQuote && (
                <View className="bg-app-card border-l-2 border-l-txt-primary rounded-lg p-3.5 mb-3 flex-row items-start gap-2.5">
                    <View className="mt-0.5">
                        <Ionicons name="chatbubble-outline" size={14} color={Theme.textSecondary} />
                    </View>
                    <Text className="flex-1 text-[15px] leading-[22px] text-txt-primary italic">{item.quote}</Text>
                </View>
            )}

            {/* Market Card */}
            <View className="bg-app-card rounded-2xl p-4 mb-3 border border-border">
                <View className="flex-row items-center gap-2.5 mb-3">
                    <View className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg ${isYes ? 'bg-txt-primary' : 'bg-app-bg border-[1.5px] border-txt-primary'}`}>
                        <Text className={`text-[11px] font-bold ${isYes ? 'text-txt-inverse' : 'text-txt-primary'}`}>
                            {isYes ? 'YES' : 'NO'}
                        </Text>
                    </View>
                    <Text className="text-xl font-bold text-txt-primary">${item.amount}</Text>
                    {currentPrice && (
                        <View className="ml-auto bg-app-elevated px-2.5 py-1.5 rounded-lg border border-border">
                            <Text className="text-[13px] font-bold text-txt-primary">
                                @{(parseFloat(currentPrice) * 100).toFixed(0)}¢
                            </Text>
                        </View>
                    )}
                </View>

                {subtitle && (
                    <View className="bg-cyan-500/10 px-2.5 py-1.5 rounded-lg mb-2.5 self-start">
                        <Text className="text-[13px] font-semibold" style={{ color: Theme.accentSubtle }} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    </View>
                )}

                {market?.title && (
                    <Text className="text-[15px] font-semibold text-txt-primary leading-[21px] mb-3" numberOfLines={2}>
                        {market.title}
                    </Text>
                )}

                {market && (
                    <View className="flex-row items-center gap-3">
                        {market.volume && (
                            <View className="flex-row items-center gap-1">
                                <Ionicons name="bar-chart-outline" size={12} color={Theme.textDisabled} />
                                <Text className="text-[11px] text-txt-disabled font-medium">
                                    ${(market.volume / 1000).toFixed(0)}K vol
                                </Text>
                            </View>
                        )}
                        {market.status && (
                            <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-md ${market.status === 'active' ? 'bg-green-500/15' : 'bg-gray-500/15'}`}>
                                <View className="w-1 h-1 rounded-full bg-txt-disabled" />
                                <Text className="text-[10px] font-semibold text-txt-disabled uppercase">{market.status}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Interactions */}
            <View className="flex-row gap-6">
                <TouchableOpacity className="flex-row items-center gap-1.5">
                    <Ionicons name="heart-outline" size={18} color={Theme.textDisabled} />
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-1.5">
                    <Ionicons name="chatbubble-outline" size={17} color={Theme.textDisabled} />
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-1.5">
                    <Ionicons name="share-outline" size={17} color={Theme.textDisabled} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

export default function SocialScreen() {
    const { backendUser } = useUser();
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BackendUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFeed, setIsLoadingFeed] = useState(true);
    const [showSearch, setShowSearch] = useState(false);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
    const [searchAnimation] = useState(new Animated.Value(0));

    useEffect(() => {
        loadFeed();
        loadFollowingList();
    }, [backendUser]);

    useEffect(() => {
        Animated.timing(searchAnimation, {
            toValue: showSearch ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [showSearch]);

    const loadFollowingList = async () => {
        if (!backendUser) return;
        try {
            const following = await api.getFollowing(backendUser.id);
            setFollowingIds(new Set(following.map(f => f.followingId)));
        } catch (error) {
            console.error("Failed to load following list:", error);
        }
    };

    const loadFeed = async () => {
        if (!backendUser) {
            setIsLoadingFeed(false);
            return;
        }
        try {
            const trades = await api.getFeed(backendUser.id, 50, 0);
            const items: FeedItem[] = trades.map(trade => ({ ...trade, type: 'trade' as const }));
            setFeedItems(items);
            items.forEach(async (item, index) => {
                const marketDetails = await getMarketDetails(item.marketTicker);
                if (marketDetails) {
                    setFeedItems(prev => {
                        const updated = [...prev];
                        updated[index] = { ...updated[index], marketDetails };
                        return updated;
                    });
                }
            });
        } catch (error) {
            console.error("Failed to load feed:", error);
        } finally {
            setIsLoadingFeed(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const results = await api.searchUsers(query);
            setSearchResults(results);
        } catch (error) {
            console.error("Failed to search users:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFollowUser = async (userId: string) => {
        if (!backendUser || followingInProgress.has(userId)) return;
        setFollowingInProgress(prev => new Set([...prev, userId]));
        try {
            if (followingIds.has(userId)) {
                await api.unfollowUser(backendUser.id, userId);
                setFollowingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
            } else {
                await api.followUser(backendUser.id, userId);
                setFollowingIds(prev => new Set([...prev, userId]));
            }
            loadFeed();
        } catch (error) {
            console.error("Failed to follow/unfollow user:", error);
        } finally {
            setFollowingInProgress(prev => { const s = new Set(prev); s.delete(userId); return s; });
        }
    };

    const searchHeight = searchAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 60],
    });

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-5 py-3 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3">
                        <Text className="text-[28px] font-bold text-txt-primary tracking-tight">Feed</Text>
                        <View className="flex-row items-center gap-1.5 bg-app-card px-2.5 py-1 rounded-full border border-border">
                            <View className="w-1.5 h-1.5 rounded-full bg-txt-primary" />
                            <Text className="text-xs font-semibold text-txt-primary">Live</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        className={`w-10 h-10 rounded-full justify-center items-center border ${showSearch ? 'bg-txt-primary border-txt-primary' : 'bg-app-card border-border'}`}
                        onPress={() => {
                            setShowSearch(!showSearch);
                            if (showSearch) { setSearchQuery(""); setSearchResults([]); }
                        }}
                    >
                        <Ionicons name={showSearch ? "close" : "search"} size={20} color={showSearch ? Theme.textInverse : Theme.textPrimary} />
                    </TouchableOpacity>
                </View>

                {/* Animated Search */}
                <Animated.View style={[styles.searchContainer, { height: searchHeight, opacity: searchAnimation }]}>
                    <View className="flex-row items-center bg-app-card rounded-[14px] px-3.5 h-12 gap-2.5 border border-border">
                        <Ionicons name="search" size={16} color={Theme.textDisabled} />
                        <TextInput
                            className="flex-1 text-txt-primary text-[15px]"
                            placeholder="Search users..."
                            placeholderTextColor={Theme.textDisabled}
                            value={searchQuery}
                            onChangeText={handleSearch}
                            autoFocus={showSearch}
                        />
                        {isSearching && <ActivityIndicator size="small" color={Theme.accentSubtle} />}
                        {searchQuery.length > 0 && !isSearching && (
                            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                                <Ionicons name="close-circle" size={18} color={Theme.textDisabled} />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>

                {showSearch && searchResults.length > 0 ? (
                    <FlatList
                        data={searchResults}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <SearchResultRow
                                item={item}
                                isFollowing={followingIds.has(item.id)}
                                inProgress={followingInProgress.has(item.id)}
                                isSelf={backendUser?.id === item.id}
                                onFollow={() => handleFollowUser(item.id)}
                                onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.id } })}
                            />
                        )}
                        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                    />
                ) : isLoadingFeed ? (
                    <View className="flex-1 justify-center items-center gap-3">
                        <ActivityIndicator size="large" color={Theme.accentSubtle} />
                        <Text className="text-sm text-txt-secondary">Loading feed...</Text>
                    </View>
                ) : feedItems.length === 0 ? (
                    <View className="flex-1 justify-center items-center px-10">
                        <View className="w-[88px] h-[88px] rounded-full bg-cyan-500/5 justify-center items-center mb-5">
                            <Ionicons name="people-outline" size={48} color={`${Theme.accentSubtle}50`} />
                        </View>
                        <Text className="text-xl font-semibold text-txt-primary mb-2">Your feed is empty</Text>
                        <Text className="text-[15px] text-txt-secondary text-center leading-[22px] mb-6">
                            Follow traders to see their activity here
                        </Text>
                        <TouchableOpacity
                            className="flex-row items-center gap-2 bg-txt-primary px-6 py-3.5 rounded-lg"
                            onPress={() => setShowSearch(true)}
                        >
                            <Ionicons name="search" size={18} color={Theme.bgMain} />
                            <Text className="text-[15px] font-semibold text-txt-inverse">Discover Traders</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={feedItems}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <FeedCard
                                item={item}
                                onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: item.marketTicker } })}
                                onUserPress={() => item.user?.id && router.push({ pathname: '/user/[userId]', params: { userId: item.user.id } })}
                            />
                        )}
                        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                        refreshing={isLoadingFeed}
                        onRefresh={loadFeed}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

// Minimal styles for animated components
const styles = StyleSheet.create({
    searchContainer: {
        paddingHorizontal: 20,
        overflow: 'hidden',
    },
});
