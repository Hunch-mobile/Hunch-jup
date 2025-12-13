import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { User as BackendUser, Trade } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface FeedItem extends Trade {
    type: 'trade';
}

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
            const ids = new Set(following.map(f => f.followingId));
            setFollowingIds(ids);
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
            const items: FeedItem[] = trades.map(trade => ({
                ...trade,
                type: 'trade' as const,
            }));
            setFeedItems(items);
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
            const isFollowing = followingIds.has(userId);

            if (isFollowing) {
                await api.unfollowUser(backendUser.id, userId);
                setFollowingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(userId);
                    return newSet;
                });
            } else {
                await api.followUser(backendUser.id, userId);
                setFollowingIds(prev => new Set([...prev, userId]));
            }

            loadFeed();
        } catch (error) {
            console.error("Failed to follow/unfollow user:", error);
        } finally {
            setFollowingInProgress(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    };

    const isFollowingUser = (userId: string) => followingIds.has(userId);
    const isFollowingInProgress = (userId: string) => followingInProgress.has(userId);

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

    const renderSearchResult = ({ item }: { item: BackendUser }) => {
        const isFollowing = isFollowingUser(item.id);
        const inProgress = isFollowingInProgress(item.id);
        const isSelf = backendUser?.id === item.id;

        return (
            <TouchableOpacity
                style={styles.searchResultCard}
                onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.id } })}
                activeOpacity={0.7}
            >
                <View style={styles.searchResultAvatar}>
                    <LinearGradient
                        colors={['rgba(74, 222, 128, 0.3)', 'rgba(34, 197, 94, 0.1)']}
                        style={styles.avatarGradient}
                    />
                    <Text style={styles.searchResultAvatarText}>
                        {(item.displayName || item.walletAddress).charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.displayName || "Anonymous"}</Text>
                    <Text style={styles.searchResultWallet}>
                        {item.walletAddress.slice(0, 6)}...{item.walletAddress.slice(-4)}
                    </Text>
                    <View style={styles.userStatsRow}>
                        <Text style={styles.userStatText}>
                            <Text style={styles.userStatNumber}>{item.followerCount || 0}</Text> followers
                        </Text>
                        <Text style={styles.userStatDot}>•</Text>
                        <Text style={styles.userStatText}>
                            <Text style={styles.userStatNumber}>{item.followingCount || 0}</Text> following
                        </Text>
                    </View>
                </View>
                {!isSelf && (
                    <TouchableOpacity
                        style={[
                            styles.followButton,
                            isFollowing && styles.followingButton,
                            inProgress && styles.followButtonDisabled
                        ]}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleFollowUser(item.id);
                        }}
                        disabled={inProgress}
                    >
                        {inProgress ? (
                            <ActivityIndicator size="small" color={isFollowing ? "#fff" : "#4ade80"} />
                        ) : (
                            <Text style={[
                                styles.followButtonText,
                                isFollowing && styles.followingButtonText
                            ]}>
                                {isFollowing ? "Following" : "Follow"}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    const renderFeedItem = ({ item }: { item: FeedItem }) => {
        const isYes = item.side === 'yes';

        return (
            <TouchableOpacity
                style={styles.feedCard}
                onPress={() => {
                    if (item.user?.id) {
                        router.push({ pathname: '/user/[userId]', params: { userId: item.user.id } });
                    }
                }}
                activeOpacity={0.8}
            >
                {/* Card Header */}
                <View style={styles.feedCardHeader}>
                    <TouchableOpacity
                        style={styles.feedAvatarContainer}
                        onPress={() => {
                            if (item.user?.id) {
                                router.push({ pathname: '/user/[userId]', params: { userId: item.user.id } });
                            }
                        }}
                    >
                        <View style={styles.feedAvatar}>
                            <LinearGradient
                                colors={['rgba(74, 222, 128, 0.4)', 'rgba(34, 197, 94, 0.1)']}
                                style={styles.feedAvatarGradient}
                            />
                            <Text style={styles.feedAvatarText}>
                                {(item.user?.displayName || item.user?.walletAddress || "U").charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.feedHeaderInfo}>
                        <View style={styles.feedHeaderTop}>
                            <Text style={styles.feedUserName}>
                                {item.user?.displayName || "Anonymous"}
                            </Text>
                            <Text style={styles.feedUserHandle}>
                                @{item.user?.walletAddress?.slice(0, 6)}
                            </Text>
                        </View>
                        <Text style={styles.feedTime}>
                            {getTimeAgo(item.createdAt)}
                        </Text>
                    </View>
                </View>

                {/* Trade Action Card */}
                <View style={styles.tradeActionCard}>
                    <View style={styles.tradeActionLeft}>
                        <View style={[
                            styles.tradeSidePill,
                            isYes ? styles.tradeSidePillYes : styles.tradeSidePillNo
                        ]}>
                            <Ionicons
                                name={isYes ? "trending-up" : "trending-down"}
                                size={14}
                                color={isYes ? "#4ade80" : "#f87171"}
                            />
                            <Text style={[
                                styles.tradeSideText,
                                isYes ? styles.tradeSideTextYes : styles.tradeSideTextNo
                            ]}>
                                {isYes ? 'YES' : 'NO'}
                            </Text>
                        </View>
                        <Text style={styles.tradeAmount}>${item.amount}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.tradeMarketPill}
                        onPress={() => router.push({
                            pathname: '/market/[ticker]',
                            params: { ticker: item.marketTicker }
                        })}
                    >
                        <Text style={styles.tradeMarketText} numberOfLines={1}>
                            {item.marketTicker}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                </View>

                {/* Interaction Row */}
                <View style={styles.interactionRow}>
                    <TouchableOpacity style={styles.interactionBtn}>
                        <Ionicons name="heart-outline" size={18} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.interactionText}>12</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.interactionBtn}>
                        <Ionicons name="chatbubble-outline" size={17} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.interactionText}>4</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.interactionBtn}>
                        <Ionicons name="repeat-outline" size={18} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.interactionBtn}>
                        <Ionicons name="share-outline" size={17} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const searchHeight = searchAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 60],
    });

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#0a0a0f", "#0d0d14", "#111118"]}
                style={styles.gradient}
            />
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>Feed</Text>
                        <View style={styles.headerBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.headerBadgeText}>Live</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.searchButton, showSearch && styles.searchButtonActive]}
                        onPress={() => {
                            setShowSearch(!showSearch);
                            if (showSearch) {
                                setSearchQuery("");
                                setSearchResults([]);
                            }
                        }}
                    >
                        <Ionicons
                            name={showSearch ? "close" : "search"}
                            size={20}
                            color={showSearch ? "#4ade80" : "#fff"}
                        />
                    </TouchableOpacity>
                </View>

                {/* Animated Search Bar */}
                <Animated.View style={[styles.searchContainer, { height: searchHeight, opacity: searchAnimation }]}>
                    <View style={styles.searchInputWrapper}>
                        <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search users..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={searchQuery}
                            onChangeText={handleSearch}
                            autoFocus={showSearch}
                        />
                        {isSearching && <ActivityIndicator size="small" color="#4ade80" />}
                        {searchQuery.length > 0 && !isSearching && (
                            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>

                {showSearch && searchResults.length > 0 ? (
                    <FlatList
                        data={searchResults}
                        keyExtractor={(item) => item.id}
                        renderItem={renderSearchResult}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                ) : isLoadingFeed ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4ade80" />
                        <Text style={styles.loadingText}>Loading feed...</Text>
                    </View>
                ) : feedItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="people-outline" size={48} color="rgba(74, 222, 128, 0.3)" />
                        </View>
                        <Text style={styles.emptyTitle}>Your feed is empty</Text>
                        <Text style={styles.emptySubtext}>
                            Follow traders to see their activity here
                        </Text>
                        <TouchableOpacity
                            style={styles.discoverButton}
                            onPress={() => setShowSearch(true)}
                        >
                            <Ionicons name="search" size={18} color="#0a0a0f" />
                            <Text style={styles.discoverButtonText}>Discover Traders</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={feedItems}
                        keyExtractor={(item) => item.id}
                        renderItem={renderFeedItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshing={isLoadingFeed}
                        onRefresh={loadFeed}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0f",
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.5,
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4ade80',
    },
    headerBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4ade80',
    },
    searchButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    searchButtonActive: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    searchContainer: {
        paddingHorizontal: 20,
        overflow: 'hidden',
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 48,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
    },
    searchResultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    searchResultAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        backgroundColor: 'rgba(74, 222, 128, 0.08)',
    },
    avatarGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 26,
    },
    searchResultAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#4ade80',
    },
    searchResultInfo: {
        flex: 1,
    },
    searchResultName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 3,
    },
    searchResultWallet: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.4)',
        fontFamily: 'monospace',
        marginBottom: 6,
    },
    userStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userStatText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    userStatNumber: {
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    userStatDot: {
        color: 'rgba(255, 255, 255, 0.3)',
        marginHorizontal: 6,
    },
    followButton: {
        backgroundColor: 'rgba(74, 222, 128, 0.12)',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
        minWidth: 95,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followingButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    followButtonDisabled: {
        opacity: 0.6,
    },
    followButtonText: {
        color: '#4ade80',
        fontSize: 14,
        fontWeight: '600',
    },
    followingButtonText: {
        color: '#fff',
    },
    listContent: {
        paddingTop: 12,
        paddingBottom: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(74, 222, 128, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.5)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    discoverButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#4ade80',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 14,
    },
    discoverButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0a0a0f',
    },
    feedCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    feedCardHeader: {
        flexDirection: 'row',
        marginBottom: 14,
    },
    feedAvatarContainer: {
        marginRight: 12,
    },
    feedAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
    },
    feedAvatarGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 22,
    },
    feedAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4ade80',
    },
    feedHeaderInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    feedHeaderTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    feedUserName: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
        marginRight: 8,
    },
    feedUserHandle: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
    },
    feedTime: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 13,
    },
    tradeActionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
    },
    tradeActionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    tradeSidePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 12,
    },
    tradeSidePillYes: {
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
    },
    tradeSidePillNo: {
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
    },
    tradeSideText: {
        fontSize: 12,
        fontWeight: '700',
    },
    tradeSideTextYes: {
        color: '#4ade80',
    },
    tradeSideTextNo: {
        color: '#f87171',
    },
    tradeAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    tradeMarketPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    tradeMarketText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        marginRight: 8,
    },
    interactionRow: {
        flexDirection: 'row',
        gap: 24,
    },
    interactionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    interactionText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 13,
        fontWeight: '500',
    },
});
