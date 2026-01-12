import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails } from "@/lib/api";
import { Market, Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Import theme from central location
import { Theme } from '@/constants/theme';

// Theme constants
const ACCENT = Theme.accentSubtle;
const BG_MAIN = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BG_ELEVATED = Theme.bgElevated;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;
const SUCCESS = Theme.success;
const ERROR = Theme.error;

type TabType = 'active' | 'previous';

interface TradeWithMarket extends Trade {
    marketDetails?: Market;
}

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

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;

    const animateToTab = useCallback((tab: TabType) => {
        const toValue = tab === 'active' ? 0 : -SCREEN_WIDTH + 40; // Adjust for padding
        Animated.spring(slideAnim, {
            toValue,
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
            if (currentUser && !isOwnProfile) {
                checkFollowStatus();
            }
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

            // Fetch market details for each trade in the background
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
                setProfile(prev => prev ? {
                    ...prev,
                    followerCount: Math.max(0, prev.followerCount - 1)
                } : prev);
            } else {
                await api.followUser(currentUser.id, userId as string);
                setProfile(prev => prev ? {
                    ...prev,
                    followerCount: prev.followerCount + 1
                } : prev);
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
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={ACCENT} />
                        <Text style={styles.loadingText}>Loading profile...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    if (error || !profile) {
        return (
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <View style={styles.centerContainer}>
                        <Ionicons name="alert-circle-outline" size={64} color={ERROR} />
                        <Text style={styles.errorText}>{error || "User not found"}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    const displayName = profile.displayName || `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`;

    // Use high-resolution image logic like the main profile view
    const profileImageUrl = profile.avatarUrl?.replace('_normal', '');

    // Like your profile screen: active = last 24h, history = older
    const now = new Date();
    const activeTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff < 24;
    });
    const historyTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff >= 24;
    });

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header Section: Back + Share */}
                    <View style={styles.topRow}>
                        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={24} color={TEXT_SECONDARY} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={() => Share.share({
                                message: `${displayName} on Hunch\n${profile.walletAddress}`,
                            })}
                        >
                            <Ionicons name="share-outline" size={20} color={TEXT_SECONDARY} />
                        </TouchableOpacity>
                    </View>

                    {/* Main Profile Row: Avatar + Info */}
                    <View style={styles.profileMainRow}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarWrapper}>
                                <View style={styles.avatarInner}>
                                    {profileImageUrl ? (
                                        <Image
                                            source={{ uri: profileImageUrl }}
                                            style={styles.avatarImage}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <Text style={styles.avatarText}>
                                            {displayName.charAt(0).toUpperCase()}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Info Section - Right of Avatar */}
                        <View style={styles.profileInfo}>
                            {/* Name + Follow Row */}
                            <View style={styles.nameFollowRow}>
                                <Text style={styles.name} numberOfLines={1}>{displayName}</Text>

                                {/* Follow Button - Outlined Style */}
                                {!isOwnProfile && currentUser && (
                                    <TouchableOpacity
                                        style={[
                                            styles.followPill,
                                            isFollowing && styles.followingPill
                                        ]}
                                        onPress={handleFollow}
                                        disabled={followLoading}
                                    >
                                        {followLoading ? (
                                            <ActivityIndicator size="small" color={Theme.textPrimary} />
                                        ) : (
                                            <>
                                                <Text style={[
                                                    styles.followPillText,
                                                    isFollowing && styles.followingPillText
                                                ]}>
                                                    {isFollowing ? "Following" : "Follow"}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Following / Followers */}
                            <View style={styles.followRow}>
                                <TouchableOpacity
                                    onPress={() => router.push({
                                        pathname: '/user/followers/[userId]',
                                        params: { userId: userId as string, tab: 'following' }
                                    })}
                                >
                                    <Text style={styles.followText}>
                                        <Text style={styles.followCount}>{profile.followingCount || 0}</Text> Following
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => router.push({
                                        pathname: '/user/followers/[userId]',
                                        params: { userId: userId as string, tab: 'followers' }
                                    })}
                                >
                                    <Text style={styles.followText}>
                                        <Text style={styles.followCount}>{profile.followerCount || 0}</Text> Followers
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Spacing after header */}
                    <View style={{ marginBottom: 20 }} />

                    {/* Trades Section with Sliding Tabs */}
                    <View style={styles.tradesSection}>
                        <View style={styles.tabHeader}>
                            <TouchableOpacity
                                style={styles.tabHeaderItem}
                                onPress={() => animateToTab('active')}
                            >
                                <Text style={[
                                    styles.tabHeaderLabel,
                                    activeTab === 'active' && styles.tabHeaderLabelActive
                                ]}>
                                    Active ({activeTrades.length})
                                </Text>
                                {activeTab === 'active' && <View style={styles.tabHeaderIndicator} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.tabHeaderItem}
                                onPress={() => animateToTab('previous')}
                            >
                                <Text style={[
                                    styles.tabHeaderLabel,
                                    activeTab === 'previous' && styles.tabHeaderLabelActive
                                ]}>
                                    Previous ({historyTrades.length})
                                </Text>
                                {activeTab === 'previous' && <View style={styles.tabHeaderIndicator} />}
                            </TouchableOpacity>
                        </View>

                        {/* Animated Sliding List Container */}
                        <View style={styles.listContainer}>
                            <Animated.View
                                style={[
                                    styles.slidingContainer,
                                    { transform: [{ translateX: slideAnim }] }
                                ]}
                            >
                                {/* Active Trades List */}
                                <View style={styles.listPane}>
                                    {tradesLoading ? (
                                        <View style={styles.tradesLoading}>
                                            <ActivityIndicator size="small" color={ACCENT} />
                                        </View>
                                    ) : activeTrades.length === 0 ? (
                                        <View style={styles.emptyTrades}>
                                            <Ionicons name="bar-chart-outline" size={32} color={TEXT_DISABLED} />
                                            <Text style={styles.emptyText}>No active trades</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.tradesList}>
                                            {activeTrades.map((trade) => (
                                                <TouchableOpacity
                                                    key={trade.id}
                                                    style={styles.tradeItem}
                                                    onPress={() => router.push({
                                                        pathname: '/market/[ticker]',
                                                        params: { ticker: trade.marketTicker }
                                                    })}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.tradeLeft}>
                                                        <View style={[
                                                            styles.tradeSideBadge,
                                                            trade.side === 'yes' ? styles.tradeSideBadgeYes : styles.tradeSideBadgeNo
                                                        ]}>
                                                            <Text style={[
                                                                styles.tradeSideText,
                                                                trade.side === 'yes' ? styles.tradeSideTextYes : styles.tradeSideTextNo
                                                            ]}>
                                                                {trade.side.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.tradeInfo}>
                                                            <Text style={styles.tradeTicker} numberOfLines={1}>
                                                                {trade.marketTicker}
                                                            </Text>
                                                            <Text style={styles.tradeDate}>
                                                                {new Date(trade.createdAt).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.tradeAmount}>
                                                        ${parseFloat(trade.amount).toFixed(2)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* Previous Trades List */}
                                <View style={styles.listPane}>
                                    {tradesLoading ? (
                                        <View style={styles.tradesLoading}>
                                            <ActivityIndicator size="small" color={ACCENT} />
                                        </View>
                                    ) : historyTrades.length === 0 ? (
                                        <View style={styles.emptyTrades}>
                                            <Ionicons name="time-outline" size={32} color={TEXT_DISABLED} />
                                            <Text style={styles.emptyText}>No previous trades</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.tradesList}>
                                            {historyTrades.map((trade) => (
                                                <TouchableOpacity
                                                    key={trade.id}
                                                    style={styles.tradeItem}
                                                    onPress={() => router.push({
                                                        pathname: '/market/[ticker]',
                                                        params: { ticker: trade.marketTicker }
                                                    })}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.tradeLeft}>
                                                        <View style={[
                                                            styles.tradeSideBadge,
                                                            trade.side === 'yes' ? styles.tradeSideBadgeYes : styles.tradeSideBadgeNo
                                                        ]}>
                                                            <Text style={[
                                                                styles.tradeSideText,
                                                                trade.side === 'yes' ? styles.tradeSideTextYes : styles.tradeSideTextNo
                                                            ]}>
                                                                {trade.side.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.tradeInfo}>
                                                            <Text style={styles.tradeTicker} numberOfLines={1}>
                                                                {trade.marketTicker}
                                                            </Text>
                                                            <Text style={styles.tradeDate}>
                                                                {new Date(trade.createdAt).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.tradeAmount}>
                                                        ${parseFloat(trade.amount).toFixed(2)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </Animated.View>
                        </View>
                    </View>

                    <View style={{ height: 80 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_MAIN,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        paddingBottom: 20,
    },
    headerBtn: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Profile Header Section
    profileMainRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 16,
    },
    profileInfo: {
        flex: 1,
        paddingTop: 4,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        position: 'relative',
    },
    avatarInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: BG_CARD,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },
    nameFollowRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 12,
    },
    name: {
        fontSize: 20,
        fontWeight: '700',
        color: TEXT_PRIMARY,
        flex: 1,
    },
    followRow: {
        flexDirection: 'row',
        gap: 20,
    },
    followText: {
        fontSize: 16,
        color: TEXT_SECONDARY,
    },
    followCount: {
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
    followPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'transparent',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: Theme.textPrimary,
    },
    followingPill: {
        backgroundColor: Theme.textPrimary,
    },
    followPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: Theme.textPrimary,
    },
    followingPillText: {
        color: Theme.textInverse,
    },

    // Trades Section
    tradesSection: {
        flex: 1,
    },
    tabHeader: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    tabHeaderItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    tabHeaderLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: TEXT_SECONDARY,
    },
    tabHeaderLabelActive: {
        color: TEXT_PRIMARY,
        fontWeight: '600',
    },
    tabHeaderIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: Theme.textPrimary,
    },
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
    tradesLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyTrades: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: TEXT_DISABLED,
    },
    tradesList: {
        backgroundColor: BG_CARD,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BORDER,
    },
    tradeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    tradeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    tradeSideBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 10,
    },
    tradeSideBadgeYes: {
        backgroundColor: Theme.textPrimary,
    },
    tradeSideBadgeNo: {
        backgroundColor: Theme.bgMain,
        borderWidth: 1.5,
        borderColor: Theme.textPrimary,
    },
    tradeSideText: {
        fontSize: 11,
        fontWeight: '700',
    },
    tradeSideTextYes: {
        color: Theme.textInverse,
    },
    tradeSideTextNo: {
        color: Theme.textPrimary,
    },
    tradeInfo: {
        flex: 1,
    },
    tradeTicker: {
        fontSize: 14,
        fontWeight: '500',
        color: TEXT_PRIMARY,
        marginBottom: 2,
    },
    tradeDate: {
        fontSize: 12,
        color: TEXT_DISABLED,
    },
    tradeAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingText: {
        color: TEXT_SECONDARY,
        fontSize: 14,
        marginTop: 12,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 20,
    },
    backText: {
        color: TEXT_PRIMARY,
        fontSize: 16,
        fontWeight: '500',
    },
    retryButton: {
        backgroundColor: BG_CARD,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryText: {
        color: TEXT_PRIMARY,
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        color: ERROR,
        fontSize: 16,
        marginTop: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
});
