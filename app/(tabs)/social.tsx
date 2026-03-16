import LightChart from '@/components/LightChart';
import { MarketTradeSheet } from '@/components/MarketTradeSheet';
import NotificationSidebar from '@/components/NotificationSidebar';
import PostComposerSheet from '@/components/PostComposerSheet';
import { ListFooterSkeleton, SocialFeedSkeleton } from '@/components/skeletons';
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, followApi, marketsApi, polymarketApi } from "@/lib/api";
import { invertCandlesForNoSide } from "@/lib/marketUtils";
import { User as BackendUser, CandleData, Event, FeedSignalItemResponse, ForYouFeedItem, Market, TopTraderTradeItem } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clusterApiUrl, Connection } from "@solana/web3.js";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, Linking, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface TopTraderFeedItem {
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

type SocialFeedItem = ForYouFeedItem;

const mapTopTraderTrade = (t: TopTraderTradeItem): TopTraderFeedItem => ({
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

const normalizeFollowingSignal = (item: FeedSignalItemResponse): SocialFeedItem => ({
    ...item,
    kind: 'signal',
    rankScore: item.score ?? 0,
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
const FeedCard = React.memo(({
    item,
    candles,
    onPress,
    onUserPress,
    onChartPress,
    onFollow,
    isFollowInProgress,
    isLoadingTrade,
}: {
    item: TopTraderFeedItem;
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
    const priceDisplay = `${Math.round(item.price * 100)}¢`;

    return (
        <View className="mx-5 mb-4">
            {/* Tweet-style header: avatar + content */}
            <View className="flex-row items-start">
                <TouchableOpacity className="mr-3" onPress={onUserPress} activeOpacity={0.7}>
                    <View className="w-[38px] h-[38px] rounded-full justify-center items-center bg-app-card border border-border overflow-hidden">
                        <Image
                            source={avatarUrl ? { uri: avatarUrl } : defaultProfileImage}
                            className="w-full h-full rounded-full"
                        />
                    </View>
                </TouchableOpacity>
                <View className="flex-1">
                    {/* Name + action + follow + time */}
                    <View className="flex-row items-center justify-between mb-1">
                        <View className="flex-row items-center flex-1 mr-2">
                            <Text className="text-[14px] font-bold text-[#111]" numberOfLines={1}>
                                {handle}
                                {item.trader.verifiedBadge ? ' ✓' : ''}
                            </Text>
                            <Text style={{ color: isSell ? '#FF10F0' : '#32de12', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>
                                {isSell ? 'sold' : 'bought'}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            {onFollow && (
                                <TouchableOpacity
                                    className={`py-1 px-3 rounded-full border ${isFollowing ? 'border-[#ccc] bg-transparent' : 'bg-[#111] border-[#111]'} ${isFollowInProgress ? 'opacity-60' : ''}`}
                                    onPress={(e) => { e.stopPropagation(); onFollow(); }}
                                    disabled={isFollowInProgress}
                                >
                                    {isFollowInProgress ? (
                                        <ActivityIndicator size="small" color={isFollowing ? '#111' : '#fff'} />
                                    ) : (
                                        <Text className={`text-[11px] font-semibold ${isFollowing ? 'text-[#666]' : 'text-white'}`}>
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            <Text className="text-[12px] text-[#999]">{getTimeAgo(item.timestamp)}</Text>
                        </View>
                    </View>

                    {/* Trade action text */}
                    <Text className="text-[15px] text-[#1a1a1a] leading-[21px] mb-2">
                        {isSell ? 'Sold' : 'Bought'}{' '}
                        <Text style={{ fontWeight: '700', color: item.outcome === 'No' ? '#FF10F0' : '#32de12' }}>
                            {item.outcome === 'Yes' ? 'YES' : item.outcome === 'No' ? 'NO' : item.outcome.toUpperCase()}
                        </Text>
                        {' '}at {priceDisplay} · ${formatValue(totalBought)}
                    </Text>

                    {/* Market card - tappable to trade */}
                    <TouchableOpacity
                        className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden"
                        activeOpacity={isLoadingTrade ? 1 : 0.7}
                        onPress={isLoadingTrade ? undefined : onChartPress}
                        style={{ opacity: isLoadingTrade ? 0.6 : 1 }}
                    >
                        {isLoadingTrade && (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.5)' }}>
                                <ActivityIndicator size="small" color="#6b7280" />
                            </View>
                        )}

                        {/* Chart */}
                        <View className="h-[72px] overflow-hidden">
                            {chartCandles && chartCandles.length > 0 ? (
                                <LightChart
                                    candles={chartCandles}
                                    width={FEED_CARD_CHART_WIDTH - 50}
                                    height={FEED_CARD_CHART_HEIGHT}
                                    colorByTrend={true}
                                    entryTimestamp={entryTimestamp}
                                    entryAvatarUri={avatarUrl || undefined}
                                />
                            ) : (
                                <View className="flex-1 justify-center items-center">
                                    <Ionicons name="analytics-outline" size={16} color="#ccc" />
                                </View>
                            )}
                        </View>

                        {/* Market info + stats row */}
                        <View className="px-3 py-2.5 border-t border-[#F0F0F0]">
                            <Text className="text-[13px] font-semibold text-[#111] mb-1.5" numberOfLines={2}>
                                {marketLabel}
                            </Text>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-3">
                                    <View>
                                        <Text className="text-[10px] text-[#999] uppercase">Bought</Text>
                                        <Text className="text-[13px] font-semibold text-[#111]">${formatValue(totalBought)}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[10px] text-[#999] uppercase">PnL</Text>
                                        <Text className="text-[13px] font-semibold" style={{ color: pnlColor }}>{pnlText}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[10px] text-[#999] uppercase">Value</Text>
                                        <Text className="text-[13px] font-semibold text-[#111]">${formatValue(totalValue)}</Text>
                                    </View>
                                </View>
                                <View className="bg-[#111] rounded-lg px-3 py-1.5">
                                    <Text className="text-[11px] font-bold text-white">Trade</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Separator */}
            <View style={{ height: 1, backgroundColor: '#F0F0F0', marginLeft: 50, marginTop: 12 }} />
        </View>
    );
});

const SignalCard = React.memo(({ item }: { item: FeedSignalItemResponse }) => {
    const titleByType: Record<FeedSignalItemResponse['type'], string> = {
        TRADE_MILESTONE: 'Trade milestone',
        POSITION_CLOSED: 'Position closed',
        NEWS: 'News signal',
        LEADER_ACTIVITY: 'Leader activity',
    };
    const avatarUrl = item.user?.avatarUrl?.replace('_normal', '');
    const displayName = item.user?.displayName || (item.user?.walletAddress ? formatHandle(item.user.walletAddress) : 'System');

    return (
        <View className="mx-5 mb-5 rounded-2xl border border-[#E8E8E8] bg-white p-4">
            <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                    <View className="w-9 h-9 rounded-full overflow-hidden bg-app-card border border-border mr-2.5">
                        <Image
                            source={avatarUrl ? { uri: avatarUrl } : defaultProfileImage}
                            className="w-full h-full rounded-full"
                        />
                    </View>
                    <Text className="text-[14px] font-semibold text-txt-primary">{displayName}</Text>
                </View>
                <Text className="text-[12px] text-txt-disabled">{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text className="text-[13px] font-semibold text-txt-primary mb-1.5">{titleByType[item.type]}</Text>
            {item.evidence?.headline ? (
                <Text className="text-[14px] text-txt-primary leading-[20px]">{item.evidence.headline}</Text>
            ) : (
                <Text className="text-[14px] text-txt-secondary leading-[20px]">
                    {item.marketTicker}
                    {item.eventTicker ? ` • ${item.eventTicker}` : ''}
                </Text>
            )}
        </View>
    );
});

// Hardcoded avatar map for known tweet accounts
const TWEET_AVATAR_MAP: Record<string, string> = {
    Polymarket: 'https://pbs.twimg.com/profile_images/1654104878727127040/PlBJSj6Q_normal.jpg',
    Reuters: 'https://pbs.twimg.com/profile_images/1194751949821939712/3VBu4_rH_normal.jpg',
    zerohedge: 'https://pbs.twimg.com/profile_images/1164570825312858113/wvX14fqG_normal.jpg',
    WatcherGuru: 'https://pbs.twimg.com/profile_images/1530986517462532097/JuaENRXX_normal.jpg',
    unusual_whales: 'https://pbs.twimg.com/profile_images/1587915457003167745/ZwithJwz_normal.jpg',
    solana: 'https://pbs.twimg.com/profile_images/1849973741498933248/KTKFP6I7_normal.jpg',
    AutismCapital: 'https://pbs.twimg.com/profile_images/1587908633470214144/b03RrEe5_normal.jpg',
};

const formatTweetMetric = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
};

const getTweetTimeAgo = (dateString: string): string => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
};

const stripTcoUrls = (text: string): string => text.replace(/https?:\/\/t\.co\/\w+/g, '').trim();

const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) return '—';
    return `${Math.round(price * 100)}¢`;
};

const TweetCard = React.memo(({ item }: { item: Extract<SocialFeedItem, { kind: 'tweet' }> }) => {
    const { tweet } = item;
    const avatarUrl = TWEET_AVATAR_MAP[tweet.username]?.replace('_normal', '') ?? null;
    const visibleEvents = tweet.matchedEvents.slice(0, 2);
    const hasMedia = tweet.mediaUrls && tweet.mediaUrls.length > 0;

    return (
        <View className="mx-5 mb-4">
            {/* Tweet header row */}
            <View className="flex-row items-start mb-2.5">
                <TouchableOpacity
                    className="mr-3"
                    onPress={() => Linking.openURL(`https://x.com/${tweet.username}`)}
                    activeOpacity={0.7}
                >
                    <View className="w-[38px] h-[38px] rounded-full overflow-hidden bg-[#F0F0F0] justify-center items-center">
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} className="w-full h-full rounded-full" />
                        ) : (
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{tweet.username.charAt(0).toUpperCase()}</Text>
                        )}
                    </View>
                </TouchableOpacity>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1 mr-2">
                            <Text className="text-[14px] font-bold text-[#111]" numberOfLines={1}>
                                @{tweet.username}
                            </Text>
                        </View>
                        <Text className="text-[12px] text-[#999]">{getTweetTimeAgo(tweet.postedAt)}</Text>
                    </View>

                    {/* Tweet body */}
                    <Text className="text-[15px] text-[#1a1a1a] leading-[21px] mt-1">
                        {stripTcoUrls(tweet.content)}
                    </Text>

                    {/* Media images */}
                    {hasMedia && (
                        <View className="mt-2.5 rounded-xl overflow-hidden border border-[#EDEDED]">
                            {tweet.mediaUrls.length === 1 ? (
                                <Image
                                    source={{ uri: tweet.mediaUrls[0] }}
                                    style={{ width: '100%', height: 200 }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="flex-row flex-wrap">
                                    {tweet.mediaUrls.slice(0, 4).map((url, i) => (
                                        <Image
                                            key={i}
                                            source={{ uri: url }}
                                            style={{ width: '50%', height: 120 }}
                                            resizeMode="cover"
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Matched event cards — trade-oriented */}
                    {visibleEvents.length > 0 && (
                        <View className="mt-2.5 rounded-xl border border-[#E8E8E8] overflow-hidden bg-white">
                            {visibleEvents.map((ev, idx) => (
                                <TouchableOpacity
                                    key={ev.eventTicker}
                                    className={`flex-row items-center py-3 px-3 ${idx > 0 ? 'border-t border-[#F0F0F0]' : ''}`}
                                    activeOpacity={0.6}
                                    onPress={() => router.push({ pathname: '/event/[ticker]', params: { ticker: ev.eventTicker } })}
                                >
                                    {ev.imageUrl && (
                                        <View className="w-10 h-10 rounded-lg overflow-hidden bg-[#F5F5F5] mr-3">
                                            <Image source={{ uri: ev.imageUrl }} className="w-full h-full" resizeMode="cover" />
                                        </View>
                                    )}
                                    <View className="flex-1 mr-2">
                                        <Text className="text-[13px] font-semibold text-[#111]" numberOfLines={2}>
                                            {ev.eventTitle}
                                        </Text>
                                        {ev.yesPrice !== null && ev.yesPrice !== undefined ? (
                                            <View className="flex-row items-center gap-2 mt-0.5">
                                                <Text className="text-[11px] font-semibold text-[#22c55e]">Yes {formatPrice(ev.yesPrice)}</Text>
                                                <Text className="text-[11px] font-semibold text-[#ef4444]">No {formatPrice(ev.noPrice)}</Text>
                                            </View>
                                        ) : (
                                            <Text className="text-[11px] text-[#999] mt-0.5">Tap to trade</Text>
                                        )}
                                    </View>
                                    <View className="bg-[#111] rounded-lg px-3 py-1.5">
                                        <Text className="text-[11px] font-bold text-white">Trade</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Tweet metrics row */}
                    <View className="flex-row items-center justify-between mt-2.5 pr-1">
                        <View className="flex-row items-center gap-4">
                            <View className="flex-row items-center gap-1">
                                <Ionicons name="heart-outline" size={14} color="#999" />
                                <Text className="text-[12px] text-[#999]">{formatTweetMetric(tweet.metrics.likeCount)}</Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                                <Ionicons name="repeat-outline" size={14} color="#999" />
                                <Text className="text-[12px] text-[#999]">{formatTweetMetric(tweet.metrics.retweetCount)}</Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                                <Ionicons name="chatbubble-outline" size={14} color="#999" />
                                <Text className="text-[12px] text-[#999]">{formatTweetMetric(tweet.metrics.replyCount)}</Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                                <Ionicons name="eye-outline" size={14} color="#999" />
                                <Text className="text-[12px] text-[#999]">{formatTweetMetric(tweet.metrics.impressionCount)}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => Linking.openURL(`https://x.com/${tweet.username}/status/${tweet.tweetId}`)}
                            activeOpacity={0.6}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text className="text-[12px] text-[#999] font-medium">X ↗</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Separator line */}
            <View style={{ height: 1, backgroundColor: '#F0F0F0', marginLeft: 50 }} />
        </View>
    );
});

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

    const [feedItemsByMode, setFeedItemsByMode] = useState<{ global: SocialFeedItem[]; following: SocialFeedItem[] }>({
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
    const cursorByModeRef = useRef<{ global: string | null; following: string | null }>({
        global: null,
        following: null,
    });
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
    const [tradeSheetItem, setTradeSheetItem] = useState<TopTraderFeedItem | null>(null);
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

    const handleOpenTradeSheet = useCallback(async (item: TopTraderFeedItem) => {
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
    const hydrateCandles = useCallback((items: TopTraderFeedItem[]) => {
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
            cursorByModeRef.current.following = null;
            return;
        }
        if (reset) {
            setIsLoadingFeedByMode(prev => ({ ...prev, [targetMode]: true }));
            setFeedErrorByMode(prev => ({ ...prev, [targetMode]: null }));
        } else {
            setIsLoadingMoreByMode(prev => ({ ...prev, [targetMode]: true }));
        }
        try {
            const requestCursor = reset ? undefined : (cursorByModeRef.current[targetMode] ?? undefined);
            let nextItems: SocialFeedItem[] = [];
            let nextCursor: string | null = null;
            if (targetMode === 'following') {
                const response = await api.getFollowingFeed({
                    userId: backendUser!.id,
                    limit: 20,
                    cursor: requestCursor,
                });
                nextItems = response.items.map(normalizeFollowingSignal);
                nextCursor = response.nextCursor;
            } else {
                const response = await api.getForYouFeed({
                    userId: backendUser?.id,
                    limit: 20,
                    cursor: requestCursor,
                });
                nextItems = response.items;
                nextCursor = response.nextCursor;
            }
            const topTraderItems = nextItems
                .filter((item): item is Extract<SocialFeedItem, { kind: 'top_trader_trade' }> => item.kind === 'top_trader_trade')
                .map((item) => mapTopTraderTrade(item.trade));

            hydrateCandles(topTraderItems);

            setFeedItemsByMode(prev => {
                const existing = reset ? [] : prev[targetMode];
                const dedupe = new Map<string, SocialFeedItem>();
                [...existing, ...nextItems].forEach((item) => {
                    dedupe.set(`${item.kind}-${item.id}`, item);
                });
                return {
                    ...prev,
                    [targetMode]: Array.from(dedupe.values()),
                };
            });
            setHasMoreByMode(prev => ({ ...prev, [targetMode]: Boolean(nextCursor) }));
            cursorByModeRef.current[targetMode] = nextCursor;
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
                        item.kind === 'top_trader_trade' && item.trade.trader.walletAddress === walletAddress
                            ? { ...item, trade: { ...item.trade, trader: { ...item.trade.trader, isFollowing: false } } }
                            : item
                    ),
                }));
            } else {
                await followApi.followExternalProfile({ walletAddress, source: 'polymarket' });
                setFollowingExternalWallets(prev => new Set([...prev, walletAddress]));
                setFeedItemsByMode(prev => ({
                    ...prev,
                    global: prev.global.map(item =>
                        item.kind === 'top_trader_trade' && item.trade.trader.walletAddress === walletAddress
                            ? { ...item, trade: { ...item.trade, trader: { ...item.trade.trader, isFollowing: true } } }
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
            feedItemsByMode[targetMode].length > 0 &&
            !!cursorByModeRef.current[targetMode]
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

                                    const getItemTime = (item: SocialFeedItem): number => {
                                        if ('createdAt' in item) return new Date(item.createdAt).getTime();
                                        return 0;
                                    };
                                    const mixedFeed = [...tradeItems].sort((a, b) => getItemTime(b) - getItemTime(a));

                                    return (
                                        <View key={pageMode} style={styles.listPane}>
                                            {isLoadingFeed && tradeItems.length === 0 ? (
                                                <SocialFeedSkeleton />
                                            ) : (
                                                <FlatList
                                                    data={mixedFeed}
                                                    keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
                                                    renderItem={({ item: entry }) => {
                                                        if (entry.kind === 'top_trader_trade') {
                                                            const tradeItem = mapTopTraderTrade(entry.trade);
                                                            return (
                                                                <FeedCard
                                                                    item={tradeItem}
                                                                    candles={candlesMap[tradeItem.conditionId]}
                                                                    onPress={() => handleOpenTradeSheet(tradeItem)}
                                                                    onUserPress={() => router.push({ pathname: '/profile/[identifier]', params: { identifier: tradeItem.trader.walletAddress } })}
                                                                    onChartPress={() => handleOpenTradeSheet(tradeItem)}
                                                                    onFollow={pageMode === 'global' && backendUser ? () => handleFollowExternalTrader(tradeItem.trader.walletAddress) : undefined}
                                                                    isFollowInProgress={followingExternalInProgress.has(tradeItem.trader.walletAddress)}
                                                                    isLoadingTrade={loadingTradeForId === tradeItem.id}
                                                                />
                                                            );
                                                        }
                                                        if (entry.kind === 'tweet') {
                                                            return <TweetCard item={entry} />;
                                                        }
                                                        return <SignalCard item={entry} />;
                                                    }}
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
