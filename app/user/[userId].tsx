import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails } from "@/lib/api";
import { Market, Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Theme constants
const ACCENT = '#3FE3FF';
const BG_MAIN = '#000000';
const BG_CARD = '#111827';
const BG_ELEVATED = '#161C24';
const BORDER = '#1F2937';
const TEXT_PRIMARY = '#E5E7EB';
const TEXT_SECONDARY = '#9CA3AF';
const TEXT_DISABLED = '#6B7280';
const SUCCESS = '#4ade80';
const ERROR = '#f87171';

type TabType = 'active' | 'history';

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

    const renderTradeItem = ({ item }: { item: TradeWithMarket }) => {
        const isYes = item.side === 'yes';
        const market = item.marketDetails;
        const subtitle = isYes ? market?.yesSubTitle : market?.noSubTitle;
        const currentPrice = isYes ? market?.yesAsk : market?.noAsk;
        const hasQuote = item.quote && item.quote.trim().length > 0;

        return (
            <TouchableOpacity
                style={styles.tradeItem}
                onPress={() => router.push({
                    pathname: '/market/[ticker]',
                    params: { ticker: item.marketTicker }
                })}
                activeOpacity={0.75}
            >
                <View style={styles.tradeHeader}>
                    <View style={[
                        styles.sideBadge,
                        isYes ? styles.sideBadgeYes : styles.sideBadgeNo
                    ]}>
                        <Text style={[
                            styles.sideText,
                            isYes ? styles.sideTextYes : styles.sideTextNo
                        ]}>
                            {item.side.toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.tradeAmount}>${parseFloat(item.amount).toFixed(2)}</Text>
                    {currentPrice && (
                        <View style={styles.priceTag}>
                            <Text style={styles.priceText}>@{(parseFloat(currentPrice) * 100).toFixed(0)}¢</Text>
                        </View>
                    )}
                </View>

                {hasQuote && (
                    <View style={styles.quoteBox}>
                        <Ionicons name="chatbubble" size={12} color={ACCENT} style={{ marginTop: 1 }} />
                        <Text style={styles.quoteTextProfile} numberOfLines={2}>{item.quote}</Text>
                    </View>
                )}

                {subtitle && (
                    <Text style={styles.tradeSubtitle} numberOfLines={1}>{subtitle}</Text>
                )}

                {market?.title ? (
                    <Text style={styles.tradeTitle} numberOfLines={2}>{market.title}</Text>
                ) : (
                    <Text style={styles.tradeTicker} numberOfLines={1}>{item.marketTicker}</Text>
                )}

                <View style={styles.tradeFooter}>
                    <Text style={styles.tradeDate}>
                        {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    {market?.volume && (
                        <>
                            <Text style={styles.tradeDot}>•</Text>
                            <Text style={styles.tradeVolume}>${(market.volume / 1000).toFixed(0)}K vol</Text>
                        </>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={TEXT_DISABLED} style={{ marginLeft: 'auto' }} />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={[BG_MAIN, '#0D1117', BG_CARD]} style={styles.gradient} />
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
                <LinearGradient colors={[BG_MAIN, '#0D1117', BG_CARD]} style={styles.gradient} />
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
    const username = `@${(profile.displayName || profile.walletAddress.slice(0, 6)).toLowerCase().replace(/\s/g, '')}`;
    const joinedDate = (profile as any).createdAt
        ? new Date((profile as any).createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : undefined;

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
    const displayedTrades = activeTab === 'active' ? activeTrades : historyTrades;

    return (
        <View style={styles.container}>
            <LinearGradient colors={[BG_MAIN, '#0D1117', BG_CARD]} style={styles.gradient} />

            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                    {/* Different from your own profile: back + share top bar */}
                    <View style={styles.topRow}>
                        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
                            <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
                        </TouchableOpacity>
                        <Text style={styles.screenTitle} numberOfLines={1}>{displayName}</Text>
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={() => Share.share({
                                message: `${displayName} on Hunch\n${profile.walletAddress}`,
                            })}
                        >
                            <Ionicons name="share-outline" size={18} color={TEXT_SECONDARY} />
                        </TouchableOpacity>
                    </View>

                    {/* Header section: similar “profile” vibe, but simplified */}
                    <View style={styles.otherProfileHeader}>
                        <View style={styles.identityRow}>
                            <View style={styles.avatarContainer}>
                                <LinearGradient
                                    colors={[ACCENT, '#00B8D4', '#0091EA']}
                                    style={styles.avatarGlow}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <View style={styles.avatarInner}>
                                    {profile.avatarUrl ? (
                                        <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                                    ) : (
                                        <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.nameBlock}>
                                <Text style={styles.name}>{displayName}</Text>
                                <Text style={styles.username}>{username}</Text>
                                <Text style={styles.walletAddress} numberOfLines={1}>
                                    {profile.walletAddress.slice(0, 8)}...{profile.walletAddress.slice(-6)}
                                </Text>
                            </View>

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
                                        <ActivityIndicator size="small" color={isFollowing ? TEXT_PRIMARY : BG_MAIN} />
                                    ) : (
                                        <Text style={[
                                            styles.followPillText,
                                            isFollowing && styles.followingPillText
                                        ]}>
                                            {isFollowing ? "Following" : "Follow"}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

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

                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Ionicons name="swap-horizontal-outline" size={14} color={TEXT_DISABLED} />
                                <Text style={styles.metaText}>{trades.length} trades</Text>
                            </View>
                            {!!joinedDate && (
                                <View style={styles.metaItem}>
                                    <Ionicons name="calendar-outline" size={14} color={TEXT_DISABLED} />
                                    <Text style={styles.metaText}>Joined {joinedDate}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Trades section with simple tabs (like profile, but no slider) */}
                    <View style={styles.tradesSection}>
                        <View style={styles.tabHeader}>
                            <TouchableOpacity style={styles.tabHeaderItem} onPress={() => setActiveTab('active')}>
                                <Text style={[
                                    styles.tabHeaderLabel,
                                    activeTab === 'active' && styles.tabHeaderLabelActive
                                ]}>
                                    Active ({activeTrades.length})
                                </Text>
                                {activeTab === 'active' && <View style={styles.tabHeaderIndicator} />}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.tabHeaderItem} onPress={() => setActiveTab('history')}>
                                <Text style={[
                                    styles.tabHeaderLabel,
                                    activeTab === 'history' && styles.tabHeaderLabelActive
                                ]}>
                                    History ({historyTrades.length})
                                </Text>
                                {activeTab === 'history' && <View style={styles.tabHeaderIndicator} />}
                            </TouchableOpacity>
                        </View>

                        {tradesLoading ? (
                            <View style={styles.tradesLoading}>
                                <ActivityIndicator size="small" color={ACCENT} />
                            </View>
                        ) : displayedTrades.length === 0 ? (
                            <View style={styles.emptyTrades}>
                                <Ionicons
                                    name={activeTab === 'active' ? "bar-chart-outline" : "time-outline"}
                                    size={44}
                                    color={TEXT_DISABLED}
                                />
                                <Text style={styles.emptyText}>
                                    {activeTab === 'active' ? "No active trades" : "No trade history"}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={displayedTrades}
                                keyExtractor={(item) => item.id}
                                renderItem={renderTradeItem}
                                scrollEnabled={false}
                                contentContainerStyle={styles.tradesList}
                            />
                        )}
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
    gradient: {
        ...StyleSheet.absoluteFillObject,
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
        paddingTop: 14,
        paddingBottom: 8,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: BG_CARD,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER,
    },
    screenTitle: {
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 12,
        fontSize: 16,
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButtonHeader: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: BG_CARD,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
    headerSpacer: {
        width: 40,
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
    errorText: {
        color: ERROR,
        fontSize: 16,
        marginTop: 16,
        marginBottom: 12,
        textAlign: 'center',
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
    // Other-user header (similar to profile tab, but distinct/compact)
    otherProfileHeader: {
        marginTop: 8,
        marginBottom: 18,
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    avatarContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        position: 'relative',
    },
    avatarGlow: {
        position: 'absolute',
        width: 64,
        height: 64,
        borderRadius: 32,
        opacity: 0.28,
    },
    avatarInner: {
        position: 'absolute',
        top: 2,
        left: 2,
        right: 2,
        bottom: 2,
        borderRadius: 30,
        backgroundColor: BG_CARD,
        borderWidth: 1,
        borderColor: BORDER,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
    },
    nameBlock: {
        flex: 1,
    },
    name: {
        fontSize: 20,
        fontWeight: '800',
        color: TEXT_PRIMARY,
        letterSpacing: -0.4,
    },
    username: {
        fontSize: 13,
        color: TEXT_SECONDARY,
        marginTop: 2,
    },
    followPill: {
        backgroundColor: ACCENT,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 96,
    },
    followingPill: {
        backgroundColor: BG_ELEVATED,
        borderWidth: 1,
        borderColor: BORDER,
    },
    followPillText: {
        color: BG_MAIN,
        fontSize: 14,
        fontWeight: '800',
    },
    followingPillText: {
        color: TEXT_PRIMARY,
    },
    followRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 14,
    },
    followText: {
        fontSize: 14,
        color: TEXT_SECONDARY,
    },
    followCount: {
        color: TEXT_PRIMARY,
        fontWeight: '800',
    },
    metaRow: {
        flexDirection: 'row',
        gap: 14,
        marginTop: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        color: TEXT_DISABLED,
        fontSize: 12,
        fontWeight: '500',
    },
    profileCard: {
        margin: 20,
        padding: 20,
        backgroundColor: BG_CARD,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
    },
    profileHeader: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: ACCENT,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(63, 227, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: ACCENT,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: ACCENT,
    },
    profileInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    displayName: {
        fontSize: 20,
        fontWeight: '700',
        color: TEXT_PRIMARY,
        marginBottom: 4,
    },
    walletAddress: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        fontFamily: 'monospace',
        marginBottom: 12,
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },
    statLabel: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: BORDER,
    },
    followButton: {
        backgroundColor: ACCENT,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    followingButton: {
        backgroundColor: BG_ELEVATED,
        borderWidth: 1,
        borderColor: BORDER,
    },
    followButtonText: {
        color: BG_MAIN,
        fontSize: 15,
        fontWeight: '700',
    },
    followingButtonText: {
        color: TEXT_PRIMARY,
    },
    statsCard: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(63, 227, 255, 0.2)',
    },
    statsGradient: {
        padding: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statsCol: {
        alignItems: 'center',
    },
    statsLabel: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    statsValue: {
        fontSize: 24,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },
    statsValueNegative: {
        color: ERROR,
    },
    tradesSection: {
        marginBottom: 24,
    },
    tabHeader: {
        flexDirection: 'row',
        gap: 20,
        paddingTop: 6,
        paddingBottom: 12,
    },
    tabHeaderItem: {
        paddingBottom: 8,
    },
    tabHeaderLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: TEXT_SECONDARY,
    },
    tabHeaderLabelActive: {
        color: TEXT_PRIMARY,
    },
    tabHeaderIndicator: {
        height: 2,
        width: 24,
        borderRadius: 2,
        backgroundColor: ACCENT,
        marginTop: 8,
    },
    tradesLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyTrades: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: TEXT_DISABLED,
        fontSize: 14,
        marginTop: 12,
    },
    tradesList: {
        gap: 12,
    },
    tradeItem: {
        backgroundColor: BG_CARD,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: BORDER,
    },
    tradeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    quoteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(63, 227, 255, 0.06)',
        borderLeftWidth: 2,
        borderLeftColor: ACCENT,
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    quoteTextProfile: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        color: TEXT_SECONDARY,
        fontStyle: 'italic',
    },
    quoteBox: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'rgba(63, 227, 255, 0.06)',
        borderLeftWidth: 2,
        borderLeftColor: ACCENT,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    quoteTextProfile: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: TEXT_PRIMARY,
        fontStyle: 'italic',
    },
    tradeSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: ACCENT,
        marginBottom: 6,
    },
    tradeTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_PRIMARY,
        lineHeight: 20,
        marginBottom: 10,
    },
    tradeFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tradeDot: {
        color: TEXT_DISABLED,
        fontSize: 12,
    },
    tradeVolume: {
        fontSize: 11,
        color: TEXT_DISABLED,
        fontWeight: '500',
    },
    priceTag: {
        marginLeft: 'auto',
        backgroundColor: BG_ELEVATED,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: BORDER,
    },
    priceText: {
        fontSize: 11,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },
    tradeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    sideBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    sideBadgeYes: {
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
    },
    sideBadgeNo: {
        backgroundColor: 'rgba(248, 113, 113, 0.15)',
    },
    sideText: {
        fontSize: 10,
        fontWeight: '700',
    },
    sideTextYes: {
        color: SUCCESS,
    },
    sideTextNo: {
        color: ERROR,
    },
    tradeDate: {
        fontSize: 11,
        color: TEXT_DISABLED,
    },
    tradeTicker: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
    tradeInfo: {
        flex: 1,
    },
    tradeRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tradeAmount: {
        fontSize: 15,
        fontWeight: '800',
        color: ACCENT,
    },
});

