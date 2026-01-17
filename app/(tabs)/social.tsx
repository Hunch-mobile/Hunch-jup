import LightChart from '@/components/LightChart';
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails, marketsApi } from "@/lib/api";
import { User as BackendUser, CandleData, Event, Market, Trade } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface FeedItem extends Trade {
    type: 'trade';
    marketDetails?: Market;
    quote?: string | null;
}

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
    const totalValue = Number.parseFloat(item.amount || '0');
    const rawName = item.user?.displayName?.trim();
    const handle = rawName ? rawName.replace(/^@+/, '') : item.user?.walletAddress?.slice(0, 6) || 'anonymous';

    // Price change calculation from candles
    const entryTimestamp = Math.floor(new Date(item.createdAt).getTime() / 1000);
    const priceChange = candles ? (getEntryPnl(candles, entryTimestamp, isYes) || getPriceChange(candles)) : null;
    const pnlText = priceChange ? `${priceChange.isPositive ? '+' : ''}${priceChange.changePercent}%` : (isYes ? '+0.0%' : '-0.0%');
    const pnlColor = priceChange ? (priceChange.isPositive ? '#22c55e' : '#ef4444') : (isYes ? '#22c55e' : '#ef4444');

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
                    <View className="flex-row items-start justify-between">
                        <Text className="text-txt-primary font-bold text-[14px]" numberOfLines={1}>
                            {handle}
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
                    {candles && candles.length > 0 ? (
                        <LightChart
                            candles={candles}
                            width={FEED_CARD_CHART_WIDTH}
                            height={FEED_CARD_CHART_HEIGHT}
                            isYes={isYes}
                            entryTimestamp={entryTimestamp}
                            entryAvatarUri={avatarUrl || undefined}
                        />
                    ) : (
                        <View className="flex-1 justify-center items-center gap-1.5 bg-gray-50">
                            <ActivityIndicator size="small" color="#9ca3af" />
                            <Text className="text-[10px] text-gray-400">Loading chart...</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View className="flex-row items-center">
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">Total Value</Text>
                        <Text className="text-[16px] font-semibold text-[#111827]">
                            ${formatValue(totalValue)}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">PNL</Text>
                        <Text className="text-[14px] font-semibold" style={{ color: pnlColor }}>
                            {pnlText}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-[#9ca3af] uppercase">Total Bought</Text>
                        <Text className="text-[16px] font-semibold text-[#111827]">
                            ${formatValue(totalValue)}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const SHEET_CHART_HEIGHT = 180;

type TimeFilter = '24h' | '1w' | '1m' | 'all';

const TIME_FILTER_OPTIONS: { key: TimeFilter; label: string; seconds: number }[] = [
    { key: '24h', label: '24H', seconds: 24 * 60 * 60 },
    { key: '1w', label: '1W', seconds: 7 * 24 * 60 * 60 },
    { key: '1m', label: '1M', seconds: 30 * 24 * 60 * 60 },
    { key: 'all', label: 'All', seconds: 365 * 24 * 60 * 60 },
];

const MarketTradeSheet = ({
    visible,
    onClose,
    item,
    candles: initialCandles,
    backendUser,
}: {
    visible: boolean;
    onClose: () => void;
    item: FeedItem | null;
    candles?: CandleData[];
    backendUser: BackendUser | null;
}) => {
    const insets = useSafeAreaInsets();
    const sheetHeight = Math.round(Dimensions.get("window").height * 0.7);
    const slideAnim = useRef(new Animated.Value(sheetHeight)).current;
    const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
    const [amount, setAmount] = useState('');
    const [quote, setQuote] = useState('');
    const [isTrading, setIsTrading] = useState(false);
    const [tradeError, setTradeError] = useState<string | null>(null);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('1w');
    const [filteredCandles, setFilteredCandles] = useState<CandleData[]>([]);
    const [isLoadingCandles, setIsLoadingCandles] = useState(false);

    // Fetch candles based on time filter
    useEffect(() => {
        if (!visible || !item?.marketDetails) return;

        const fetchFilteredCandles = async () => {
            const market = item.marketDetails;
            let marketMint: string | undefined = market?.yesMint;
            if (!marketMint && market?.accounts) {
                const accountValues = Object.values(market.accounts);
                for (const account of accountValues) {
                    if (typeof account === 'object' && account?.yesMint) {
                        marketMint = account.yesMint;
                        break;
                    }
                }
            }

            if (!marketMint) {
                setFilteredCandles(initialCandles || []);
                return;
            }

            setIsLoadingCandles(true);
            try {
                const filterOption = TIME_FILTER_OPTIONS.find(f => f.key === timeFilter);
                const endTs = Math.floor(Date.now() / 1000);
                const startTs = endTs - (filterOption?.seconds || 7 * 24 * 60 * 60);
                const periodInterval = timeFilter === '24h' ? 1 : timeFilter === '1w' ? 60 : 1440;

                const candles = await marketsApi.fetchCandlesticksByMint(marketMint, { startTs, endTs, periodInterval });
                setFilteredCandles(candles || []);
            } catch (error) {
                console.error('Failed to fetch filtered candles:', error);
                setFilteredCandles(initialCandles || []);
            } finally {
                setIsLoadingCandles(false);
            }
        };

        fetchFilteredCandles();
    }, [visible, item?.marketDetails, timeFilter, initialCandles]);

    useEffect(() => {
        if (visible) {
            setSelectedSide(item?.side || 'yes');
            setAmount('');
            setQuote('');
            setTradeError(null);
            setTimeFilter('1w');
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 30,
                stiffness: 500,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: sheetHeight,
                duration: 160,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, item?.side, sheetHeight, slideAnim]);

    const handleTrade = async () => {
        if (!item || !backendUser) {
            setTradeError("Sign in to trade");
            return;
        }
        if (!amount || Number(amount) <= 0) {
            setTradeError("Enter a valid amount");
            return;
        }
        try {
            setIsTrading(true);
            setTradeError(null);
            await api.createTrade({
                userId: backendUser.id,
                marketTicker: item.marketTicker,
                side: selectedSide,
                amount: amount,
                walletAddress: backendUser.walletAddress,
                quote: quote.trim() ? quote.trim() : undefined,
            });
            onClose();
        } catch (error: any) {
            setTradeError(error?.message || "Failed to place trade");
        } finally {
            setIsTrading(false);
        }
    };

    const market = item?.marketDetails;
    const betAmount = parseFloat(amount || '0');
    const estimatedProbability = market?.yesBid && market?.yesAsk
        ? ((parseFloat(market.yesBid) + parseFloat(market.yesAsk)) / 2) * 100
        : 50;

    const displayCandles = filteredCandles.length > 0 ? filteredCandles : (initialCandles || []);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
                    style={{ width: "100%" }}
                >
                    <Animated.View
                        style={[
                            styles.sheet,
                            {
                                paddingBottom: Math.max(insets.bottom, 20),
                                height: sheetHeight,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <Pressable onPress={(e) => e.stopPropagation()}>
                            <View className="items-center py-2">
                                <View className="w-12 h-1.5 rounded-full bg-border" />
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                                <View className="mb-4">
                                    <Text className="text-xl font-bold text-txt-primary mb-1" numberOfLines={2}>
                                        {market?.title || item?.marketTicker || 'Market'}
                                    </Text>
                                    <Text className="text-sm text-txt-secondary" numberOfLines={1}>
                                        {market?.subtitle || market?.yesSubTitle || market?.noSubTitle || 'Market'}
                                    </Text>
                                    <View className="flex-row items-center gap-3 mt-2">
                                        {market?.status && (
                                            <Text className="text-[11px] uppercase tracking-wide text-txt-disabled">
                                                {market.status}
                                            </Text>
                                        )}
                                        {market?.closeTime && (
                                            <Text className="text-[11px] text-txt-disabled">
                                                Closes {new Date(market.closeTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {/* Time Filter Tabs */}
                                <View className="flex-row gap-2 mb-3">
                                    {TIME_FILTER_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.key}
                                            className={`flex-1 py-2 rounded-lg items-center ${timeFilter === option.key ? 'bg-cyan-500/15 border border-cyan-500/40' : 'bg-app-elevated border border-border'}`}
                                            onPress={() => { setTimeFilter(option.key); Haptics.selectionAsync(); }}
                                            activeOpacity={0.8}
                                        >
                                            <Text className={`text-xs font-semibold ${timeFilter === option.key ? '' : 'text-txt-disabled'}`} style={timeFilter === option.key ? { color: Theme.accentSubtle } : {}}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View className="h-[180px] rounded-2xl overflow-hidden border border-border mb-5 bg-app-card">
                                    {isLoadingCandles ? (
                                        <View className="flex-1 justify-center items-center gap-2">
                                            <ActivityIndicator size="small" color={Theme.accentSubtle} />
                                            <Text className="text-xs text-txt-disabled">Loading chart...</Text>
                                        </View>
                                    ) : displayCandles.length > 0 ? (
                                        <LightChart
                                            candles={displayCandles}
                                            width={SCREEN_WIDTH - 40}
                                            height={SHEET_CHART_HEIGHT}
                                            isYes={selectedSide === 'yes'}
                                        />
                                    ) : (
                                        <View className="flex-1 justify-center items-center gap-2">
                                            <ActivityIndicator size="small" color={Theme.textDisabled} />
                                            <Text className="text-xs text-txt-disabled">No data available</Text>
                                        </View>
                                    )}
                                </View>

                                <View className="bg-app-card rounded-2xl p-4 border border-border mb-4">
                                    <Text className="text-xs font-bold text-txt-secondary uppercase tracking-wide mb-2">Side</Text>
                                    <View className="flex-row gap-2 mb-4">
                                        <TouchableOpacity
                                            className={`flex-1 py-3 rounded-xl border ${selectedSide === 'yes' ? 'bg-green-500/10 border-green-500/40' : 'bg-app-elevated border-border'}`}
                                            onPress={() => { setSelectedSide('yes'); Haptics.selectionAsync(); }}
                                            activeOpacity={0.8}
                                        >
                                            <Text className={`text-center font-semibold ${selectedSide === 'yes' ? 'text-status-success' : 'text-txt-disabled'}`}>Yes</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className={`flex-1 py-3 rounded-xl border ${selectedSide === 'no' ? 'bg-red-400/10 border-red-400/40' : 'bg-app-elevated border-border'}`}
                                            onPress={() => { setSelectedSide('no'); Haptics.selectionAsync(); }}
                                            activeOpacity={0.8}
                                        >
                                            <Text className={`text-center font-semibold ${selectedSide === 'no' ? 'text-status-error' : 'text-txt-disabled'}`}>No</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text className="text-xs font-bold text-txt-secondary uppercase tracking-wide mb-2">Amount</Text>
                                    <View className="flex-row items-center bg-app-elevated rounded-[14px] border border-border px-4">
                                        <Text className="text-txt-secondary text-2xl font-semibold">$</Text>
                                        <TextInput
                                            className="flex-1 text-txt-primary text-[24px] font-bold py-3 pl-1.5"
                                            placeholder="0"
                                            placeholderTextColor={Theme.textDisabled}
                                            keyboardType="decimal-pad"
                                            value={amount}
                                            onChangeText={(t) => { setAmount(t.replace(',', '.')); setTradeError(null); }}
                                        />
                                    </View>
                                    <View className="flex-row gap-2 mt-3">
                                        {['5', '10', '25', '50', '100'].map((value) => (
                                            <TouchableOpacity
                                                key={value}
                                                className={`flex-1 py-2.5 rounded-[10px] border items-center ${amount === value ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-app-elevated border-border'}`}
                                                onPress={() => { setAmount(value); Haptics.selectionAsync(); }}
                                            >
                                                <Text className={`text-[13px] font-semibold ${amount === value ? '' : 'text-txt-secondary'}`} style={amount === value ? { color: Theme.accentSubtle } : {}}>
                                                    ${value}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {betAmount > 0 && (
                                        <View className="bg-cyan-500/10 rounded-xl p-3.5 mt-3 border border-cyan-500/15">
                                            <View className="flex-row justify-between mb-1.5">
                                                <Text className="text-txt-secondary text-[13px]">If you win</Text>
                                                <Text className="text-txt-primary text-sm font-bold">
                                                    ${(betAmount * (100 / estimatedProbability)).toFixed(2)}
                                                </Text>
                                            </View>
                                            <View className="flex-row justify-between">
                                                <Text className="text-txt-secondary text-[13px]">Profit</Text>
                                                <Text className="text-status-success text-sm font-bold">
                                                    +${((betAmount * (100 / estimatedProbability)) - betAmount).toFixed(2)}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                    <View className="mt-4">
                                        <Text className="text-xs font-bold text-txt-secondary uppercase tracking-wide mb-2">Comment</Text>
                                        <TextInput
                                            className="bg-app-elevated rounded-[14px] border border-border p-4 text-txt-primary text-base min-h-[96px]"
                                            placeholder="Share your reasoning... (optional)"
                                            placeholderTextColor={Theme.textDisabled}
                                            value={quote}
                                            onChangeText={setQuote}
                                            multiline
                                            maxLength={280}
                                            textAlignVertical="top"
                                        />
                                        {quote.length > 0 && (
                                            <Text className="text-xs text-txt-disabled text-right mt-2 font-medium">{quote.length}/280</Text>
                                        )}
                                    </View>
                                    {tradeError && (
                                        <Text className="text-status-error text-xs mt-2">{tradeError}</Text>
                                    )}

                                    <TouchableOpacity
                                        className={`mt-4 rounded-2xl overflow-hidden ${isTrading ? 'opacity-70' : ''}`}
                                        onPress={handleTrade}
                                        disabled={isTrading}
                                        activeOpacity={0.85}
                                    >
                                        <LinearGradient
                                            colors={[Theme.accentSubtle, '#00B8D4']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.sheetCta}
                                        >
                                            {isTrading ? (
                                                <ActivityIndicator size="small" color={Theme.bgMain} />
                                            ) : (
                                                <>
                                                    <Ionicons name="flash" size={18} color={Theme.bgMain} />
                                                    <Text className="text-app-bg text-base font-extrabold">Place Trade</Text>
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </Pressable>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Pressable>
        </Modal>
    );
};


export default function SocialScreen() {
    const { backendUser } = useUser();
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
            const [results, events] = await Promise.all([
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
                if (!hasUserRef.current) {
                    animateToMode('global');
                    return;
                }
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
                                <Text className={`text-lg font-semibold ${isGlobalActive ? 'text-txt-primary' : 'text-txt-disabled'}`}>
                                    For you
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="relative pb-2"
                                onPress={() => {
                                    if (!backendUser) return;
                                    if (modeRef.current !== 'following') {
                                        triggerHaptic();
                                    }
                                    animateToMode('following');
                                }}
                                disabled={!backendUser}
                                onLayout={(event) => {
                                    const { x, width } = event.nativeEvent.layout;
                                    setTabLayouts(prev => ({ ...prev, following: { x, width } }));
                                }}
                            >
                                <Text
                                    className={`text-lg font-semibold ${isFollowingActive && backendUser
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
                                    const items = feedItemsByMode[pageMode];
                                    const isLoadingFeed = isLoadingFeedByMode[pageMode];
                                    const isLoadingMore = isLoadingMoreByMode[pageMode];
                                    const refreshing = refreshingByMode[pageMode];
                                    return (
                                        <View key={pageMode} style={styles.listPane}>
                                            {isLoadingFeed && items.length === 0 ? (
                                                <View className="flex-1 justify-center items-center gap-3">
                                                    <ActivityIndicator size="large" color={Theme.accentSubtle} />
                                                    <Text className="text-sm text-txt-secondary">Loading feed...</Text>
                                                </View>
                                            ) : (
                                                <FlatList
                                                    data={items}
                                                    keyExtractor={(feedItem) => feedItem.id}
                                                    renderItem={({ item: feedItem }) => (
                                                        <FeedCard
                                                            item={feedItem}
                                                            candles={candlesMap[feedItem.marketTicker]}
                                                            onPress={() => handleOpenTradeSheet(feedItem)}
                                                            onUserPress={() => feedItem.user?.id && router.push({ pathname: '/user/[userId]', params: { userId: feedItem.user.id } })}
                                                            onChartPress={() => handleOpenTradeSheet(feedItem)}
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
                item={tradeSheetItem}
                candles={tradeSheetItem ? candlesMap[tradeSheetItem.marketTicker] : undefined}
                backendUser={backendUser || null}
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
    sheetCta: {
        height: 52,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
    },
});
