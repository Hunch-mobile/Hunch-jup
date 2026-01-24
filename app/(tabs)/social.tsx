import LightChart from '@/components/LightChart';
import { MarketTradeSheet } from '@/components/MarketTradeSheet';
import NewsCard from '@/components/NewsCard';
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails, marketsApi } from "@/lib/api";
import { User as BackendUser, CandleData, Event, EventEvidence, Market, Trade } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface FeedItem extends Trade {
    type: 'trade';
    marketDetails?: Market;
    quote?: string | null;
}

type SearchMarketItem =
    | { type: 'event'; event: Event }
    | { type: 'market'; market: Market; event?: Event };

// Mixed feed type for trades and news
type FeedEntry =
    | { type: 'trade'; data: FeedItem }
    | { type: 'news'; data: EventEvidence };

// Event tickers to fetch evidence for
const EVIDENCE_TICKERS = ['KXFEDCHAIRNOM-29'];

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

    return (
        <TouchableOpacity
            className="flex-row items-center py-3.5 px-5"
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View className="w-12 h-12 rounded-full justify-center items-center mr-3.5 bg-app-card border border-border">
                <Image
                    source={avatarUrl ? { uri: avatarUrl } : defaultProfileImage}
                    className="w-full h-full rounded-full"
                />
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

const transformNoCandles = (candles: CandleData[] = []) => {
    if (candles.length === 0) return candles;
    return candles.map((candle) => {
        if (typeof candle.close !== 'number') return candle;
        const nextClose = 1 - candle.close;
        return nextClose === candle.close ? candle : { ...candle, close: nextClose };
    });
};

// Chart dimensions for FeedCard
const FEED_CARD_CHART_WIDTH = SCREEN_WIDTH - 40 - 28; // mx-5 (40) + p-3.5 (28)
const FEED_CARD_CHART_HEIGHT = 72;

// Feed card component
const FeedCard = ({
    item,
    candles,
    onPress,
    onUserPress,
    onChartPress,
}: {
    item: FeedItem;
    candles?: CandleData[];
    onPress: () => void;
    onUserPress: () => void;
    onChartPress: () => void;
}) => {
    const isYes = item.side === 'yes';
    const market = item.marketDetails;
    const subtitle = isYes ? market?.yesSubTitle : market?.noSubTitle;
    const hasQuote = item.quote && item.quote.trim().length > 0;
    const avatarUrl = item.user?.avatarUrl?.replace('_normal', '');
    const totalBought = Number.parseFloat(item.amount || '0');
    const rawName = item.user?.displayName?.trim();
    const handle = rawName ? rawName.replace(/^@+/, '') : item.user?.walletAddress?.slice(0, 6) || 'anonymous';
    const isSell = item.action === 'SELL';
    const actionLabel = isSell ? 'Sell' : 'Buy';

    // Price change calculation from candles
    const entryTimestamp = Math.floor(new Date(item.createdAt).getTime() / 1000);
    const priceChange = candles ? (getEntryPnl(candles, entryTimestamp, isYes) || getPriceChange(candles)) : null;
    const chartCandles = useMemo(
        () => (isYes ? (candles || []) : transformNoCandles(candles || [])),
        [candles, isYes]
    );
    const pnlText = priceChange ? `${priceChange.isPositive ? '+' : ''}${priceChange.changePercent}%` : (isYes ? '+0.0%' : '-0.0%');
    const pnlColor = priceChange ? (priceChange.isPositive ? '#22c55e' : '#ef4444') : (isYes ? '#22c55e' : '#ef4444');
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
        if (value >= 1_000_000) {
            return formatCompact(value / 1_000_000, 'M');
        }
        if (value >= 1_000) {
            return formatCompact(value / 1_000, 'K');
        }
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

    return (
        <TouchableOpacity
            className="mx-5 mb-5"
            onPress={onChartPress}
            activeOpacity={0.9}
        >
            {/* Header */}
            <View className="flex-row items-start mb-2">
                <TouchableOpacity className="mr-3" onPress={(e) => { e.stopPropagation(); onUserPress(); }}>
                    <View className="w-[38px] h-[38px] rounded-full justify-center items-center bg-app-card border border-border overflow-hidden">
                        <Image
                            source={avatarUrl ? { uri: avatarUrl } : defaultProfileImage}
                            className="w-full h-full rounded-full"
                        />
                    </View>
                </TouchableOpacity>
                <View className="flex-1">
                    <View className="flex-row items-start justify-between">
                        <Text className="text-txt-primary font-bold text-[14px]" numberOfLines={1}>
                            {handle}{' '}
                            <Text style={{ color: isSell ? '#ef4444' : '#22c55e', fontWeight: '800' }}>
                                {isSell ? 'sold' : 'bought'}
                            </Text>
                        </Text>
                        <Text className="text-txt-disabled text-[13px] ml-3 pr-2">
                            {getTimeAgo(item.createdAt)}
                        </Text>
                    </View>
                    {hasQuote && (
                        <Text className="text-[18px] text-txt-primary mt-1 px-2 py-1 leading-[26px]">
                            {item.quote}
                        </Text>
                    )}
                </View>
            </View>



            {/* Market Card */}
            <View className="bg-white rounded-[24px] p-3.5 border border-[#E8E8E8] shadow-sm relative">

                <View className="flex-row items-center gap-3 mb-3.5">
                    <Text className={`text-[32px] font-black ${isYes ? 'text-[#41d93b]' : 'text-[#ef4444]'}`}>
                        {isYes ? 'YES' : 'NO'}
                    </Text>
                    <Text className="text-[14px] text-txt-disabled">on</Text>
                    <View className="flex-1 border border-[#E6E6E6] rounded-xl px-2.5 py-2">
                        <Text className="text-[15px] font-semibold text-[#111827]" numberOfLines={1}>
                            {market?.title || item.marketTicker}
                        </Text>
                        <Text className="text-[12px] text-[#6b7280]" numberOfLines={1}>
                            {subtitle || market?.subtitle || 'Market'}
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
                            isYes={isYes}
                            entryTimestamp={entryTimestamp}
                            entryAvatarUri={avatarUrl || undefined}
                        />
                    ) : (
                        <View className="flex-1 justify-center items-center gap-1.5">
                            <ActivityIndicator size="small" color="#9ca3af" />
                            <Text className="text-[10px] text-gray-400">Loading chart...</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View className="flex-row items-center">
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">Total Bought</Text>
                        <Text className="text-[16px] font-semibold text-[#111827]">
                            ${formatValue(totalBought)}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">PNL</Text>
                        <Text className="text-[14px] font-semibold" style={{ color: pnlColor }}>
                            {pnlText}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">Total Value</Text>
                        <Text className="text-[16px] font-semibold text-[#111827]">
                            ${formatValue(totalValue)}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};



export default function SocialScreen() {
    const { backendUser } = useUser();
    const { wallets } = useEmbeddedSolanaWallet();

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

    const [feedItemsByMode, setFeedItemsByMode] = useState<{ global: FeedItem[]; following: FeedItem[] }>({
        global: [],
        following: [],
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BackendUser[]>([]);
    const [searchMarketResults, setSearchMarketResults] = useState<SearchMarketItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchingMarkets, setIsSearchingMarkets] = useState(false);
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
    const [searchAnimation] = useState(new Animated.Value(0));
    const offsetRef = useRef({ global: 0, following: 0 });
    const limit = 50;
    const slideAnim = useRef(new Animated.Value(backendUser ? -SCREEN_WIDTH : 0)).current;
    const modeRef = useRef<'following' | 'global'>(backendUser ? 'following' : 'global');
    const hasUserRef = useRef(!!backendUser);
    const [tradeSheetVisible, setTradeSheetVisible] = useState(false);
    const [tradeSheetItem, setTradeSheetItem] = useState<FeedItem | null>(null);
    const [evidenceItems, setEvidenceItems] = useState<EventEvidence[]>([]);
    const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);

    // Load evidence on mount
    useEffect(() => {
        const loadEvidence = async () => {
            setIsLoadingEvidence(true);
            try {
                const evidence = await api.fetchEvidence(EVIDENCE_TICKERS);
                setEvidenceItems(evidence);
            } catch (error) {
                console.error('Failed to load evidence:', error);
            } finally {
                setIsLoadingEvidence(false);
            }
        };
        loadEvidence();
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

    const handleOpenTradeSheet = useCallback((item: FeedItem) => {
        setTradeSheetItem(item);
        setTradeSheetVisible(true);
    }, []);

    const handleCloseTradeSheet = useCallback(() => {
        setTradeSheetVisible(false);
    }, []);

    const loadFollowingList = async () => {
        if (!backendUser) {
            setFollowingIds(new Set());
            return;
        }
        try {
            const following = await api.getFollowing(backendUser.id);
            setFollowingIds(new Set(following.map(f => f.followingId)));
        } catch (error) {
            console.error("Failed to load following list:", error);
        }
    };

    const hydrateMarketDetails = useCallback((items: FeedItem[], targetMode: 'following' | 'global') => {
        items.forEach(async (item) => {
            const marketDetails = await getMarketDetails(item.marketTicker);
            if (!marketDetails) return;
            setFeedItemsByMode(prev => ({
                ...prev,
                [targetMode]: prev[targetMode].map(existing =>
                    existing.id === item.id ? { ...existing, marketDetails } : existing
                ),
            }));

            // Fetch candlestick data for the market
            let marketMint: string | undefined = marketDetails.yesMint;
            if (!marketMint && marketDetails.accounts) {
                const accountValues = Object.values(marketDetails.accounts);
                for (const account of accountValues) {
                    if (typeof account === 'object' && account?.yesMint) {
                        marketMint = account.yesMint;
                        break;
                    }
                }
            }

            if (marketMint) {
                try {
                    const endTs = Math.floor(Date.now() / 1000);
                    const startTs = endTs - (7 * 24 * 60 * 60); // 1 week
                    const candles = await marketsApi.fetchCandlesticksByMint(marketMint, { startTs, endTs, periodInterval: 60 });
                    if (candles && candles.length > 0) {
                        setCandlesMap(prev => ({ ...prev, [item.marketTicker]: candles }));
                    }
                } catch (error) {
                    console.error(`Failed to fetch candles for ${item.marketTicker}:`, error);
                }
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
        const nextOffset = reset ? 0 : offsetRef.current[targetMode];
        if (reset) {
            setIsLoadingFeedByMode(prev => ({ ...prev, [targetMode]: true }));
            setFeedErrorByMode(prev => ({ ...prev, [targetMode]: null }));
            offsetRef.current[targetMode] = 0;
            setHasMoreByMode(prev => ({ ...prev, [targetMode]: true }));
        } else {
            setIsLoadingMoreByMode(prev => ({ ...prev, [targetMode]: true }));
        }
        try {
            const trades = await api.getFeed({
                userId: backendUser?.id,
                mode: targetMode,
                limit,
                offset: nextOffset,
            });
            const items: FeedItem[] = trades.map(trade => ({ ...trade, type: 'trade' as const }));
            setFeedItemsByMode(prev => ({
                ...prev,
                [targetMode]: reset ? items : [...prev[targetMode], ...items],
            }));
            hydrateMarketDetails(items, targetMode);
            setHasMoreByMode(prev => ({ ...prev, [targetMode]: items.length === limit }));
            offsetRef.current[targetMode] = nextOffset + items.length;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load feed';
            setFeedErrorByMode(prev => ({ ...prev, [targetMode]: message }));
            console.error("Failed to load feed:", error);
        } finally {
            setIsLoadingFeedByMode(prev => ({ ...prev, [targetMode]: false }));
            setIsLoadingMoreByMode(prev => ({ ...prev, [targetMode]: false }));
            setRefreshingByMode(prev => ({ ...prev, [targetMode]: false }));
        }
    }, [backendUser, limit, hydrateMarketDetails]);

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

            setSearchMarketResults(marketMatches.slice(0, 50));
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
                await api.unfollowUser(backendUser.id, userId);
                setFollowingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
            } else {
                await api.followUser(backendUser.id, userId);
                setFollowingIds(prev => new Set([...prev, userId]));
            }
            loadFeed({ targetMode: mode, reset: true });
        } catch (error) {
            console.error("Failed to follow/unfollow user:", error);
        } finally {
            setFollowingInProgress(prev => { const s = new Set(prev); s.delete(userId); return s; });
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
                <View className="px-5 pt-14 pb-2 flex-row items-center justify-between bg-app-bg">
                    <View className="flex-1" />
                    <View className="absolute left-0 right-0 items-center">
                        <View className="flex-row items-center gap-6 relative">
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
                                <View className="flex-row items-center gap-2">
                                    <Text className={`text-lg font-semibold ${isGlobalActive ? 'text-txt-primary' : 'text-txt-disabled'}`}>
                                        For you
                                    </Text>
                                </View>
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
                                    className={`text-lg font-semibold ${isFollowingActive
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
                    </View>
                    <Animated.View
                        style={[
                            styles.searchBarContainer,
                            showSearch ? styles.searchBarOpen : styles.searchBarClosed,
                            { width: searchWidth },
                        ]}
                    >
                        {!showSearch ? (
                            <TouchableOpacity
                                className="w-10 h-10 rounded-full justify-center items-center"
                                onPress={() => setShowSearch(true)}
                            >
                                <Ionicons name="search" size={24} color={Theme.textPrimary} />
                            </TouchableOpacity>
                        ) : (
                            <View className="flex-row items-center h-12 gap-2.5 px-3">
                                <Ionicons name="search" size={16} color={Theme.textDisabled} />
                                <Animated.View style={{ flex: 1, opacity: searchInputOpacity }}>
                                    <TextInput
                                        className="text-txt-primary text-[17px]"
                                        placeholder="Search users, markets, events..."
                                        placeholderTextColor={Theme.textDisabled}
                                        value={searchQuery}
                                        onChangeText={handleSearch}
                                        autoFocus
                                    />
                                </Animated.View>
                                {(isSearching || isSearchingMarkets) && <ActivityIndicator size="small" color={Theme.accentSubtle} />}
                                {(searchQuery.length > 0 || isSearching || isSearchingMarkets) && (
                                    <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                                        <Ionicons name="close-circle" size={18} color={Theme.textDisabled} />
                                    </TouchableOpacity>
                                )}
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
                            </View>
                        )}
                    </Animated.View>
                </View>
                <View className="border-b border-border mt-4" />
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

        if (followingIds.size === 0) {
            return (
                <View className="flex-1 justify-center items-center px-10">
                    <View className="w-[88px] h-[88px] rounded-full bg-cyan-500/5 justify-center items-center mb-5">
                        <Ionicons name="people-outline" size={48} color={`${Theme.accentSubtle}50`} />
                    </View>
                    <Text className="text-xl font-semibold text-txt-primary mb-2">You're not following anyone yet</Text>
                    <Text className="text-[15px] text-txt-secondary text-center leading-[22px] mb-6">
                        Discover traders to see their activity here
                    </Text>
                    <TouchableOpacity
                        className="flex-row items-center gap-2 bg-txt-primary px-6 py-3.5 rounded-lg"
                        onPress={() => setShowSearch(true)}
                    >
                        <Ionicons name="search" size={18} color={Theme.bgMain} />
                        <Text className="text-[15px] font-semibold text-txt-inverse">Discover Traders</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View className="flex-1 justify-center items-center px-10">
                <View className="w-[88px] h-[88px] rounded-full bg-cyan-500/5 justify-center items-center mb-5">
                    <Ionicons name="trending-up-outline" size={46} color={`${Theme.accentSubtle}50`} />
                </View>
                <Text className="text-xl font-semibold text-txt-primary mb-2">No recent trades</Text>
                <Text className="text-[15px] text-txt-secondary text-center leading-[22px] mb-6">
                    No recent trades from people you follow.
                </Text>
                <TouchableOpacity
                    className="flex-row items-center gap-2 bg-app-card px-6 py-3.5 rounded-lg border border-border"
                    onPress={() => setMode('global')}
                >
                    <Ionicons name="globe-outline" size={18} color={Theme.textPrimary} />
                    <Text className="text-[15px] font-semibold text-txt-primary">View Global Feed</Text>
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
                            data={[
                                ...searchMarketResults.map((item) => ({ type: 'marketResult' as const, item })),
                                ...searchResults.map((item) => ({ type: 'userResult' as const, item })),
                            ]}
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
                                                router.push({ pathname: '/market/[ticker]', params: { ticker: entry.item.market.ticker } });
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
                            ListEmptyComponent={() => (
                                <View className="px-6 py-8">
                                    <Text className="text-sm text-txt-secondary">No results found.</Text>
                                </View>
                            )}
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

                                    // Create mixed feed: combine news and trades, sorted by time (most recent first)
                                    const mixedFeed: FeedEntry[] = [];
                                    if (pageMode === 'global') {
                                        // Add all news items
                                        evidenceItems.forEach(news => {
                                            mixedFeed.push({ type: 'news', data: news });
                                        });
                                        // Add all trades
                                        tradeItems.forEach(trade => {
                                            mixedFeed.push({ type: 'trade', data: trade });
                                        });
                                        // Sort by time (most recent first)
                                        mixedFeed.sort((a, b) => {
                                            const getTime = (entry: FeedEntry): number => {
                                                if (entry.type === 'trade') {
                                                    return new Date(entry.data.createdAt).getTime();
                                                } else {
                                                    // News: use sourcePublishedAt or createdAt
                                                    const newsDate = entry.data.sourcePublishedAt || entry.data.createdAt;
                                                    return new Date(newsDate).getTime();
                                                }
                                            };
                                            return getTime(b) - getTime(a); // Descending (newest first)
                                        });
                                    } else {
                                        // Following feed: just trades (already sorted by API)
                                        tradeItems.forEach(trade => {
                                            mixedFeed.push({ type: 'trade', data: trade });
                                        });
                                    }

                                    return (
                                        <View key={pageMode} style={styles.listPane}>
                                            {isLoadingFeed && tradeItems.length === 0 ? (
                                                <View className="flex-1 justify-center items-center gap-3">
                                                    <ActivityIndicator size="large" color={Theme.accentSubtle} />
                                                    <Text className="text-sm text-txt-secondary">Loading feed...</Text>
                                                </View>
                                            ) : (
                                                <FlatList
                                                    data={mixedFeed}
                                                    keyExtractor={(entry) =>
                                                        entry.type === 'trade'
                                                            ? `trade-${entry.data.id}`
                                                            : `news-${entry.data.id}`
                                                    }
                                                    renderItem={({ item: entry }) =>
                                                        entry.type === 'trade' ? (
                                                            <FeedCard
                                                                item={entry.data}
                                                                candles={candlesMap[entry.data.marketTicker]}
                                                                onPress={() => handleOpenTradeSheet(entry.data)}
                                                                onUserPress={() => entry.data.user?.id && router.push({ pathname: '/user/[userId]', params: { userId: entry.data.user.id } })}
                                                                onChartPress={() => handleOpenTradeSheet(entry.data)}
                                                            />
                                                        ) : (
                                                            <NewsCard item={entry.data} />
                                                        )
                                                    }
                                                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
                                                    showsVerticalScrollIndicator={false}
                                                    refreshing={refreshing}
                                                    onRefresh={() => handleRefreshForMode(pageMode)}
                                                    onEndReached={() => handleLoadMoreForMode(pageMode)}
                                                    onEndReachedThreshold={0.6}
                                                    ListEmptyComponent={() => renderEmptyState(pageMode)}
                                                    ListFooterComponent={
                                                        isLoadingMore ? (
                                                            <View className="py-4">
                                                                <ActivityIndicator size="small" color={Theme.accentSubtle} />
                                                            </View>
                                                        ) : null
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
                    // Trade saved successfully, quote sheet will show from within MarketTradeSheet
                }}
                onRefreshFeed={() => loadFeed({ targetMode: mode, reset: true })}
                market={tradeSheetItem?.marketDetails || null}
                candles={tradeSheetItem ? candlesMap[tradeSheetItem.marketTicker] : undefined}
                backendUser={backendUser || null}
                walletProvider={walletProvider}
                connection={connection}
                initialSide={tradeSheetItem?.side}
            />
        </View>
    );
}

// Minimal styles for animated components
const styles = StyleSheet.create({
    searchBarContainer: {
        position: 'absolute',
        right: 20,
        height: 40,
        borderRadius: 999,
        overflow: 'hidden',
    },
    searchBarOpen: {
        backgroundColor: Theme.bgCard,
        borderWidth: 1,
        borderColor: Theme.border,
    },
    searchBarClosed: {
        backgroundColor: 'transparent',
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
