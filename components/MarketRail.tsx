import { marketsApi } from '@/lib/api';
import { formatVolume, getMarketDisplayTitle, getScoredEventsForRail } from '@/lib/marketUtils';
import { CandleData, Event, Market } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Import theme
import { Theme } from '@/constants/theme';
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

// Cache for candle data to avoid refetching
const candleCache = new Map<string, { data: CandleData[]; timestamp: number }>();
const CANDLE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Helper function for price change calculation
const getPriceChange = (candles: CandleData[]) => {
    if (!candles || candles.length < 2) return null;

    const latest = candles[candles.length - 1];
    const first = candles[0];

    const change = latest.close - first.close;
    const changePercent = first.close > 0 ? (change / first.close) * 100 : 0;

    return {
        change: change,
        changePercent: changePercent.toFixed(1),
        isPositive: change >= 0,
        currentPrice: latest.close,
    };
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
            const events = await marketsApi.fetchEvents(100, {
                status: 'active',
                withNestedMarkets: true,
            });

            const scoredItems = getScoredEventsForRail(events, 7);
            setRailItems(scoredItems);

            // Fetch candle data for all markets in parallel
            fetchAllCandles(scoredItems);
        } catch (error) {
            console.error('Failed to load market rail:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllCandles = useCallback(async (items: RailItem[]) => {
        const newCandlesMap: Record<string, CandleData[]> = {};

        console.log(`[MarketRail] Starting to fetch candles for ${items.length} markets`);

        await Promise.all(
            items.map(async (item) => {
                // Look for yesMint at top level first, then in accounts object
                // The API returns mints in accounts when fetching events with withNestedMarkets=true
                let marketMint: string | undefined = item.market.yesMint;

                // If not at top level, check inside accounts object
                if (!marketMint && item.market.accounts) {
                    // accounts is Record<string, { yesMint?, noMint?, ... }>
                    const accountValues = Object.values(item.market.accounts);
                    for (const account of accountValues) {
                        if (typeof account === 'object' && account?.yesMint) {
                            marketMint = account.yesMint;
                            break;
                        }
                    }
                }

                if (!marketMint) {
                    console.warn(`[MarketRail] ⚠ No yesMint for market ${item.market.ticker}. Market data:`, {
                        ticker: item.market.ticker,
                        title: item.market.title,
                        status: item.market.status,
                        yesMint: item.market.yesMint,
                        noMint: item.market.noMint,
                        accounts: item.market.accounts,
                    });
                    newCandlesMap[item.market.ticker] = [];
                    return;
                }

                // Check cache first
                const cached = candleCache.get(marketMint);
                if (cached && Date.now() - cached.timestamp < CANDLE_CACHE_DURATION) {
                    console.log(`[MarketRail] ✓ Using cached candles for ${item.market.ticker} (${cached.data.length} candles)`);
                    newCandlesMap[item.market.ticker] = cached.data;
                    return;
                }

                try {
                    // Calculate time range for last 30 days with daily intervals
                    // API only accepts periodInterval: 1 (second), 60 (minute), or 1440 (day)
                    const endTs = Math.floor(Date.now() / 1000);
                    const startTs = endTs - (30 * 24 * 60 * 60); // 30 days ago
                    const periodInterval = 1440; // 1 day in minutes (API expects minutes, not seconds)

                    const url = `https://a.prediction-markets-api.dflow.net/api/v1/market/by-mint/${marketMint}/candlesticks?startTs=${startTs}&endTs=${endTs}&periodInterval=${periodInterval}`;
                    console.log(`[MarketRail] 🔄 Fetching for ${item.market.ticker}: ${url.substring(0, 120)}...`);

                    const candles = await marketsApi.fetchCandlesticksByMint(marketMint, {
                        startTs,
                        endTs,
                        periodInterval,
                    });

                    if (candles && candles.length > 0) {
                        console.log(`[MarketRail] ✓ Fetched ${candles.length} candles for ${item.market.ticker}`);
                        console.log(`[MarketRail]   First candle:`, {
                            timestamp: new Date(candles[0].timestamp * 1000).toISOString(),
                            open: candles[0].open.toFixed(4),
                            high: candles[0].high.toFixed(4),
                            low: candles[0].low.toFixed(4),
                            close: candles[0].close.toFixed(4),
                        });
                        console.log(`[MarketRail]   Last candle:`, {
                            timestamp: new Date(candles[candles.length - 1].timestamp * 1000).toISOString(),
                            close: candles[candles.length - 1].close.toFixed(4),
                        });
                    } else {
                        console.warn(`[MarketRail] ⚠ No candles returned for ${item.market.ticker}`);
                    }

                    newCandlesMap[item.market.ticker] = candles || [];
                    if (candles && candles.length > 0) {
                        candleCache.set(marketMint, { data: candles, timestamp: Date.now() });
                    }
                } catch (error) {
                    console.error(`[MarketRail] ✗ Failed to fetch candlesticks for ${item.market.ticker}:`, error);
                    newCandlesMap[item.market.ticker] = [];
                }
            })
        );
        setCandlesMap(newCandlesMap);
    }, []);

    // Format price as cents
    const formatCents = (price: number): string => {
        const cents = Math.round(price * 100);
        return `${cents}¢`;
    };

    // Individual RailCard component to enable state management for interactive price
    const RailCard = ({
        item,
        candlesMap,
        onInteractionStart,
        onInteractionEndCallback
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

        // State for interactive price when touching chart
        const [displayPrice, setDisplayPrice] = useState<number>(typeof basePrice === 'number' ? basePrice : 0);
        const [isInteracting, setIsInteracting] = useState(false);

        // Calculate real-time percentage change during scrubbing
        const numDisplayPrice = Number(displayPrice);
        const scrubChangePercent = firstPrice > 0 ? ((numDisplayPrice - firstPrice) / firstPrice) * 100 : 0;
        const scrubIsPositive = scrubChangePercent >= 0;

        // Use scrub values when interacting, otherwise use base values
        const isPositive = isInteracting ? scrubIsPositive : baseIsPositive;
        const displayChangePercent = isInteracting ? scrubChangePercent.toFixed(1) : priceChange?.changePercent;

        // Reset display price when base price changes (and not interacting)
        useEffect(() => {
            if (!isInteracting && typeof basePrice === 'number') {
                setDisplayPrice(basePrice);
            }
        }, [basePrice, isInteracting]);

        // Callback when user selects a point on the chart
        const handlePriceSelect = useCallback((price: number, _index: number) => {
            setDisplayPrice(price);
            setIsInteracting(true);
        }, []);

        // Callback when chart interaction starts (called immediately on touch)
        const handleInteractionStart = useCallback(() => {
            setIsInteracting(true);
            onInteractionStart();
        }, [onInteractionStart]);

        // Callback when chart interaction ends
        const handleInteractionEnd = useCallback(() => {
            // Reset to current price after delay
            setIsInteracting(false);
            if (typeof basePrice === 'number') {
                setDisplayPrice(basePrice);
            }
            onInteractionEndCallback();
        }, [basePrice, onInteractionEndCallback]);

        const handleCardPress = () => {
            router.push({ pathname: '/event/[ticker]', params: { ticker: event.ticker } });
        };

        return (
            <TouchableOpacity
                style={styles.railCard}
                activeOpacity={0.9}
                onPress={handleCardPress}
            >
                {/* Market Info */}
                <View style={styles.railContent}>
                    {/* Header Row with Image and Title */}
                    <View style={styles.headerRow}>
                        {/* Thumbnail Image */}
                        {event.imageUrl ? (
                            <Image
                                source={{ uri: event.imageUrl }}
                                style={styles.thumbnailImage}
                                contentFit="cover"
                                transition={200}
                            />
                        ) : (
                            <View style={styles.thumbnailPlaceholder}>
                                <Ionicons name="stats-chart" size={20} color={Theme.textDisabled} />
                            </View>
                        )}

                        {/* Title and Competition */}
                        <View style={styles.titleContainer}>
                            {event.competition && (
                                <Text style={styles.competitionText} numberOfLines={1}>
                                    {event.competition}
                                </Text>
                            )}
                            <Text style={styles.railMarketTitle} numberOfLines={2}>
                                {marketTitle}
                            </Text>
                        </View>
                    </View>

                    {/* Price Row - Below Image and Title */}
                    <View style={styles.priceRow}>
                        <View style={styles.mainPriceContainer}>
                            {/* Simple animated price with flash effect */}
                            <AnimatedPrice
                                value={typeof displayPrice === 'number' ? displayPrice : 0}
                                format="cents"
                                style={{
                                    ...styles.mainPrice,
                                    color: isPositive ? Theme.chartPositive : Theme.chartNegative
                                }}
                            />
                            {(priceChange || isInteracting) && (
                                <View style={[styles.changeChip, { backgroundColor: isPositive ? 'rgba(255, 217, 61, 0.15)' : 'rgba(255, 107, 157, 0.15)' }]}>
                                    <Ionicons
                                        name={isPositive ? 'caret-up' : 'caret-down'}
                                        size={10}
                                        color={isPositive ? Theme.chartPositive : Theme.chartNegative}
                                    />
                                    <Text style={[styles.changeText, { color: isPositive ? Theme.chartPositive : Theme.chartNegative }]}>
                                        {isPositive ? '+' : ''}{displayChangePercent}%
                                    </Text>
                                </View>
                            )}
                        </View>
                        {volume !== '—' && !isInteracting && (
                            <Text style={styles.volumeText}>Vol: {volume}</Text>
                        )}
                    </View>

                    {/* Interactive Chart with Live Dot */}
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
                            <View style={styles.chartPlaceholder}>
                                <ActivityIndicator size="small" color={Theme.textDisabled} />
                                <Text style={styles.chartPlaceholderText}>Loading chart...</Text>
                            </View>
                        )}
                    </View>

                    {/* Live indicator label */}
                    <View style={styles.liveIndicator}>
                        <View style={[styles.liveDot, isInteracting && { backgroundColor: Theme.chartNegative }]} />
                        <Text style={styles.liveText}>{isInteracting ? 'SCRUBBING' : 'LIVE'}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Theme.accent} />
            </View>
        );
    }

    if (railItems.length === 0) {
        return null;
    }

    return (
        <View style={styles.railContainer}>
            <View style={styles.railHeader}>
                <Text style={styles.railHeaderTitle}>Trending Markets</Text>
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
                contentContainerStyle={styles.railList}
                snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
                decelerationRate="fast"
                snapToAlignment="start"
                scrollEnabled={scrollEnabled}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    railContainer: {
        paddingVertical: 20,
        backgroundColor: Theme.bgMain,
    },
    railHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 8,
    },
    railHeaderTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: Theme.textPrimary,
        letterSpacing: -0.5,
    },
    railList: {
        paddingHorizontal: 12,
    },
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
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    railContent: {
        padding: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 12,
    },
    thumbnailImage: {
        width: 56,
        height: 56,
        borderRadius: 12,
    },
    thumbnailPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: Theme.bgElevated,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
    },
    competitionText: {
        fontSize: 10,
        fontWeight: '700',
        color: Theme.chartLine,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    railMarketTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: Theme.textPrimary,
        lineHeight: 20,
        letterSpacing: -0.3,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    mainPriceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    mainPrice: {
        fontSize: 26,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        letterSpacing: -0.5,
    },
    changeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 2,
    },
    changeText: {
        fontSize: 12,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    volumeText: {
        fontSize: 12,
        fontWeight: '500',
        color: Theme.textSecondary,
    },
    chartContainer: {
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: CHART_HEIGHT,
    },
    chartPlaceholder: {
        height: CHART_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Theme.chartBackground,
        borderRadius: 12,
    },
    chartPlaceholderText: {
        fontSize: 11,
        color: Theme.textDisabled,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 8,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Theme.chartPositive,
    },
    liveText: {
        fontSize: 10,
        fontWeight: '700',
        color: Theme.textSecondary,
        letterSpacing: 1,
    },
    interactingBadge: {
        backgroundColor: 'rgba(255, 107, 157, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    interactingText: {
        fontSize: 11,
        fontWeight: '600',
        color: Theme.chartNegative,
    },
});
