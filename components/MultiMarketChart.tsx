import { Theme } from '@/constants/theme';
import { marketsApi } from '@/lib/api';
import { CandleData, Market } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
    GestureResponderEvent,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

// AnimatedCircle for blinking dots
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 180;
const CHART_PADDING = 16;
const RIGHT_PADDING = 20; // Extra space for live dots

// Vibrant colors for different market lines
const MARKET_COLORS = [
    '#FFD93D', // Yellow
    '#FF6B9D', // Pink
    '#3FE3FF', // Cyan
    '#A855F7', // Purple
];

// Cache for candle data
const candleCache = new Map<string, { data: CandleData[]; timestamp: number }>();
const CANDLE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

interface MarketChartData {
    market: Market;
    candles: CandleData[];
    color: string;
    loading: boolean;
}

interface MultiMarketChartProps {
    markets: Market[];
    onInteractionStart?: () => void;
    onInteractionEnd?: () => void;
}

// Helper to get yesMint from market
const getYesMint = (market: Market): string | undefined => {
    if (market.yesMint) return market.yesMint;
    if (market.accounts) {
        const accountValues = Object.values(market.accounts);
        for (const account of accountValues) {
            if (typeof account === 'object' && account?.yesMint) {
                return account.yesMint;
            }
        }
    }
    return undefined;
};

export const MultiMarketChart: React.FC<MultiMarketChartProps> = ({
    markets,
    onInteractionStart,
    onInteractionEnd,
}) => {
    const [marketData, setMarketData] = useState<MarketChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [touchPosition, setTouchPosition] = useState<{ x: number; index: number } | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const chartWidth = SCREEN_WIDTH - CHART_PADDING * 2;
    const drawableWidth = chartWidth - RIGHT_PADDING; // Leave space for live dots

    // Animation for live dots
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.4,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
            ])
        );

        const glowAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 0.6,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.3,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
            ])
        );

        pulseAnimation.start();
        glowAnimation.start();

        return () => {
            pulseAnimation.stop();
            glowAnimation.stop();
        };
    }, [pulseAnim, glowAnim]);

    // Fetch candle data for all markets
    useEffect(() => {
        const fetchAllCandles = async () => {
            setLoading(true);
            const results: MarketChartData[] = [];

            await Promise.all(
                markets.slice(0, 4).map(async (market, index) => {
                    const yesMint = getYesMint(market);
                    const color = MARKET_COLORS[index % MARKET_COLORS.length];

                    if (!yesMint) {
                        results.push({ market, candles: [], color, loading: false });
                        return;
                    }

                    // Check cache
                    const cached = candleCache.get(yesMint);
                    if (cached && Date.now() - cached.timestamp < CANDLE_CACHE_DURATION) {
                        results.push({ market, candles: cached.data, color, loading: false });
                        return;
                    }

                    try {
                        const endTs = Math.floor(Date.now() / 1000);
                        const startTs = endTs - (30 * 24 * 60 * 60); // 30 days
                        const periodInterval = 1440; // Daily

                        const data = await marketsApi.fetchCandlesticksByMint(yesMint, {
                            startTs,
                            endTs,
                            periodInterval,
                        });

                        if (data && data.length > 0) {
                            candleCache.set(yesMint, { data, timestamp: Date.now() });
                            results.push({ market, candles: data, color, loading: false });
                        } else {
                            results.push({ market, candles: [], color, loading: false });
                        }
                    } catch (error) {
                        console.error(`Failed to fetch candles for ${market.ticker}:`, error);
                        results.push({ market, candles: [], color, loading: false });
                    }
                })
            );

            // Sort by original market order
            results.sort((a, b) => {
                const indexA = markets.findIndex(m => m.ticker === a.market.ticker);
                const indexB = markets.findIndex(m => m.ticker === b.market.ticker);
                return indexA - indexB;
            });

            setMarketData(results);
            setLoading(false);
        };

        if (markets.length > 0) {
            fetchAllCandles();
        }
    }, [markets]);

    // Generate chart paths for all markets
    const chartPaths = useMemo(() => {
        if (marketData.length === 0) return [];

        // Find global min/max across all candles for unified scale
        let globalMin = Infinity;
        let globalMax = -Infinity;
        let maxLength = 0;

        marketData.forEach(({ candles }) => {
            if (candles.length > 0) {
                const recentCandles = candles.slice(-20);
                maxLength = Math.max(maxLength, recentCandles.length);
                recentCandles.forEach(c => {
                    globalMin = Math.min(globalMin, c.close);
                    globalMax = Math.max(globalMax, c.close);
                });
            }
        });

        if (globalMin === Infinity) return [];

        const priceRange = globalMax - globalMin || 0.01;
        const paddingY = CHART_HEIGHT * 0.15;
        const chartHeight = CHART_HEIGHT - paddingY * 2;

        return marketData.map(({ candles, color, market }) => {
            if (candles.length === 0) return null;

            const recentCandles = candles.slice(-20);
            const prices = recentCandles.map(c => c.close);

            const points = prices.map((price, index) => {
                const x = (index / (maxLength - 1)) * drawableWidth;
                const y = paddingY + chartHeight - ((price - globalMin) / priceRange) * chartHeight;
                return { x, y, price };
            });

            // Create smooth bezier path
            let path = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const cpx = (prev.x + curr.x) / 2;
                path += ` Q ${cpx} ${prev.y} ${cpx} ${(prev.y + curr.y) / 2}`;
                path += ` Q ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
            }

            return { path, points, color, market };
        }).filter(Boolean);
    }, [marketData, chartWidth]);

    // Get prices at touch position
    const getPricesAtIndex = useCallback((index: number) => {
        return marketData.map(({ market, candles, color }) => {
            const recentCandles = candles.slice(-20);
            const clampedIndex = Math.min(index, recentCandles.length - 1);
            const price = recentCandles[clampedIndex]?.close ?? 0;
            return { market, price, color };
        });
    }, [marketData]);

    // Touch handlers
    const handleTouch = useCallback((event: GestureResponderEvent) => {
        const { locationX } = event.nativeEvent;
        const clampedX = Math.max(0, Math.min(locationX, drawableWidth));
        const maxLength = Math.max(...marketData.map(d => d.candles.slice(-20).length), 1);
        const index = Math.round((clampedX / drawableWidth) * (maxLength - 1));
        setTouchPosition({ x: clampedX, index });
    }, [chartWidth, marketData]);

    const handleTouchStart = useCallback((event: GestureResponderEvent) => {
        setIsInteracting(true);
        onInteractionStart?.();
        handleTouch(event);
    }, [handleTouch, onInteractionStart]);

    const handleTouchMove = useCallback((event: GestureResponderEvent) => {
        handleTouch(event);
    }, [handleTouch]);

    const handleTouchEnd = useCallback(() => {
        setTimeout(() => {
            setIsInteracting(false);
            setTouchPosition(null);
            onInteractionEnd?.();
        }, 300);
    }, [onInteractionEnd]);

    const formatCents = (price: number): string => {
        const cents = Math.round(price * 100);
        return `${cents}¢`;
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Theme.textDisabled} />
                    <Text style={styles.loadingText}>Loading charts...</Text>
                </View>
            </View>
        );
    }

    if (chartPaths.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyContainer}>
                    <Ionicons name="analytics-outline" size={32} color={Theme.textDisabled} />
                    <Text style={styles.emptyText}>No chart data available</Text>
                </View>
            </View>
        );
    }

    const currentPrices = isInteracting && touchPosition
        ? getPricesAtIndex(touchPosition.index)
        : marketData.map(({ market, candles, color }) => ({
            market,
            price: candles.slice(-20).pop()?.close ?? 0,
            color,
        }));

    return (
        <View style={styles.container}>
            {/* Legend with prices */}
            <View style={styles.legend}>
                {currentPrices.map(({ market, price, color }) => {
                    const displayName = market.yesSubTitle || market.title;
                    return (
                        <View key={market.ticker} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: color }]} />
                            <Text style={styles.legendTitle} numberOfLines={1}>
                                {displayName.length > 25 ? displayName.substring(0, 25) + '...' : displayName}
                            </Text>
                            <Text style={[styles.legendPrice, { color }]}>
                                {formatCents(price)}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Chart */}
            <View
                style={styles.chartContainer}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onStartShouldSetResponderCapture={() => true}
                onMoveShouldSetResponderCapture={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={handleTouchStart}
                onResponderMove={handleTouchMove}
                onResponderRelease={handleTouchEnd}
                onResponderTerminate={handleTouchEnd}
            >
                <Svg width={chartWidth} height={CHART_HEIGHT}>
                    <Defs>
                        {chartPaths.map((item, idx) => (
                            <LinearGradient key={`grad-${idx}`} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0%" stopColor={item!.color} stopOpacity={0.2} />
                                <Stop offset="100%" stopColor={item!.color} stopOpacity={0} />
                            </LinearGradient>
                        ))}
                    </Defs>

                    {/* Draw paths */}
                    {chartPaths.map((item, idx) => (
                        <Path
                            key={`line-${idx}`}
                            d={item!.path}
                            stroke={item!.color}
                            strokeWidth={2.5}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ))}

                    {/* Crosshair when interacting */}
                    {isInteracting && touchPosition && (
                        <Line
                            x1={touchPosition.x}
                            y1={0}
                            x2={touchPosition.x}
                            y2={CHART_HEIGHT}
                            stroke={Theme.textSecondary}
                            strokeWidth={1}
                            strokeDasharray="4,4"
                            opacity={0.5}
                        />
                    )}

                    {/* Live dots at end of each line - Animated */}
                    {!isInteracting && chartPaths.map((item, idx) => {
                        const lastPoint = item!.points[item!.points.length - 1];
                        return (
                            <React.Fragment key={`dot-${idx}`}>
                                {/* Outer glow - animated */}
                                <AnimatedCircle
                                    cx={lastPoint.x}
                                    cy={lastPoint.y}
                                    r={pulseAnim.interpolate({
                                        inputRange: [1, 1.4],
                                        outputRange: [8, 12],
                                    })}
                                    fill={item!.color}
                                    opacity={glowAnim}
                                />
                                {/* Inner solid dot */}
                                <Circle
                                    cx={lastPoint.x}
                                    cy={lastPoint.y}
                                    r={5}
                                    fill={item!.color}
                                    stroke="#FFF"
                                    strokeWidth={2}
                                />
                            </React.Fragment>
                        );
                    })}

                    {/* Touch indicators */}
                    {isInteracting && touchPosition && chartPaths.map((item, idx) => {
                        const index = Math.min(touchPosition.index, item!.points.length - 1);
                        const point = item!.points[index];
                        if (!point) return null;
                        return (
                            <Circle
                                key={`touch-${idx}`}
                                cx={point.x}
                                cy={point.y}
                                r={6}
                                fill={item!.color}
                                stroke="#FFF"
                                strokeWidth={2}
                            />
                        );
                    })}
                </Svg>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: CHART_PADDING,
        backgroundColor: Theme.bgCard,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Theme.border,
    },
    loadingContainer: {
        height: CHART_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        color: Theme.textDisabled,
    },
    emptyContainer: {
        height: CHART_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    emptyText: {
        fontSize: 13,
        color: Theme.textDisabled,
    },
    legend: {
        marginBottom: 12,
        gap: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendTitle: {
        flex: 1,
        fontSize: 12,
        color: Theme.textSecondary,
    },
    legendPrice: {
        fontSize: 14,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    chartContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    indicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
    }
});

export default MultiMarketChart;
