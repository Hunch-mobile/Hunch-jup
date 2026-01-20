import { Theme } from '@/constants/theme';
import { marketsApi } from '@/lib/api';
import { formatVolume, getMarketDisplayTitle, getScoredEventsForRail } from '@/lib/marketUtils';
import { CandleData, Event, Market } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AnimatedPrice from './AnimatedPrice';
import { MiniChart } from './MiniChart';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_MARGIN = 8;
const CHART_HEIGHT = 100;

interface RailItem {
    event: Event;
    market: Market;
    score: number;
}

// Cache for candle data
const candleCache = new Map<string, { data: CandleData[]; timestamp: number }>();
const CANDLE_CACHE_DURATION = 2 * 60 * 1000;

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

// RailCard component
const RailCard = ({
    item,
    candlesMap,
    onInteractionStart,
    onInteractionEndCallback,
}: {
    item: RailItem;
    candlesMap: Record<string, CandleData[]>;
    onInteractionStart: () => void;
    onInteractionEndCallback: () => void;
}) => {
    const { event, market } = item;
    const marketTitle = getMarketDisplayTitle(market);
    const volume = formatVolume(event.volume || event.volume24h);
    const candles = candlesMap[market.ticker] || [];
    const priceChange = getPriceChange(candles);
    const baseIsPositive = priceChange?.isPositive ?? true;
    const basePrice = priceChange?.currentPrice ?? (market.yesBid || 0);
    const firstPrice = candles.length > 0 ? Number(candles[0].close) : (typeof basePrice === 'number' ? basePrice : 0);

    const [displayPrice, setDisplayPrice] = useState<number>(typeof basePrice === 'number' ? basePrice : 0);
    const [isInteracting, setIsInteracting] = useState(false);

    const numDisplayPrice = Number(displayPrice);
    const scrubChangePercent = firstPrice > 0 ? ((numDisplayPrice - firstPrice) / firstPrice) * 100 : 0;
    const scrubIsPositive = scrubChangePercent >= 0;
    const isPositive = isInteracting ? scrubIsPositive : baseIsPositive;
    const displayChangePercent = isInteracting ? scrubChangePercent.toFixed(1) : priceChange?.changePercent;

    useEffect(() => {
        if (!isInteracting && typeof basePrice === 'number') setDisplayPrice(basePrice);
    }, [basePrice, isInteracting]);

    const handlePriceSelect = useCallback((price: number) => {
        setDisplayPrice(price);
        setIsInteracting(true);
    }, []);

    const handleInteractionStart = useCallback(() => {
        setIsInteracting(true);
        onInteractionStart();
    }, [onInteractionStart]);

    const handleInteractionEnd = useCallback(() => {
        setIsInteracting(false);
        if (typeof basePrice === 'number') setDisplayPrice(basePrice);
        onInteractionEndCallback();
    }, [basePrice, onInteractionEndCallback]);

    const handleCardPress = () => {
        router.push({ pathname: '/event/[ticker]', params: { ticker: event.ticker } });
    };

    return (
        <TouchableOpacity style={styles.railCard} activeOpacity={0.9} onPress={handleCardPress}>
            <View className="p-4">
                {/* Header Row */}
                <View className="flex-row items-start mb-4 gap-3">
                    {event.imageUrl ? (
                        <Image source={{ uri: event.imageUrl }} className="w-14 h-14 rounded-xl" contentFit="cover" transition={200} />
                    ) : (
                        <View className="w-14 h-14 rounded-xl bg-app-elevated justify-center items-center">
                            <Ionicons name="stats-chart" size={20} color={Theme.textDisabled} />
                        </View>
                    )}
                    <View className="flex-1">
                        {event.competition && (
                            <Text className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: Theme.chartLine }}>
                                {event.competition}
                            </Text>
                        )}
                        <Text className="text-[15px] font-bold text-txt-primary leading-5 tracking-tight" numberOfLines={2}>
                            {marketTitle}
                        </Text>
                    </View>
                </View>

                {/* Price Row */}
                <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-white/10">
                    <View className="flex-row items-center gap-2.5">
                        <AnimatedPrice
                            value={typeof displayPrice === 'number' ? displayPrice : 0}
                            format="cents"
                            style={{ fontSize: 26, fontWeight: '800', color: isPositive ? Theme.chartPositive : Theme.chartNegative }}
                        />
                        {(priceChange || isInteracting) && (
                            <View className={`flex-row items-center px-2 py-1 rounded-md gap-0.5 ${isPositive ? 'bg-yellow-500/15' : 'bg-pink-500/15'}`}>
                                <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={10} color={isPositive ? Theme.chartPositive : Theme.chartNegative} />
                                <Text className="text-xs font-bold" style={{ color: isPositive ? Theme.chartPositive : Theme.chartNegative }}>
                                    {isPositive ? '+' : ''}{displayChangePercent}%
                                </Text>
                            </View>
                        )}
                    </View>
                    {volume !== '—' && !isInteracting && (
                        <Text className="text-xs font-medium text-txt-secondary">Vol: {volume}</Text>
                    )}
                </View>

                {/* Chart */}
                <View style={styles.chartContainer}>
                    {candles.length > 0 ? (
                        <MiniChart
                            candles={candles}
                            width={CARD_WIDTH - 32}
                            height={CHART_HEIGHT}
                            showLiveDot={!isInteracting}
                            onInteractionStart={handleInteractionStart}
                            onPriceSelect={handlePriceSelect}
                            onInteractionEnd={handleInteractionEnd}
                        />
                    ) : (
                        <View className="h-[100px] justify-center items-center gap-2 rounded-xl" style={{ backgroundColor: Theme.chartBackground }}>
                            <ActivityIndicator size="small" color={Theme.textDisabled} />
                            <Text className="text-[11px] text-txt-disabled">Loading chart...</Text>
                        </View>
                    )}
                </View>

                {/* Live Indicator */}
                <View className="flex-row items-center justify-center gap-1.5 mt-2">
                    <View className={`w-1.5 h-1.5 rounded-full ${isInteracting ? 'bg-chart-negative' : 'bg-chart-positive'}`} />
                    <Text className="text-[10px] font-bold text-txt-secondary tracking-wide">
                        {isInteracting ? 'SCRUBBING' : 'LIVE'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export const MarketRail = () => {
    const [railItems, setRailItems] = useState<RailItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [candlesMap, setCandlesMap] = useState<Record<string, CandleData[]>>({});
    const [scrollEnabled, setScrollEnabled] = useState(true);

    useEffect(() => {
        loadRailData();
    }, []);

    const loadRailData = async () => {
        try {
            setLoading(true);
            const { events } = await marketsApi.fetchEvents(100, { status: 'active', withNestedMarkets: true });
            const scoredItems = getScoredEventsForRail(events, 7);
            setRailItems(scoredItems);
            fetchAllCandles(scoredItems);
        } catch (error) {
            console.error('Failed to load market rail:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllCandles = useCallback(async (items: RailItem[]) => {
        const newCandlesMap: Record<string, CandleData[]> = {};

        await Promise.all(
            items.map(async (item) => {
                let marketMint: string | undefined = item.market.yesMint;
                if (!marketMint && item.market.accounts) {
                    const accountValues = Object.values(item.market.accounts);
                    for (const account of accountValues) {
                        if (typeof account === 'object' && account?.yesMint) {
                            marketMint = account.yesMint;
                            break;
                        }
                    }
                }

                if (!marketMint) {
                    newCandlesMap[item.market.ticker] = [];
                    return;
                }

                const cached = candleCache.get(marketMint);
                if (cached && Date.now() - cached.timestamp < CANDLE_CACHE_DURATION) {
                    newCandlesMap[item.market.ticker] = cached.data;
                    return;
                }

                try {
                    const endTs = Math.floor(Date.now() / 1000);
                    const startTs = endTs - (7 * 24 * 60 * 60); // 1 week = 604800 seconds
                    console.log(`[MarketRail] Fetching candles for ${item.market.ticker}: startTs=${startTs}, endTs=${endTs}, range=${new Date(startTs * 1000).toISOString()} to ${new Date(endTs * 1000).toISOString()}`);
                    const candles = await marketsApi.fetchCandlesticksByMint(marketMint, { startTs, endTs, periodInterval: 60 });
                    console.log(`[MarketRail] Got ${candles?.length || 0} candles for ${item.market.ticker}`);
                    newCandlesMap[item.market.ticker] = candles || [];
                    if (candles?.length > 0) candleCache.set(marketMint, { data: candles, timestamp: Date.now() });
                } catch (error) {
                    console.error(`[MarketRail] Error fetching candles for ${item.market.ticker}:`, error);
                    newCandlesMap[item.market.ticker] = [];
                }
            })
        );
        setCandlesMap(newCandlesMap);
    }, []);

    if (loading) {
        return (
            <View className="py-10 items-center">
                <ActivityIndicator size="small" color={Theme.accent} />
            </View>
        );
    }

    if (railItems.length === 0) return null;

    return (
        <View className="py-5 bg-app-bg">
            {/* Header */}
            <View className="flex-row items-center px-5 mb-4 gap-2">
                <Text className="text-3xl font-extrabold text-txt-primary tracking-tight">Trending Markets</Text>
                <Ionicons name="flame" size={18} color={Theme.chartLine} />
            </View>

            <FlatList
                horizontal
                data={railItems}
                keyExtractor={(item) => item.event.ticker}
                renderItem={({ item }) => (
                    <RailCard
                        item={item}
                        candlesMap={candlesMap}
                        onInteractionStart={() => setScrollEnabled(false)}
                        onInteractionEndCallback={() => setScrollEnabled(true)}
                    />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12 }}
                snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
                decelerationRate="fast"
                snapToAlignment="start"
                scrollEnabled={scrollEnabled}
            />
        </View>
    );
};

// Minimal styles for card dimensions and chart
const styles = StyleSheet.create({
    railCard: {
        width: CARD_WIDTH,
        backgroundColor: Theme.bgCard,
        borderRadius: 20,
        marginHorizontal: CARD_MARGIN,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    chartContainer: {
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: CHART_HEIGHT,
    },
});
