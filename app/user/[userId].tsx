import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails, marketsApi } from "@/lib/api";
import { CandleData, Event, Market, Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const defaultProfileImage = require("@/assets/default.jpeg");

type TabType = 'active' | 'previous';


interface TradeWithMarket extends Trade {
    marketDetails?: Market;
}

// Helper functions for PnL calculations
const getPriceChange = (candles: CandleData[]) => {
    if (!candles || candles.length < 2) return null;
    const latest = candles[candles.length - 1];
    const first = candles[0];
    const change = latest.close - first.close;
    const changePercent = first.close > 0 ? (change / first.close) * 100 : 0;
    return {
        change,
        changePercent: changePercent.toFixed(1),
        isPositive: change >= 0,
        currentPrice: latest.close,
    };
};

const getEntryPnl = (candles: CandleData[], entryTimestamp: number, isYes: boolean) => {
    if (!candles || candles.length < 2) return null;
    const latest = candles[candles.length - 1];
    const entryIndex = candles.reduce((closestIndex, candle, index) => {
        const closestDiff = Math.abs(candles[closestIndex].timestamp - entryTimestamp);
        const currentDiff = Math.abs(candle.timestamp - entryTimestamp);
        return currentDiff < closestDiff ? index : closestIndex;
    }, 0);
    const entryPrice = candles[entryIndex]?.close;
    if (!Number.isFinite(entryPrice)) return null;
    const rawChange = latest.close - entryPrice;
    const adjustedChange = isYes ? rawChange : -rawChange;
    const changePercent = entryPrice > 0 ? (adjustedChange / entryPrice) * 100 : 0;
    return {
        change: adjustedChange,
        changePercent: changePercent.toFixed(1),
        isPositive: adjustedChange >= 0,
        currentPrice: latest.close,
        entryPrice,
    };
};

const formatBoughtTime = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const diffMs = startOfToday.getTime() - startOfCreated.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return 'week ago';
    if (diffDays < 21) return '2 weeks ago';
    if (diffDays < 30) return 'month ago';
    const months = Math.round(diffDays / 30);
    return months <= 1 ? 'month ago' : `${months} months ago`;
};

const formatShortDate = (createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// Premium Trade item component matching profile.tsx style
const TradeItem = ({
    trade,
    onPress,
    market,
    event,
    candles,
    showDetails = false,
}: {
    trade: TradeWithMarket;
    onPress: () => void;
    market?: Market | null;
    event?: Event | null;
    candles?: CandleData[] | null;
    showDetails?: boolean;
}) => {
    const isYes = trade.side === 'yes';
    const amountValue = Number(trade.amount);

    // Calculate PnL using market prices and trade quote
    let pnlInfo: { changePercent: string; isPositive: boolean } | null = null;

    // Get entry price from trade quote (in cents, 0-100)
    const entryPriceCents = trade.quote ? Number(trade.quote) : null;

    // Get current price from market (in cents, 0-100)
    const currentPriceCents = market
        ? (isYes ? Number(market.yesAsk || 0) : Number(market.noAsk || 0))
        : null;

    if (entryPriceCents && currentPriceCents && entryPriceCents > 0) {
        const priceDiff = currentPriceCents - entryPriceCents;
        const changePercent = (priceDiff / entryPriceCents) * 100;
        pnlInfo = {
            changePercent: changePercent.toFixed(1),
            isPositive: changePercent >= 0,
        };
    } else if (candles && candles.length >= 2) {
        // Fallback to candle-based calculation
        const entryTimestamp = Math.floor(new Date(trade.createdAt).getTime() / 1000);
        const candlePnl = getEntryPnl(candles, entryTimestamp, isYes) || getPriceChange(candles);
        if (candlePnl) {
            pnlInfo = {
                changePercent: candlePnl.changePercent,
                isPositive: candlePnl.isPositive,
            };
        }
    }

    const percentValue = pnlInfo ? Number(pnlInfo.changePercent) : NaN;
    const pnlDollar = Number.isFinite(percentValue) && Number.isFinite(amountValue)
        ? (amountValue * percentValue) / 100
        : NaN;
    const totalValue = Number.isFinite(pnlDollar) && Number.isFinite(amountValue)
        ? Math.max(amountValue + pnlDollar, 0)
        : amountValue;
    const pnlText = pnlInfo && Number.isFinite(pnlDollar)
        ? `${pnlInfo.isPositive ? '+' : ''}$${Math.abs(pnlDollar).toFixed(0)}`
        : '—';
    const pnlColor = pnlInfo ? (pnlInfo.isPositive ? '#22c55e' : '#ef4444') : Theme.textDisabled;
    const gradientColors = pnlInfo
        ? (pnlInfo.isPositive
            ? ['#ECFDF5', '#F0FDF4', '#FFFFFF'] as const
            : ['#FEF2F2', '#FFF1F2', '#FFFFFF'] as const)
        : (['#F8FAFC', '#FFFFFF', '#FFFFFF'] as const);

    return (
        <TouchableOpacity
            className="px-4 py-3"
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View>
                {showDetails && market === undefined && (
                    <Text className="text-[11px] text-txt-disabled mt-1">Loading market details...</Text>
                )}
                {showDetails && market === null && (
                    <Text className="text-[11px] text-txt-disabled mt-1">Market details unavailable</Text>
                )}
                {showDetails && market && (
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 18, padding: 14, borderWidth: 1, borderColor: Theme.border }}
                    >
                        <Text className="absolute right-4 top-3 text-xs text-txt-disabled">
                            {formatBoughtTime(trade.createdAt)}
                        </Text>

                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-2xl font-extrabold text-txt-primary">
                                ${Number.isFinite(totalValue) ? totalValue.toFixed(2) : parseFloat(trade.amount).toFixed(2)}
                            </Text>
                            <Text className={`text-2xl font-extrabold ${isYes ? 'text-green-500' : 'text-red-500'}`}>
                                {isYes ? 'Yes' : 'No'}
                            </Text>
                        </View>

                        <View className="flex-row items-center justify-between">
                            <Text className="text-base font-semibold text-txt-primary flex-1 pr-3" numberOfLines={2}>
                                {event?.title || market.title}
                            </Text>
                            <View className="w-10 h-10 rounded-md overflow-hidden border border-border">
                                <Image
                                    source={event?.imageUrl ? { uri: event.imageUrl } : defaultProfileImage}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            </View>
                        </View>

                        {(trade.side === 'yes' ? market.yesSubTitle : market.noSubTitle) ? (
                            <Text className="text-sm italic text-txt-secondary mt-1" numberOfLines={1}>
                                on {trade.side === 'yes' ? market.yesSubTitle : market.noSubTitle}
                            </Text>
                        ) : null}

                        <View className="flex-row items-end justify-between mt-3">
                            <Text className="text-xs text-txt-disabled">
                                {formatShortDate(trade.createdAt)}
                            </Text>
                            <Text className="text-xl font-bold" style={{ color: pnlColor }}>
                                {pnlText}
                            </Text>
                        </View>
                    </LinearGradient>
                )}
            </View>
        </TouchableOpacity>
    );
};

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
    const [eventDetailsByTicker, setEventDetailsByTicker] = useState<Record<string, Event | null>>({});
    const [candlesByTicker, setCandlesByTicker] = useState<Record<string, CandleData[]>>({});

    const slideAnim = useRef(new Animated.Value(0)).current;
    const loadedEventTickers = useRef(new Set<string>());
    const loadedCandleTickers = useRef(new Set<string>());

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

    // Load event details for trades
    useEffect(() => {
        const eventTickers = trades
            .map((trade) => trade.marketDetails?.eventTicker)
            .filter((ticker): ticker is string => !!ticker);
        const uniqueEventTickers = Array.from(new Set(eventTickers));
        const tickersToFetch = uniqueEventTickers.filter((ticker) => !loadedEventTickers.current.has(ticker));
        if (tickersToFetch.length === 0) return;

        let cancelled = false;
        const loadEvents = async () => {
            const results = await Promise.all(
                tickersToFetch.map(async (ticker) => ({
                    ticker,
                    event: await marketsApi.fetchEventDetails(ticker).catch(() => null),
                }))
            );
            if (cancelled) return;
            setEventDetailsByTicker((prev) => {
                const next = { ...prev };
                results.forEach(({ ticker, event }) => {
                    loadedEventTickers.current.add(ticker);
                    next[ticker] = event;
                });
                return next;
            });
        };
        loadEvents();
        return () => {
            cancelled = true;
        };
    }, [trades]);

    // Load candles for active trades
    useEffect(() => {
        const activeTradeTickers = trades
            .filter((trade) => trade.marketDetails?.status === 'active')
            .map((trade) => trade.marketTicker);
        const uniqueTickers = Array.from(new Set(activeTradeTickers));
        const tickersToFetch = uniqueTickers.filter((ticker) => !loadedCandleTickers.current.has(ticker));
        if (tickersToFetch.length === 0) return;

        let cancelled = false;
        const loadCandles = async () => {
            const endTs = Math.floor(Date.now() / 1000);
            const startTs = endTs - 7 * 24 * 60 * 60;
            const results = await Promise.all(
                tickersToFetch.map(async (ticker) => {
                    const trade = trades.find(t => t.marketTicker === ticker);
                    const market = trade?.marketDetails;
                    let marketMint = market?.yesMint;
                    if (!marketMint && market?.accounts) {
                        const accountValues = Object.values(market.accounts);
                        for (const account of accountValues) {
                            if (typeof account === 'object' && account?.yesMint) {
                                marketMint = account.yesMint;
                                break;
                            }
                        }
                    }
                    if (!marketMint) return { ticker, candles: [] as CandleData[] };
                    try {
                        const candles = await marketsApi.fetchCandlesticksByMint(marketMint, { startTs, endTs, periodInterval: 60 });
                        return { ticker, candles: candles || [] };
                    } catch (error) {
                        console.error("Failed to fetch candles for", ticker, error);
                        return { ticker, candles: [] as CandleData[] };
                    }
                })
            );
            if (cancelled) return;
            setCandlesByTicker((prev) => {
                const next = { ...prev };
                results.forEach(({ ticker, candles }) => {
                    loadedCandleTickers.current.add(ticker);
                    next[ticker] = candles;
                });
                return next;
            });
        };
        loadCandles();
        return () => {
            cancelled = true;
        };
    }, [trades]);

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
    // Use displayName directly - it already includes @ if present from backend
    const username = displayName;
    const profileImageUrl = profile.avatarUrl?.replace('_normal', '');

    // Filter trades based on market status - active markets = open positions, closed/resolved = previous
    const activeTrades = trades.filter(trade => {
        const market = trade.marketDetails;
        // If market details not yet loaded, assume active (will re-render when loaded)
        if (!market) return true;
        // Active if market is still open
        return market.status === 'active';
    });
    const historyTrades = trades.filter(trade => {
        const market = trade.marketDetails;
        // Only show in previous if we know the market is closed/resolved/finalized
        if (!market) return false;
        return market.status === 'finalized' || market.status === 'resolved' || market.status === 'closed';
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
                            onPress={() => Share.share({ message: `${username} on Hunch\n${profile.walletAddress}` })}
                        >
                            <Ionicons name="share-outline" size={20} color={Theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Profile Row */}
                    <View className="flex-row items-start gap-4 mb-4">
                        {/* Avatar */}
                        <View className="w-14 h-14 rounded-full bg-app-card justify-center items-center overflow-hidden">
                            <Image
                                source={profileImageUrl ? { uri: profileImageUrl } : defaultProfileImage}
                                style={{ width: '100%', height: '100%', borderRadius: 28 }}
                                contentFit="cover"
                            />
                        </View>

                        {/* Info */}
                        <View className="flex-1 pt-1">
                            <View className="flex-row items-center justify-between mb-2.5 gap-3">
                                <Text className="text-xl font-bold text-txt-primary flex-1" numberOfLines={1}>{username}</Text>

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
                                                    market={trade.marketDetails}
                                                    event={trade.marketDetails?.eventTicker
                                                        ? eventDetailsByTicker[trade.marketDetails.eventTicker]
                                                        : undefined}
                                                    candles={candlesByTicker[trade.marketTicker]}
                                                    showDetails
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
                                                    market={trade.marketDetails}
                                                    event={trade.marketDetails?.eventTicker
                                                        ? eventDetailsByTicker[trade.marketDetails.eventTicker]
                                                        : undefined}
                                                    showDetails
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
