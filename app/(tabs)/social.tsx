import LightChart from '@/components/LightChart';
import { MarketTradeSheet } from '@/components/MarketTradeSheet';
import NotificationSidebar from '@/components/NotificationSidebar';
import PostComposerSheet from '@/components/PostComposerSheet';
import { ListFooterSkeleton, SocialFeedSkeleton } from '@/components/skeletons';
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, followApi, marketsApi, polymarketApi } from "@/lib/api";
import { invertCandlesForNoSide } from "@/lib/marketUtils";
import { User as BackendUser, CandleData, Event, ExternalTrade, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clusterApiUrl, Connection } from "@solana/web3.js";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface ExternalFeedItem {
    id: string;
    conditionId: string;
    marketTitle: string;
    outcome: string;
    side: 'yes' | 'no';
    action: 'BUY' | 'SELL';
    usdcAmount: number;
    price: number;
    size: number;
    timestamp: string;
    transactionHash: string | null;
    trader: {
        walletAddress: string;
        displayName: string | null;
        avatarUrl: string | null;
        xUsername: string | null;
        verifiedBadge: boolean;
        followerCount?: number;
        cachedPnl?: number | null;
        isFollowing?: boolean;
    };
    marketDetails?: Market;
}

const mapExternalTrade = (t: ExternalTrade): ExternalFeedItem => ({
    id: t.id,
    conditionId: t.conditionId,
    marketTitle: t.marketTitle,
    outcome: t.outcome,
    side: 'yes', // conditionId IS the specific outcome token; candles always represent its probability
    action: t.side,
    usdcAmount: t.usdcAmount,
    price: t.price,
    size: t.size,
    timestamp: t.timestamp,
    transactionHash: t.transactionHash,
    trader: t.trader,
});

type SearchMarketItem =
    | { type: 'event'; event: Event }
    | { type: 'market'; market: Market; event?: Event };


const defaultProfileImage = require("@/assets/default.jpeg");
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Search result row component
const SearchResultRow = ({
    item,
    isFollowing,
    inProgress,
    isSelf,
    canFollow,
    onFollow,
    onPress
}: {
    item: BackendUser;
    isFollowing: boolean;
    inProgress: boolean;
    isSelf: boolean;
    canFollow: boolean;
    onFollow: () => void;
    onPress: () => void;
}) => {
    const avatarUrl = item.avatarUrl?.replace('_normal', '');
    const username = item.username || item.walletAddress || 'anon';
    const displayHandle = formatHandle(username);
    const displayName = item.displayName || "Anonymous";

    return (
        <TouchableOpacity
            className="flex-row items-center py-3.5 px-5"
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View className="w-12 h-12 rounded-full justify-center items-center mr-3.5 bg-app-card border border-border overflow-hidden">
                <Image
                    source={avatarUrl ? { uri: avatarUrl } : defaultProfileImage}
                    className="w-full h-full rounded-full"
                />
            </View>
            <View className="flex-1">
                <Text className="text-base font-semibold text-txt-primary mb-0.5">
                    {displayName}
                </Text>
                <Text className="text-[13px] text-txt-disabled font-mono mb-1.5">
                    {displayHandle}
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
            {!isSelf && canFollow && (
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
};

// Get price change from candles
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

// Chart dimensions for FeedCard
const FEED_CARD_CHART_WIDTH = SCREEN_WIDTH - 40 - 28; // mx-5 (40) + p-3.5 (28)
const FEED_CARD_CHART_HEIGHT = 72;

// Utility to condense long wallet addresses into manageable shorts
const formatHandle = (handle: string) => {
    if (handle.startsWith('0x') && handle.length >= 42) {
        return `${handle.slice(0, 6)}...${handle.slice(-4)}`;
    }
    return handle;
};

// Feed card component
const FeedCard = ({
    item,
    candles,
    onPress,
    onUserPress,
    onChartPress,
    onFollow,
    isFollowInProgress,
    isLoadingTrade,
}: {
    item: ExternalFeedItem;
    candles?: CandleData[];
    onPress: () => void;
    onUserPress: () => void;
    onChartPress: () => void;
    onFollow?: () => void;
    isFollowInProgress?: boolean;
    isLoadingTrade?: boolean;
}) => {
    const isYes = item.side === 'yes';
    const market = item.marketDetails;
    const subtitle = isYes ? market?.yesSubTitle : market?.noSubTitle;
    const avatarUrl = item.trader.avatarUrl?.replace('_normal', '');
    const totalBought = item.usdcAmount;
    const rawName = item.trader.displayName?.trim();
    const rawHandle = rawName ? rawName.replace(/^@+/, '') : item.trader.walletAddress || 'anonymous';
    const handle = formatHandle(rawHandle);
    const isSell = item.action === 'SELL';
    const isFollowing = item.trader.isFollowing;

    // Price change calculation from candles
    const entryTimestamp = Math.floor(new Date(item.timestamp).getTime() / 1000);
    const priceChange = candles ? (getEntryPnl(candles, entryTimestamp, isYes) || getPriceChange(candles)) : null;
    const chartCandles = useMemo(
        () => (isYes ? (candles || []) : invertCandlesForNoSide(candles || [])),
        [candles, isYes]
    );
    const pnlText = priceChange ? `${priceChange.isPositive ? '+' : ''}${priceChange.changePercent}%` : (isYes ? '+0.0%' : '-0.0%');
    const pnlColor = priceChange ? (priceChange.isPositive ? '#32de12' : '#FF10F0') : (isYes ? '#32de12' : '#FF10F0');
    const pnlPercentValue = priceChange ? Number(priceChange.changePercent) : NaN;
    const pnlDollar = Number.isFinite(pnlPercentValue) && Number.isFinite(totalBought)
        ? (totalBought * pnlPercentValue) / 100
        : NaN;
    const totalValue = Number.isFinite(pnlDollar) ? Math.max(totalBought + pnlDollar, 0) : totalBought;

    const formatValue = (value: number) => {
        if (!Number.isFinite(value)) return '0';
        const formatCompact = (val: number, suffix: string) => {
            const precision = val >= 10 ? 0 : 1;
            return `${val.toFixed(precision).replace(/\.0$/, '')}${suffix}`;
        };
        if (value >= 1_000_000) return formatCompact(value / 1_000_000, 'M');
        if (value >= 1_000) return formatCompact(value / 1_000, 'K');
        return value.toFixed(1).replace(/\.0$/, '');
    };

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

    const marketLabel = item.marketTitle || market?.title || `0x…${item.conditionId.slice(-6)}`;
    const eventLabel = market?.subtitle || 'Polymarket';

    return (
        <TouchableOpacity
            className="mx-5 mb-5"
            onPress={isLoadingTrade ? undefined : onChartPress}
            activeOpacity={isLoadingTrade ? 1 : 0.9}
        >
            {/* Header */}
            <View className="flex-row items-center mb-2">
                <TouchableOpacity className="mr-3" onPress={(e) => { e.stopPropagation(); onUserPress(); }}>
                    <View className="w-[38px] h-[38px] rounded-full justify-center items-center bg-app-card border border-border overflow-hidden">
                        <Image
                            source={avatarUrl ? { uri: avatarUrl } : defaultProfileImage}
                            className="w-full h-full rounded-full"
                        />
                    </View>
                </TouchableOpacity>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-1.5 flex-1 mr-2" style={{ flexWrap: 'wrap' }}>
                            <Text className="text-txt-primary font-bold text-[14px]" numberOfLines={1}>
                                {handle}
                                {item.trader.verifiedBadge ? ' ✓' : ''}
                            </Text>
                            <Text style={{ color: isSell ? '#FF10F0' : '#32de12', fontWeight: '800', fontSize: 14 }}>
                                {isSell ? 'sold' : 'bought'}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            {onFollow && (
                                <TouchableOpacity
                                    className={`py-1 px-3 rounded-full border ${isFollowing ? 'border-txt-primary bg-transparent' : 'bg-txt-primary border-txt-primary'} ${isFollowInProgress ? 'opacity-60' : ''}`}
                                    onPress={(e) => { e.stopPropagation(); onFollow(); }}
                                    disabled={isFollowInProgress}
                                >
                                    {isFollowInProgress ? (
                                        <ActivityIndicator size="small" color={isFollowing ? Theme.textPrimary : Theme.bgMain} />
                                    ) : (
                                        <Text className={`text-[11px] font-semibold ${isFollowing ? 'text-txt-primary' : 'text-txt-inverse'}`}>
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            <Text className="text-txt-disabled text-[13px]">{getTimeAgo(item.timestamp)}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Market Card */}
            <View className="bg-white rounded-[24px] p-3.5 border border-[#E8E8E8] shadow-sm" style={{ opacity: isLoadingTrade ? 0.6 : 1 }}>
                {isLoadingTrade && (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.5)' }}>
                        <ActivityIndicator size="small" color="#6b7280" />
                    </View>
                )}
                <View className="flex-row items-center gap-3 mb-3.5">
                    <Text
                        className={`font-black ${item.outcome === 'No' ? 'text-[#FF10F0]' : 'text-[#32de12]'}`}
                        style={{ fontFamily: 'BBHSansHegarty', fontSize: item.outcome.length > 6 ? 18 : 32 }}
                        numberOfLines={2}
                    >
                        {item.outcome === 'Yes' ? 'YES' : item.outcome === 'No' ? 'NO' : item.outcome.toUpperCase()}
                    </Text>
                    <Text className="text-[14px] text-txt-disabled">on</Text>
                    <View className="flex-1 border border-[#E6E6E6] rounded-xl px-2.5 py-2">
                        <Text className="text-[15px] font-semibold text-[#111827]" numberOfLines={1}>
                            {marketLabel}
                        </Text>
                        <Text className="text-[12px] text-[#6b7280]" numberOfLines={1}>
                            {eventLabel}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    className="h-[72px] rounded-xl overflow-hidden mb-4"
                    activeOpacity={0.9}
                    onPress={(event) => {
                        event?.stopPropagation?.();
                        onChartPress();
                    }}
                >
                    {chartCandles && chartCandles.length > 0 ? (
                        <LightChart
                            candles={chartCandles}
                            width={FEED_CARD_CHART_WIDTH}
                            height={FEED_CARD_CHART_HEIGHT}
                            colorByTrend={true}
                            entryTimestamp={entryTimestamp}
                            entryAvatarUri={avatarUrl || undefined}
                        />
                    ) : (
                        <View className="flex-1 justify-center items-center gap-1.5">
                            <Ionicons name="analytics-outline" size={16} color="#9ca3af" />
                            <Text className="text-[10px] text-gray-400">No data available</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View className="flex-row items-center">
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">Total Bought</Text>
                        <Text className="text-[16px] font-semibold text-[#111827]">${formatValue(totalBought)}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">PNL</Text>
                        <Text className="text-[14px] font-semibold" style={{ color: pnlColor }}>{pnlText}</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">Total Value</Text>
                        <Text className="text-[16px] font-semibold text-[#111827]">${formatValue(totalValue)}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};



export default function SocialScreen() {
    const { backendUser, deductBalance, addOptimisticPosition } = useUser();
    const { wallets } = useEmbeddedSolanaWallet();
    const insets = useSafeAreaInsets();

    // Solana connection for trading
    const connection = useMemo(() => {
        const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
        return new Connection(rpcUrl, 'confirmed');
    }, []);
    const solanaWallet = wallets?.[0];
    const [walletProvider, setWalletProvider] = useState<any>(null);

    // Get wallet provider
    useEffect(() => {
        const getProvider = async () => {
            if (solanaWallet) {
                try {
                    const provider = await solanaWallet.getProvider();
                    setWalletProvider(provider);
                } catch (e) {
                    console.error('Failed to get wallet provider:', e);
                }
            }
        };
        getProvider();
    }, [solanaWallet]);

    const [feedItemsByMode, setFeedItemsByMode] = useState<{ global: ExternalFeedItem[]; following: ExternalFeedItem[] }>({
        global: [],
        following: [],
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BackendUser[]>([]);
    const [searchMarketResults, setSearchMarketResults] = useState<SearchMarketItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchingMarkets, setIsSearchingMarkets] = useState(false);
    const [previousSearches, setPreviousSearches] = useState<SearchMarketItem[]>([]);
    const [isLoadingFeedByMode, setIsLoadingFeedByMode] = useState({ global: true, following: true });
    const [isLoadingMoreByMode, setIsLoadingMoreByMode] = useState({ global: false, following: false });
    const [refreshingByMode, setRefreshingByMode] = useState({ global: false, following: false });
    const [feedErrorByMode, setFeedErrorByMode] = useState<{ global: string | null; following: string | null }>({
        global: null,
        following: null,
    });
    const [mode, setMode] = useState<'following' | 'global'>(backendUser ? 'following' : 'global');
    const [hasMoreByMode, setHasMoreByMode] = useState({ global: true, following: true });
    const [showSearch, setShowSearch] = useState(false);
    const [candlesMap, setCandlesMap] = useState<Record<string, CandleData[]>>({});
    const [tabLayouts, setTabLayouts] = useState<{
        global?: { x: number; width: number };
        following?: { x: number; width: number };
    }>({});
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
    const [followingExternalWallets, setFollowingExternalWallets] = useState<Set<string>>(new Set());
    const [followingExternalInProgress, setFollowingExternalInProgress] = useState<Set<string>>(new Set());
    const [searchAnimation] = useState(new Animated.Value(0));
    const slideAnim = useRef(new Animated.Value(backendUser ? -SCREEN_WIDTH : 0)).current;
    const modeRef = useRef<'following' | 'global'>(backendUser ? 'following' : 'global');
    const hasUserRef = useRef(!!backendUser);
    const [tradeSheetVisible, setTradeSheetVisible] = useState(false);
    const [tradeSheetItem, setTradeSheetItem] = useState<ExternalFeedItem | null>(null);
    const [selectedSearchMarket, setSelectedSearchMarket] = useState<Market | null>(null);
    const [selectedSearchEvent, setSelectedSearchEvent] = useState<Event | undefined>(undefined);
    const [suggestedUsers, setSuggestedUsers] = useState<BackendUser[]>([]);
    const [isLoadingSuggested, setIsLoadingSuggested] = useState(false);
    const [composerVisible, setComposerVisible] = useState(false);
    const [notifSidebarVisible, setNotifSidebarVisible] = useState(false);

    // Load suggested users when following tab is empty
    useEffect(() => {
        if (backendUser && followingIds.size === 0 && suggestedUsers.length === 0) {
            const loadSuggested = async () => {
                setIsLoadingSuggested(true);
                try {
                    const users = await api.getTopUsers('followers', 20);
                    setSuggestedUsers(users.filter(u => u.id !== backendUser.id));
                } catch (error) {
                    console.error('Failed to load suggested users:', error);
                } finally {
                    setIsLoadingSuggested(false);
                }
            };
            loadSuggested();
        }
    }, [backendUser, followingIds.size]);

    // Load previous searches on mount
    useEffect(() => {
        const loadPreviousSearches = async () => {
            try {
                const stored = await AsyncStorage.getItem('previousSearches');
                if (stored) {
                    setPreviousSearches(JSON.parse(stored));
                }
            } catch (error) {
                console.error('Failed to load previous searches:', error);
            }
        };
        loadPreviousSearches();
    }, []);

    useEffect(() => {
        if (backendUser) {
            setMode('following');
            slideAnim.setValue(-SCREEN_WIDTH);
            modeRef.current = 'following';
            hasUserRef.current = true;
        } else {
            setMode('global');
            slideAnim.setValue(0);
            modeRef.current = 'global';
            hasUserRef.current = false;
        }
        loadFollowingList();
    }, [backendUser, slideAnim]);

    useEffect(() => {
        Animated.timing(searchAnimation, {
            toValue: showSearch ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [showSearch]);

    const [loadingTradeForId, setLoadingTradeForId] = useState<string | null>(null);

    const handleOpenTradeSheet = useCallback(async (item: ExternalFeedItem) => {
        setLoadingTradeForId(item.id);
        try {
            const jupiterMarket = await marketsApi.fetchMarketByConditionId(item.conditionId);
            setTradeSheetItem({ ...item, marketDetails: jupiterMarket });
        } catch (err) {
            console.error('Failed to fetch market by conditionId:', err);
            setTradeSheetItem(item);
        } finally {
            setLoadingTradeForId(null);
            setTradeSheetVisible(true);
        }
    }, []);

    const handleOpenSearchMarket = useCallback((market: Market, event?: Event) => {
        setSelectedSearchMarket(market);
        setSelectedSearchEvent(event);
        setTradeSheetVisible(true);
    }, []);

    const handleCloseTradeSheet = useCallback(() => {
        setTradeSheetVisible(false);
        setTradeSheetItem(null);
        setSelectedSearchMarket(null);
        setSelectedSearchEvent(undefined);
    }, []);

    const loadFollowingList = async () => {
        if (!backendUser) {
            setFollowingIds(new Set());
            setFollowingExternalWallets(new Set());
            return;
        }
        try {
            const followingRes = await api.getFollowing(backendUser.id);
            setFollowingIds(new Set(
                followingRes.following
                    .filter(f => f.profileType === 'hunch' && f.userId)
                    .map(f => f.userId!)
            ));
            setFollowingExternalWallets(new Set(
                followingRes.following
                    .filter(f => f.profileType === 'external')
                    .map(f => f.walletAddress)
            ));
        } catch (error) {
            console.error("Failed to load following list:", error);
        }
    };

    const HYDRATE_LIMIT = 8;
    const hydrateCandles = useCallback((items: ExternalFeedItem[]) => {
        const toHydrate = items.slice(0, HYDRATE_LIMIT);
        if (toHydrate.length === 0) return;
        Promise.all(
            toHydrate.map(async (item) => {
                const candles = await polymarketApi.getCandlesticks({
                    conditionId: item.conditionId.split('_')[0],
                    startTime: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
                    endTime: Math.floor(Date.now() / 1000),
                    interval: 60,
                }).catch(() => [] as CandleData[]);
                return { conditionId: item.conditionId, candles };
            })
        ).then((results) => {
            const updates: Record<string, CandleData[]> = {};
            results.forEach((r) => {
                if (r.candles.length > 0) updates[r.conditionId] = r.candles;
            });
            if (Object.keys(updates).length > 0) {
                setCandlesMap((prev) => ({ ...prev, ...updates }));
            }
        });
    }, []);

    const loadFeed = useCallback(async (
        { targetMode, reset = false }: { targetMode: 'following' | 'global'; reset?: boolean }
    ) => {
        if (targetMode === 'following' && !backendUser) {
            setFeedItemsByMode(prev => ({ ...prev, following: [] }));
            setIsLoadingFeedByMode(prev => ({ ...prev, following: false }));
            setIsLoadingMoreByMode(prev => ({ ...prev, following: false }));
            setRefreshingByMode(prev => ({ ...prev, following: false }));
            setHasMoreByMode(prev => ({ ...prev, following: false }));
            return;
        }
        if (reset) {
            setIsLoadingFeedByMode(prev => ({ ...prev, [targetMode]: true }));
            setFeedErrorByMode(prev => ({ ...prev, [targetMode]: null }));
        } else {
            setIsLoadingMoreByMode(prev => ({ ...prev, [targetMode]: true }));
        }
        try {
            let rawTrades: ExternalTrade[];
            if (targetMode === 'following') {
                rawTrades = await followApi.getFollowingExternalFeed({ limit: 50 });
            } else {
                rawTrades = await followApi.getTopTraderFeed({ limit: 50, userId: backendUser?.id });
            }
            const items: ExternalFeedItem[] = rawTrades.map(mapExternalTrade);
            setFeedItemsByMode(prev => ({
                ...prev,
                [targetMode]: reset ? items : [...prev[targetMode], ...items],
            }));
            hydrateCandles(items);
            // No server-side pagination for these endpoints
            setHasMoreByMode(prev => ({ ...prev, [targetMode]: false }));
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : (error as any)?.error || 'Failed to load feed';
            setFeedErrorByMode(prev => ({ ...prev, [targetMode]: message }));
            console.error("Failed to load feed:", error);
        } finally {
            setIsLoadingFeedByMode(prev => ({ ...prev, [targetMode]: false }));
            setIsLoadingMoreByMode(prev => ({ ...prev, [targetMode]: false }));
            setRefreshingByMode(prev => ({ ...prev, [targetMode]: false }));
        }
    }, [backendUser, hydrateCandles]);

    useEffect(() => {
        loadFeed({ targetMode: mode, reset: true });
    }, [mode, backendUser, loadFeed]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            setSearchMarketResults([]);
            return;
        }
        setIsSearching(true);
        setIsSearchingMarkets(true);
        const normalizedQuery = query.trim().toLowerCase();
        try {
            const [results, { events }] = await Promise.all([
                api.searchUsers(query),
                marketsApi.fetchEvents(80, { status: 'active', withNestedMarkets: true }),
            ]);
            setSearchResults(results);
            const marketMatches: SearchMarketItem[] = [];
            const seenMarkets = new Set<string>();

            events.forEach(event => {
                const eventTitle = event.title?.toLowerCase() || '';
                const eventSubtitle = event.subtitle?.toLowerCase() || '';
                const eventMatches = eventTitle.includes(normalizedQuery) || eventSubtitle.includes(normalizedQuery);

                if (eventMatches) {
                    marketMatches.push({ type: 'event', event });
                }

                (event.markets || []).forEach(market => {
                    const marketTitle = market.title?.toLowerCase() || '';
                    const marketSubtitle = market.subtitle?.toLowerCase() || '';
                    const yesSubtitle = market.yesSubTitle?.toLowerCase() || '';
                    const noSubtitle = market.noSubTitle?.toLowerCase() || '';
                    const marketMatchesQuery =
                        marketTitle.includes(normalizedQuery) ||
                        marketSubtitle.includes(normalizedQuery) ||
                        yesSubtitle.includes(normalizedQuery) ||
                        noSubtitle.includes(normalizedQuery);

                    if (marketMatchesQuery && !seenMarkets.has(market.ticker)) {
                        seenMarkets.add(market.ticker);
                        marketMatches.push({ type: 'market', market, event });
                    }
                });
            });

            const finalResults = marketMatches.slice(0, 50);
            setSearchMarketResults(finalResults);

            // Save to previous searches (limit to 10 most recent)
            if (finalResults.length > 0) {
                try {
                    const stored = await AsyncStorage.getItem('previousSearches');
                    const existing: SearchMarketItem[] = stored ? JSON.parse(stored) : [];
                    // Add new results, avoiding duplicates
                    const newSearches = [...finalResults];
                    const combined = [...newSearches, ...existing.filter(item => {
                        const itemId = item.type === 'event' ? item.event.ticker : item.market.ticker;
                        return !newSearches.some(newItem => {
                            const newId = newItem.type === 'event' ? newItem.event.ticker : newItem.market.ticker;
                            return newId === itemId;
                        });
                    })].slice(0, 10); // Keep only 10 most recent
                    await AsyncStorage.setItem('previousSearches', JSON.stringify(combined));
                    setPreviousSearches(combined);
                } catch (error) {
                    console.error('Failed to save previous searches:', error);
                }
            }
        } catch (error) {
            console.error("Failed to search users:", error);
        } finally {
            setIsSearching(false);
            setIsSearchingMarkets(false);
        }
    };

    const handleFollowUser = async (userId: string) => {
        if (!backendUser || followingInProgress.has(userId)) return;
        setFollowingInProgress(prev => new Set([...prev, userId]));
        try {
            if (followingIds.has(userId)) {
                await api.unfollowUser(userId);
                setFollowingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
            } else {
                await api.followUser(userId);
                setFollowingIds(prev => new Set([...prev, userId]));
            }
            loadFeed({ targetMode: mode, reset: true });
        } catch (error) {
            console.error("Failed to follow/unfollow user:", error);
        } finally {
            setFollowingInProgress(prev => { const s = new Set(prev); s.delete(userId); return s; });
        }
    };

    const handleFollowExternalTrader = async (walletAddress: string) => {
        if (!backendUser || followingExternalInProgress.has(walletAddress)) return;
        setFollowingExternalInProgress(prev => new Set([...prev, walletAddress]));
        try {
            if (followingExternalWallets.has(walletAddress)) {
                await followApi.unfollowExternalProfile(walletAddress);
                setFollowingExternalWallets(prev => { const s = new Set(prev); s.delete(walletAddress); return s; });
                // Update isFollowing in feed items
                setFeedItemsByMode(prev => ({
                    ...prev,
                    global: prev.global.map(item =>
                        item.trader.walletAddress === walletAddress
                            ? { ...item, trader: { ...item.trader, isFollowing: false } }
                            : item
                    ),
                }));
            } else {
                await followApi.followExternalProfile({ walletAddress, source: 'polymarket' });
                setFollowingExternalWallets(prev => new Set([...prev, walletAddress]));
                setFeedItemsByMode(prev => ({
                    ...prev,
                    global: prev.global.map(item =>
                        item.trader.walletAddress === walletAddress
                            ? { ...item, trader: { ...item.trader, isFollowing: true } }
                            : item
                    ),
                }));
            }
        } catch (error) {
            console.error("Failed to follow/unfollow external trader:", error);
        } finally {
            setFollowingExternalInProgress(prev => { const s = new Set(prev); s.delete(walletAddress); return s; });
        }
    };

    const handleRefreshForMode = useCallback((targetMode: 'following' | 'global') => {
        setRefreshingByMode(prev => ({ ...prev, [targetMode]: true }));
        loadFeed({ targetMode, reset: true });
    }, [loadFeed]);

    const handleLoadMoreForMode = useCallback((targetMode: 'following' | 'global') => {
        if (
            !isLoadingFeedByMode[targetMode] &&
            !isLoadingMoreByMode[targetMode] &&
            hasMoreByMode[targetMode] &&
            feedItemsByMode[targetMode].length > 0
        ) {
            loadFeed({ targetMode });
        }
    }, [feedItemsByMode, hasMoreByMode, isLoadingFeedByMode, isLoadingMoreByMode, loadFeed]);

    const isGlobalActive = mode === 'global';
    const isFollowingActive = mode === 'following';

    const searchWidth = searchAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [40, SCREEN_WIDTH - 40],
    });
    const searchInputOpacity = searchAnimation.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0, 0, 1],
    });

    const triggerHaptic = useCallback(() => {
        void Haptics.selectionAsync();
    }, []);

    const animateToMode = useCallback((targetMode: 'following' | 'global') => {
        const target = targetMode === 'following' ? -SCREEN_WIDTH : 0;
        modeRef.current = targetMode;
        Animated.spring(slideAnim, {
            toValue: target,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
        }).start();
        setMode(targetMode);
    }, [slideAnim]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) =>
                Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 15,
            onPanResponderMove: (_, gestureState) => {
                const base = modeRef.current === 'following' ? -SCREEN_WIDTH : 0;
                const raw = base + gestureState.dx;
                const minX = hasUserRef.current ? -SCREEN_WIDTH : 0;
                const clamped = Math.max(minX, Math.min(0, raw));
                slideAnim.setValue(clamped);
            },
            onPanResponderRelease: (_, gestureState) => {
                const threshold = SCREEN_WIDTH * 0.25;
                let nextMode = modeRef.current;
                if (gestureState.dx < -threshold) {
                    nextMode = 'following';
                } else if (gestureState.dx > threshold) {
                    nextMode = 'global';
                }
                if (nextMode !== modeRef.current) {
                    triggerHaptic();
                }
                animateToMode(nextMode);
            },
            onPanResponderTerminate: () => {
                animateToMode(modeRef.current);
            },
        })
    ).current;

    const underlineWidth = 36;
    const renderHeader = () => {
        const globalLayout = tabLayouts.global;
        const followingLayout = tabLayouts.following;
        const underlineTranslateX = globalLayout && followingLayout
            ? slideAnim.interpolate({
                inputRange: [-SCREEN_WIDTH, 0],
                outputRange: [
                    followingLayout.x + followingLayout.width / 2 - underlineWidth / 2,
                    globalLayout.x + globalLayout.width / 2 - underlineWidth / 2,
                ],
                extrapolate: 'clamp',
            })
            : null;

        return (
            <>
                <View className="px-5 pl-9 pt-6 pb-2 flex-row items-center bg-app-bg">
                    {showSearch ? (
                        <View className="flex-1 flex-row items-center gap-2.5 px-4 py-2 bg-white rounded-full border border-[#D1D5DB]">
                            <Ionicons name="search" size={18} color={Theme.textDisabled} />
                            <TextInput
                                className="flex-1 text-txt-primary text-[16px]"
                                placeholder="Search users, markets, events..."
                                placeholderTextColor={Theme.textDisabled}
                                value={searchQuery}
                                onChangeText={handleSearch}
                                autoFocus
                            />
                            {(isSearching || isSearchingMarkets) && <ActivityIndicator size="small" color={Theme.accentSubtle} />}
                            {searchQuery.length > 0 ? (
                                <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); setSearchMarketResults([]); }}>
                                    <Ionicons name="close-circle" size={18} color={Theme.textDisabled} />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowSearch(false);
                                        setSearchQuery("");
                                        setSearchResults([]);
                                        setSearchMarketResults([]);
                                    }}
                                >
                                    <Ionicons name="close" size={18} color={Theme.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <>
                            {/* Tabs: For you / Following */}
                            <View className="flex-row items-center gap-5 relative">
                                <TouchableOpacity
                                    className="relative pb-2"
                                    onPress={() => {
                                        if (modeRef.current !== 'global') {
                                            triggerHaptic();
                                        }
                                        animateToMode('global');
                                    }}
                                    onLayout={(event) => {
                                        const { x, width } = event.nativeEvent.layout;
                                        setTabLayouts(prev => ({ ...prev, global: { x, width } }));
                                    }}
                                >
                                    <Text className={`text-xl font-bold ${isGlobalActive ? 'text-txt-primary' : 'text-txt-disabled'}`}>
                                        For you
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="relative pb-2"
                                    onPress={() => {
                                        if (modeRef.current !== 'following') {
                                            triggerHaptic();
                                        }
                                        animateToMode('following');
                                    }}
                                    onLayout={(event) => {
                                        const { x, width } = event.nativeEvent.layout;
                                        setTabLayouts(prev => ({ ...prev, following: { x, width } }));
                                    }}
                                >
                                    <Text
                                        className={`text-xl font-bold ${isFollowingActive
                                            ? 'text-txt-primary'
                                            : 'text-txt-disabled'
                                            }`}
                                    >
                                        Following
                                    </Text>
                                </TouchableOpacity>
                                {underlineTranslateX && (
                                    <Animated.View
                                        style={[
                                            styles.tabUnderline,
                                            { width: underlineWidth, transform: [{ translateX: underlineTranslateX }] },
                                        ]}
                                    />
                                )}
                            </View>

                            <View className="flex-1" />

                            {/* Leaderboard + Search + Bell */}
                                <TouchableOpacity
                                    className="w-10 h-10 rounded-full justify-center items-center"
                                    onPress={() => setShowSearch(true)}
                                >
                                    <Ionicons name="search" size={24} color={Theme.textPrimary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="w-10 h-10 rounded-full justify-center items-center"
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setNotifSidebarVisible(true);
                                    }}
                                >
                                    <Ionicons name="notifications" size={22} color={Theme.textPrimary} />
                                </TouchableOpacity>
                        </>
                    )}
                </View>
                <View className="border-b border-transparent" />
            </>
        );
    };

    const renderEmptyState = (targetMode: 'following' | 'global') => {
        const feedError = feedErrorByMode[targetMode];
        if (feedError) {
            return (
                <View className="flex-1 justify-center items-center px-10">
                    <Text className="text-xl font-semibold text-txt-primary mb-2">Unable to load feed</Text>
                    <Text className="text-[15px] text-txt-secondary text-center leading-[22px] mb-6">
                        {feedError}
                    </Text>
                    <TouchableOpacity
                        className="flex-row items-center gap-2 bg-txt-primary px-6 py-3.5 rounded-lg"
                        onPress={() => loadFeed({ targetMode, reset: true })}
                    >
                        <Ionicons name="refresh" size={18} color={Theme.bgMain} />
                        <Text className="text-[15px] font-semibold text-txt-inverse">Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (targetMode === 'global') {
            return (
                <View className="flex-1 justify-center items-center px-10">
                    <View className="w-[88px] h-[88px] rounded-full bg-cyan-500/5 justify-center items-center mb-5">
                        <Ionicons name="sparkles-outline" size={46} color={`${Theme.accentSubtle}50`} />
                    </View>
                    <Text className="text-xl font-semibold text-txt-primary mb-2">No trades yet</Text>
                    <Text className="text-[15px] text-txt-secondary text-center leading-[22px]">
                        Be the first to trade!
                    </Text>
                </View>
            );
        }

        if (!backendUser) {
            return (
                <View className="flex-1 justify-center items-center px-10">
                    <View className="w-[88px] h-[88px] rounded-full bg-cyan-500/5 justify-center items-center mb-5">
                        <Ionicons name="lock-closed-outline" size={46} color={`${Theme.accentSubtle}50`} />
                    </View>
                    <Text className="text-xl font-semibold text-txt-primary mb-2">Sign in to see Following</Text>
                    <Text className="text-[15px] text-txt-secondary text-center leading-[22px] mb-6">
                        Log in to see trades from people you follow.
                    </Text>
                    <TouchableOpacity
                        className="flex-row items-center gap-2 bg-txt-primary px-6 py-3.5 rounded-lg"
                        onPress={() => router.push("/login")}
                    >
                        <Ionicons name="log-in-outline" size={18} color={Theme.bgMain} />
                        <Text className="text-[15px] font-semibold text-txt-inverse">Go to Login</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View className="flex-1 justify-center items-center px-10">
                <View className="w-[88px] h-[88px] rounded-full bg-cyan-500/5 justify-center items-center mb-5">
                    <Ionicons name="trending-up-outline" size={46} color={`${Theme.accentSubtle}50`} />
                </View>
                <Text className="text-xl font-semibold text-txt-primary mb-2">No trades yet</Text>
                <Text className="text-[15px] text-txt-secondary text-center leading-[22px] mb-6">
                    Follow Polymarket traders from the For You tab to see their trades here.
                </Text>
                <TouchableOpacity
                    className="flex-row items-center gap-2 bg-txt-primary px-6 py-3.5 rounded-lg"
                    onPress={() => animateToMode('global')}
                >
                    <Ionicons name="flame-outline" size={18} color={Theme.bgMain} />
                    <Text className="text-[15px] font-semibold text-txt-inverse">Discover Traders</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1" edges={['top']}>
                {showSearch ? (
                    <>
                        {renderHeader()}
                        <FlatList
                            data={
                                searchQuery.trim().length === 0 && previousSearches.length > 0
                                    ? previousSearches.map((item) => ({ type: 'marketResult' as const, item }))
                                    : [
                                        ...searchMarketResults.map((item) => ({ type: 'marketResult' as const, item })),
                                        ...searchResults.map((item) => ({ type: 'userResult' as const, item })),
                                    ]
                            }
                            keyExtractor={(entry) =>
                                entry.type === 'marketResult'
                                    ? entry.item.type === 'event'
                                        ? `event-${entry.item.event.ticker}`
                                        : `market-${entry.item.market.ticker}`
                                    : `user-${entry.item.id}`
                            }
                            renderItem={({ item: entry }) =>
                                entry.type === 'userResult' ? (
                                    <SearchResultRow
                                        item={entry.item}
                                        isFollowing={followingIds.has(entry.item.id)}
                                        inProgress={followingInProgress.has(entry.item.id)}
                                        isSelf={backendUser?.id === entry.item.id}
                                        canFollow={!!backendUser}
                                        onFollow={() => handleFollowUser(entry.item.id)}
                                        onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: entry.item.id } })}
                                    />
                                ) : (
                                    <TouchableOpacity
                                        className="flex-row items-center py-3.5 px-5"
                                        onPress={() => {
                                            if (entry.item.type === 'event') {
                                                router.push({ pathname: '/event/[ticker]', params: { ticker: entry.item.event.ticker } });
                                            } else {
                                                handleOpenSearchMarket(entry.item.market, entry.item.event);
                                            }
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View className="w-12 h-12 rounded-full justify-center items-center mr-3.5 bg-app-card border border-border">
                                            <Ionicons
                                                name={entry.item.type === 'event' ? 'sparkles-outline' : 'stats-chart-outline'}
                                                size={22}
                                                color={Theme.textPrimary}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-base font-semibold text-txt-primary mb-0.5" numberOfLines={1}>
                                                {entry.item.type === 'event' ? entry.item.event.title : entry.item.market.title}
                                            </Text>
                                            <Text className="text-[13px] text-txt-disabled" numberOfLines={1}>
                                                {entry.item.type === 'event'
                                                    ? (entry.item.event.subtitle || 'Event')
                                                    : (entry.item.market.subtitle || entry.item.market.yesSubTitle || entry.item.market.noSubTitle || 'Market')}
                                            </Text>
                                            {entry.item.type === 'market' && entry.item.event?.title ? (
                                                <Text className="text-[11px] text-txt-secondary mt-1" numberOfLines={1}>
                                                    {entry.item.event.title}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                )
                            }
                            contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={() => {
                                if (searchQuery.trim().length === 0 && previousSearches.length === 0) {
                                    return (
                                        <View className="px-6 py-8">
                                            <Text className="text-sm text-txt-secondary">No previous searches.</Text>
                                        </View>
                                    );
                                }
                                return (
                                    <View className="px-6 py-8">
                                        <Text className="text-sm text-txt-secondary">No results found.</Text>
                                    </View>
                                );
                            }}
                        />
                    </>
                ) : (
                    <>
                        {renderHeader()}
                        <View style={styles.listContainer} {...(showSearch ? {} : panResponder.panHandlers)}>
                            <Animated.View style={[styles.slidingContainer, { transform: [{ translateX: slideAnim }] }]}>
                                {(['global', 'following'] as const).map((pageMode) => {
                                    const tradeItems = feedItemsByMode[pageMode];
                                    const isLoadingFeed = isLoadingFeedByMode[pageMode];
                                    const isLoadingMore = isLoadingMoreByMode[pageMode];
                                    const refreshing = refreshingByMode[pageMode];

                                    const mixedFeed = tradeItems;

                                    return (
                                        <View key={pageMode} style={styles.listPane}>
                                            {isLoadingFeed && tradeItems.length === 0 ? (
                                                <SocialFeedSkeleton />
                                            ) : (
                                                <FlatList
                                                    data={mixedFeed}
                                                    keyExtractor={(entry) => `trade-${entry.id}`}
                                                    renderItem={({ item: entry }) => (
                                                        <FeedCard
                                                            item={entry}
                                                            candles={candlesMap[entry.conditionId]}
                                                            onPress={() => handleOpenTradeSheet(entry)}
                                                            onUserPress={() => router.push({ pathname: '/profile/[identifier]', params: { identifier: entry.trader.walletAddress } })}
                                                            onChartPress={() => handleOpenTradeSheet(entry)}
                                                            onFollow={pageMode === 'global' && backendUser ? () => handleFollowExternalTrader(entry.trader.walletAddress) : undefined}
                                                            isFollowInProgress={followingExternalInProgress.has(entry.trader.walletAddress)}
                                                            isLoadingTrade={loadingTradeForId === entry.id}
                                                        />
                                                    )}
                                                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
                                                    showsVerticalScrollIndicator={false}
                                                    refreshing={refreshing}
                                                    onRefresh={() => handleRefreshForMode(pageMode)}
                                                    onEndReached={() => handleLoadMoreForMode(pageMode)}
                                                    onEndReachedThreshold={0.6}
                                                    ListEmptyComponent={() => renderEmptyState(pageMode)}
                                                    ListFooterComponent={
                                                        isLoadingMore ? <ListFooterSkeleton /> : null
                                                    }
                                                />
                                            )}
                                        </View>
                                    );
                                })}
                            </Animated.View>
                        </View>
                    </>
                )}
            </SafeAreaView>

            <MarketTradeSheet
                visible={tradeSheetVisible}
                onClose={handleCloseTradeSheet}
                onTradeSuccess={(tradeData, displayInfo, tradeId) => {
                    const spent = Number(tradeData?.amount) || 0;
                    if (spent > 0) deductBalance(spent);
                    const market = tradeSheetItem?.marketDetails || selectedSearchMarket || null;
                    if (tradeData?.marketTicker && market) {
                        addOptimisticPosition({
                            marketTicker: tradeData.marketTicker,
                            eventTicker: tradeData.eventTicker || null,
                            side: tradeData.side as 'yes' | 'no',
                            totalUsdcAmount: Number(tradeData.amount) || 0,
                            totalTokenAmount: tradeData.executedOutAmount ? Number(tradeData.executedOutAmount) / 1_000_000 : 0,
                            averageEntryPrice: Number(tradeData.entryPrice) || 0,
                            currentPrice: null,
                            currentValue: null,
                            profitLoss: null,
                            profitLossPercentage: null,
                            tradeCount: 1,
                            market,
                            eventImageUrl: null,
                            trades: [],
                            totalCostBasis: Number(tradeData.amount) || 0,
                            totalTokensBought: tradeData.executedOutAmount ? Number(tradeData.executedOutAmount) / 1_000_000 : 0,
                            totalTokensSold: 0,
                            totalSellProceeds: 0,
                            realizedPnL: 0,
                            unrealizedPnL: null,
                            totalPnL: null,
                            positionStatus: 'OPEN',
                        });
                    }
                }}
                onRefreshFeed={() => loadFeed({ targetMode: mode, reset: true })}
                market={tradeSheetItem?.marketDetails || selectedSearchMarket || null}
                candles={tradeSheetItem ? candlesMap[tradeSheetItem.conditionId] : undefined}
                conditionId={tradeSheetItem?.conditionId ?? undefined}
                backendUser={backendUser || null}
                walletProvider={walletProvider}
                connection={connection}
                initialSide={tradeSheetItem?.side}
                eventTitle={selectedSearchEvent?.title}
            />

            {/* Floating Plus Button */}
            <TouchableOpacity
                style={{
                    position: 'absolute',
                    bottom: Math.max(insets.bottom, 0) + 4 + 72 + 20, // Tab bar height (72) + margin (4) + spacing (20)
                    right: 20,
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                }}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setComposerVisible(true);
                }}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#FFEB3B', '#FFD700']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ fontSize: 32, fontWeight: '500', color: '#000000', lineHeight: 32 }}>+</Text>
                </LinearGradient>
            </TouchableOpacity>

            <PostComposerSheet
                visible={composerVisible}
                onClose={() => setComposerVisible(false)}
                backendUser={backendUser}
                onPostSuccess={() => loadFeed({ targetMode: mode, reset: true })}
            />

            <NotificationSidebar
                visible={notifSidebarVisible}
                onClose={() => setNotifSidebarVisible(false)}
                backendUser={backendUser}
            />
        </View>
    );
}

// Minimal styles for animated components
const styles = StyleSheet.create({
    searchBarContainer: {
        height: 40,
        borderRadius: 999,
        overflow: 'visible',
    },
    listContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    slidingContainer: {
        flexDirection: 'row',
        width: SCREEN_WIDTH * 2,
        flex: 1,
    },
    listPane: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
    tabUnderline: {
        position: 'absolute',
        height: 3,
        borderRadius: 999,
        backgroundColor: Theme.textPrimary,
        bottom: -2,
        left: 0,
    },
    sheet: {
        backgroundColor: Theme.bgMain,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        overflow: "hidden",
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: Theme.border,
    },
    backdropTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.25)",
    },
    sheetCta: {
        height: 52,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
    },
});
