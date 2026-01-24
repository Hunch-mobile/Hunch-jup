import CustomKeypad from '@/components/CustomKeypad';
import LightChart from '@/components/LightChart';
import TradeQuoteSheet from '@/components/TradeQuoteSheet';
import { Theme } from '@/constants/theme';
import { api, getEventDetails, marketsApi } from "@/lib/api";
import { executeTrade, fromRawAmount, toRawAmount, USDC_MINT } from "@/lib/tradeService";
import { User as BackendUser, CandleData, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Connection } from "@solana/web3.js";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_CHART_HEIGHT = 200;
const SWIPE_THRESHOLD = 0.7;

// Transform candles for "No" side display
const transformNoCandles = (candles: CandleData[] = []): CandleData[] => {
    return candles.map(c => ({
        ...c,
        open: 1 - c.open,
        high: 1 - c.low,
        low: 1 - c.high,
        close: 1 - c.close,
    }));
};

// SwipeToTrade component
const SwipeToTrade = ({
    onSwipeComplete,
    isLoading,
    disabled,
    amount,
}: {
    onSwipeComplete: () => void;
    isLoading: boolean;
    disabled: boolean;
    amount?: string;
}) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const [trackWidth, setTrackWidth] = useState(0);
    const thumbWidth = 56;
    const startXRef = useRef(0);
    const lastHapticRef = useRef(0);

    const maxSwipe = Math.max(0, trackWidth - thumbWidth - 8);

    const handleTouchStart = (e: any) => {
        if (disabled || isLoading) return;
        startXRef.current = e.nativeEvent.pageX;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleTouchMove = (e: any) => {
        if (disabled || isLoading || maxSwipe <= 0) return;
        const dx = e.nativeEvent.pageX - startXRef.current;
        const newX = Math.max(0, Math.min(dx, maxSwipe));
        translateX.setValue(newX);

        const progress = newX / maxSwipe;
        const now = Date.now();
        if (now - lastHapticRef.current > 50 && progress > 0.1) {
            Haptics.selectionAsync();
            lastHapticRef.current = now;
        }
    };

    const handleTouchEnd = (e: any) => {
        if (disabled || isLoading || maxSwipe <= 0) {
            translateX.setValue(0);
            return;
        }
        const dx = e.nativeEvent.pageX - startXRef.current;
        const progress = dx / maxSwipe;

        if (progress >= SWIPE_THRESHOLD) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Animated.spring(translateX, {
                toValue: maxSwipe,
                useNativeDriver: true,
                tension: 40,
                friction: 7,
            }).start(() => {
                onSwipeComplete();
                setTimeout(() => {
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 40,
                        friction: 8,
                    }).start();
                }, 500);
            });
        } else {
            Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 60,
                friction: 8,
            }).start();
        }
    };

    const textOpacity = translateX.interpolate({
        inputRange: [0, Math.max(1, maxSwipe * 0.3), Math.max(1, maxSwipe)],
        outputRange: [1, 0.3, 0],
        extrapolate: 'clamp',
    });

    return (
        <View
            className={`mt-2 h-16 rounded-2xl overflow-hidden ${disabled ? 'opacity-50' : ''}`}
            style={{ backgroundColor: '#FFE500' }}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
            <Animated.View
                className="absolute inset-0 justify-center items-center"
                style={{ opacity: textOpacity }}
                pointerEvents="none"
            >
                <Text className="text-black text-base font-extrabold">
                    {isLoading ? 'Placing...' : (amount && Number(amount) > 0 ? `Swipe to Bet $${amount}` : 'Swipe to Place Bet')}
                </Text>
            </Animated.View>

            {!isLoading && (
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            left: 4,
                            top: 4,
                            width: thumbWidth,
                            height: 56,
                            borderRadius: 14,
                            backgroundColor: '#000000',
                            justifyContent: 'center',
                            alignItems: 'center',
                            transform: [{ translateX }],
                        },
                    ]}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <Ionicons name="chevron-forward" size={24} color="#FFE500" />
                </Animated.View>
            )}

            {isLoading && (
                <View className="absolute inset-0 justify-center items-center">
                    <ActivityIndicator size="small" color="#000000" />
                </View>
            )}
        </View>
    );
};

type TimeFilter = '24h' | '1w' | '1m' | 'all';

const TIME_FILTER_OPTIONS: { key: TimeFilter; label: string; seconds: number }[] = [
    { key: '24h', label: '24H', seconds: 24 * 60 * 60 },
    { key: '1w', label: '1W', seconds: 7 * 24 * 60 * 60 },
    { key: '1m', label: '1M', seconds: 30 * 24 * 60 * 60 },
    { key: 'all', label: 'All', seconds: 365 * 24 * 60 * 60 },
];

export interface MarketTradeSheetProps {
    visible: boolean;
    onClose: () => void;
    onTradeSuccess?: (tradeData: any, displayInfo: any, tradeId: string) => void;
    onRefreshFeed?: () => void;
    market: Market | null;
    candles?: CandleData[];
    backendUser: BackendUser | null;
    walletProvider: any;
    connection: Connection;
    initialSide?: 'yes' | 'no';
    eventTitle?: string;
}

export const MarketTradeSheet: React.FC<MarketTradeSheetProps> = ({
    visible,
    onClose,
    onTradeSuccess,
    onRefreshFeed,
    market,
    candles: initialCandles,
    backendUser,
    walletProvider,
    connection,
    initialSide = 'yes',
    eventTitle: propEventTitle,
}) => {
    const insets = useSafeAreaInsets();
    const sheetHeight = Math.round(Dimensions.get("window").height * 0.82);
    const slideAnim = useRef(new Animated.Value(sheetHeight)).current;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
            onPanResponderMove: (_, gesture) => {
                if (gesture.dy > 0) {
                    slideAnim.setValue(gesture.dy);
                }
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dy > sheetHeight * 0.25) {
                    onClose();
                } else {
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 30,
                        stiffness: 500,
                    }).start();
                }
            },
        })
    ).current;
    const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>(initialSide);
    const [amount, setAmount] = useState('');
    const [isTrading, setIsTrading] = useState(false);
    const [tradeError, setTradeError] = useState<string | null>(null);
    const [amountKeypadOpen, setAmountKeypadOpen] = useState(false);
    const [showQuoteSheet, setShowQuoteSheet] = useState(false);
    const [lastTradeId, setLastTradeId] = useState<string | null>(null);
    const [lastTradeInfo, setLastTradeInfo] = useState<{ side: 'yes' | 'no'; amount: string; marketTitle: string } | null>(null);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('1w');
    const [filteredCandles, setFilteredCandles] = useState<CandleData[]>([]);
    const [isLoadingCandles, setIsLoadingCandles] = useState(false);
    const [eventTitle, setEventTitle] = useState<string | null>(propEventTitle || null);

    // Fetch event title when sheet opens
    useEffect(() => {
        if (!visible || !market?.eventTicker || propEventTitle) {
            if (propEventTitle) setEventTitle(propEventTitle);
            return;
        }

        const fetchEventTitle = async () => {
            const eventTicker = market?.eventTicker;
            if (!eventTicker) return;

            const event = await getEventDetails(eventTicker);
            if (event?.title) {
                setEventTitle(event.title);
            }
        };

        fetchEventTitle();
    }, [visible, market?.eventTicker, propEventTitle]);

    const finalizeTrade = async (quote?: string) => {
        if (!lastTradeId) {
            setShowQuoteSheet(false);
            setLastTradeId(null);
            if (onRefreshFeed) onRefreshFeed();
            return;
        }

        if (!quote) {
            setShowQuoteSheet(false);
            setLastTradeId(null);
            if (onRefreshFeed) onRefreshFeed();
            return;
        }

        try {
            await api.updateTradeQuote(lastTradeId, quote);
        } catch (error) {
            console.error('Failed to update quote:', error);
        } finally {
            setShowQuoteSheet(false);
            setLastTradeId(null);
            if (onRefreshFeed) onRefreshFeed();
        }
    };

    // Fetch candles based on time filter
    useEffect(() => {
        if (!visible || !market) return;

        const fetchFilteredCandles = async () => {
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
    }, [visible, market, timeFilter, initialCandles]);

    useEffect(() => {
        if (visible) {
            setSelectedSide(initialSide);
            setAmount('');
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
    }, [visible, initialSide, sheetHeight, slideAnim]);

    const handleTrade = async () => {
        if (!market || !backendUser) {
            setTradeError("Sign in to trade");
            return;
        }
        if (!walletProvider) {
            setTradeError("Wallet not connected");
            return;
        }
        if (!amount || Number(amount) <= 0) {
            setTradeError("Enter a valid amount");
            return;
        }

        // Get the outcome mint based on selected side
        let outcomeMint: string | undefined;
        if (market.accounts) {
            const usdcAccount = market.accounts[USDC_MINT];
            if (usdcAccount) {
                outcomeMint = selectedSide === 'yes' ? usdcAccount.yesMint : usdcAccount.noMint;
            }
        }
        if (!outcomeMint) {
            outcomeMint = selectedSide === 'yes' ? market.yesMint : market.noMint;
        }

        if (!outcomeMint) {
            setTradeError("Market mints not available");
            return;
        }

        try {
            setIsTrading(true);
            setTradeError(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const rawAmount = toRawAmount(Number(amount), 6);

            const { signature, order } = await executeTrade({
                provider: walletProvider,
                connection,
                userPublicKey: backendUser.walletAddress,
                inputMint: USDC_MINT,
                outputMint: outcomeMint,
                amount: rawAmount,
                slippageBps: 100,
            });

            const estimatedSpendUsdc = fromRawAmount(order.inAmount, 6).toFixed(2);
            const estimatedTokens = fromRawAmount(order.outAmount, 6);
            const entryPrice = estimatedTokens > 0 ? (Number(estimatedSpendUsdc) / estimatedTokens).toFixed(4) : '0';

            const tradeData = {
                userId: backendUser.id,
                marketTicker: market.ticker,
                eventTicker: market.eventTicker,
                side: selectedSide,
                action: 'BUY' as const,
                amount: estimatedSpendUsdc,
                walletAddress: backendUser.walletAddress,
                transactionSig: signature,
                executedInAmount: order.inAmount,
                executedOutAmount: order.outAmount,
                isDummy: false,
            };

            const savedTrade = await api.createTrade(tradeData);

            const displayInfo = {
                side: selectedSide,
                amount: estimatedSpendUsdc,
                marketTitle: market?.title || market.ticker,
            };

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setLastTradeId(savedTrade.id);
            setLastTradeInfo(displayInfo);
            setShowQuoteSheet(true);

            if (onTradeSuccess) {
                onTradeSuccess(tradeData, displayInfo, savedTrade.id);
            }
            onClose();
        } catch (error: any) {
            console.error('Trade error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTradeError(error?.message || "Failed to place trade");
        } finally {
            setIsTrading(false);
        }
    };

    const betAmount = parseFloat(amount || '0');
    const estimatedProbability = market?.yesBid && market?.yesAsk
        ? ((parseFloat(market.yesBid) + parseFloat(market.yesAsk)) / 2) * 100
        : 50;

    const displayCandles = filteredCandles.length > 0 ? filteredCandles : (initialCandles || []);
    const chartCandles = useMemo(
        () => (selectedSide === 'no' ? transformNoCandles(displayCandles) : displayCandles),
        [displayCandles, selectedSide]
    );
    const chartContainerRef = useRef<View>(null);
    const chartLayoutRef = useRef({ x: 0, width: 1 });
    const scrubStateRef = useRef({ lastIndex: -1, lastHaptic: 0 });
    const [scrubPrice, setScrubPrice] = useState<number | null>(null);
    const [scrubIndex, setScrubIndex] = useState<number | null>(null);
    const [scrubTimestamp, setScrubTimestamp] = useState<number | null>(null);
    const [isScrubbing, setIsScrubbing] = useState(false);

    const updateChartLayout = () => {
        chartContainerRef.current?.measureInWindow((x, _y, width) => {
            chartLayoutRef.current = { x, width: Math.max(width, 1) };
        });
    };

    const triggerScrubHaptic = (moveX: number) => {
        const { x, width } = chartLayoutRef.current;
        const length = chartCandles.length;
        if (!length || width <= 0) return;
        const localX = Math.min(Math.max(moveX - x, 0), width);
        const index = Math.floor((localX / width) * length);
        if (index !== scrubStateRef.current.lastIndex) {
            const nextPrice = chartCandles[index]?.close;
            if (typeof nextPrice === 'number') {
                setScrubPrice(nextPrice);
            }
            setScrubIndex(index);
            const nextTs = chartCandles[index]?.timestamp;
            setScrubTimestamp(typeof nextTs === 'number' ? nextTs : null);
            const now = Date.now();
            if (now - scrubStateRef.current.lastHaptic > 20) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                scrubStateRef.current.lastHaptic = now;
            }
            scrubStateRef.current.lastIndex = index;
        }
    };

    const handleScrubStart = useCallback((moveX: number) => {
        setIsScrubbing(true);
        triggerScrubHaptic(moveX);
    }, []);

    const handleScrubEnd = useCallback(() => {
        setIsScrubbing(false);
        setScrubPrice(null);
        setScrubIndex(null);
        setScrubTimestamp(null);
        scrubStateRef.current.lastIndex = -1;
    }, []);

    const formatScrubTime = (timestamp?: number | null) => {
        if (!timestamp) return '—';
        const date = new Date(timestamp * 1000);
        if (timeFilter === '24h') {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 justify-end" onPress={onClose}>
                <BlurView intensity={20} tint="default" style={StyleSheet.absoluteFill} />
                <View style={styles.backdropTint} />
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
                            <View {...panResponder.panHandlers}>
                                <View className="items-center py-2">
                                    <View className="w-12 h-1.5 rounded-full bg-border" />
                                </View>

                                <View className="mb-4">
                                    <Text className="text-lg font-medium text-txt-secondary mb-2" numberOfLines={2}>
                                        {eventTitle || market?.subtitle || 'Event'}
                                    </Text>
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-xl font-bold text-txt-primary flex-1" numberOfLines={1}>
                                            {selectedSide === 'yes'
                                                ? (market?.yesSubTitle || market?.subtitle || 'Yes')
                                                : (market?.noSubTitle || market?.subtitle || 'No')}
                                        </Text>
                                        <Text
                                            className="text-2xl font-bold"
                                            style={{
                                                color: (() => {
                                                    const price = scrubPrice ?? chartCandles[chartCandles.length - 1]?.close;
                                                    const firstPrice = chartCandles[0]?.close;
                                                    if (typeof price !== 'number' || typeof firstPrice !== 'number') return '#6B7280';
                                                    return price >= firstPrice ? '#22c55e' : '#ef4444';
                                                })()
                                            }}
                                        >
                                            {(() => {
                                                const price = scrubPrice ?? chartCandles[chartCandles.length - 1]?.close;
                                                if (typeof price !== 'number') return '—';
                                                return `${(price * 100).toFixed(1)}%`;
                                            })()}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }} scrollEnabled={!isScrubbing}>
                                <View
                                    ref={chartContainerRef}
                                    onLayout={updateChartLayout}
                                    className="h-[240px] rounded-2xl overflow-hidden mb-3"
                                    onStartShouldSetResponder={() => true}
                                    onStartShouldSetResponderCapture={() => true}
                                    onMoveShouldSetResponder={() => true}
                                    onMoveShouldSetResponderCapture={() => true}
                                    onResponderGrant={(e) => handleScrubStart(e.nativeEvent.pageX)}
                                    onResponderMove={(e) => triggerScrubHaptic(e.nativeEvent.pageX)}
                                    onResponderRelease={handleScrubEnd}
                                    onResponderTerminate={handleScrubEnd}
                                >
                                    {scrubTimestamp && (
                                        <View className="absolute top-2 left-0 right-0 items-center z-10" pointerEvents="none">
                                            <Text className="text-xs text-txt-secondary">{formatScrubTime(scrubTimestamp)}</Text>
                                        </View>
                                    )}
                                    {chartCandles.length > 0 ? (
                                        <View className="flex-1">
                                            <LightChart
                                                candles={chartCandles}
                                                width={SCREEN_WIDTH - 40}
                                                height={SHEET_CHART_HEIGHT}
                                                isYes={selectedSide === 'yes'}
                                                scrubIndex={scrubIndex}
                                                showFill={true}
                                                showGlow={false}
                                                strokeWidth={3}
                                            />
                                            {isLoadingCandles && (
                                                <View className="absolute top-2 right-2 p-1.5 rounded-full bg-white/10 backdrop-blur-sm">
                                                    <ActivityIndicator size="small" color={Theme.accentSubtle} />
                                                </View>
                                            )}
                                        </View>
                                    ) : isLoadingCandles ? (
                                        <View className="flex-1 justify-center items-center gap-2">
                                            <ActivityIndicator size="small" color={Theme.accentSubtle} />
                                            <Text className="text-xs text-txt-disabled">Loading chart...</Text>
                                        </View>
                                    ) : (
                                        <View className="flex-1 justify-center items-center gap-2">
                                            <ActivityIndicator size="small" color={Theme.textDisabled} />
                                            <Text className="text-xs text-txt-disabled">No data available</Text>
                                        </View>
                                    )}
                                </View>

                                <View className="flex-row items-center justify-center gap-2 mb-2">
                                    {TIME_FILTER_OPTIONS.map((option) => (
                                        <TouchableOpacity
                                            key={option.key}
                                            className="px-3 py-1.5 rounded-full"
                                            onPress={() => { setTimeFilter(option.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                            activeOpacity={0.6}
                                        >
                                            <Text className={`text-xs font-semibold ${timeFilter === option.key ? '' : 'text-txt-disabled'}`} style={timeFilter === option.key ? { color: Theme.accentSubtle } : {}}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Yes/No Toggle */}
                                <View className="flex-row gap-3 mb-4 px-4">
                                    <TouchableOpacity
                                        className={`flex-1 py-3.5 rounded-2xl border-[1.5px] ${selectedSide === 'yes' ? 'bg-[#dcfce7] border-[#dcfce7]' : 'bg-gray-50 border-gray-100'}`}
                                        onPress={() => { setSelectedSide('yes'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                                        activeOpacity={0.7}
                                    >
                                        <Text className={`text-center font-bold text-base ${selectedSide === 'yes' ? 'text-[#16a34a]' : 'text-txt-disabled'}`}>Yes</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className={`flex-1 py-3.5 rounded-2xl border-[1.5px] ${selectedSide === 'no' ? 'bg-[#fee2e2] border-[#fee2e2]' : 'bg-gray-50 border-gray-100'}`}
                                        onPress={() => { setSelectedSide('no'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                                        activeOpacity={0.7}
                                    >
                                        <Text className={`text-center font-bold text-base ${selectedSide === 'no' ? 'text-[#dc2626]' : 'text-txt-disabled'}`}>No</Text>
                                    </TouchableOpacity>
                                </View>

                                <View className="px-4">
                                    <Text className="text-xs font-bold text-txt-secondary uppercase tracking-wide mb-2">Amount</Text>
                                    <View className={`flex-row items-center rounded-2xl px-4 py-1 ${!amount || amount === '0' || amount === '0.00' ? 'bg-[#F3F4F6]' : 'bg-transparent'}`}>
                                        <Text className="text-txt-secondary text-2xl font-semibold">$</Text>
                                        <Pressable className="flex-1" onPress={() => setAmountKeypadOpen(true)}>
                                            <Text className={`${!amount || amount === '0' || amount === '0.00' ? 'text-gray-300' : 'text-txt-primary'} text-[24px] font-bold py-2 pl-1.5`}>
                                                {amount || "0.00"}
                                            </Text>
                                        </Pressable>
                                        {betAmount > 0 && (
                                            <View className="items-end">
                                                <Text className="text-txt-secondary text-[10px] uppercase">To win</Text>
                                                <Text className="text-[#22c55e] text-2xl font-extrabold">
                                                    ${(betAmount * (100 / estimatedProbability)).toFixed(2)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    {tradeError && (
                                        <Text className="text-status-error text-xs mt-1">{tradeError}</Text>
                                    )}
                                </View>
                                <View className="px-4 mt-6">
                                    <SwipeToTrade
                                        onSwipeComplete={handleTrade}
                                        isLoading={isTrading}
                                        disabled={isTrading || !amount || Number(amount) <= 0}
                                        amount={amount}
                                    />
                                </View>
                            </ScrollView>
                        </Pressable>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Pressable>
            <CustomKeypad
                visible={amountKeypadOpen}
                value={amount}
                onChange={(next) => { setAmount(next.replace(',', '.')); setTradeError(null); }}
                onClose={() => setAmountKeypadOpen(false)}
            />
            <TradeQuoteSheet
                visible={showQuoteSheet && !!lastTradeInfo}
                onClose={() => {
                    setShowQuoteSheet(false);
                    setLastTradeId(null);
                    if (onRefreshFeed) onRefreshFeed();
                }}
                onSubmit={async (quoteText) => {
                    await finalizeTrade(quoteText);
                }}
                onSkip={() => {
                    setShowQuoteSheet(false);
                    setLastTradeId(null);
                    if (onRefreshFeed) onRefreshFeed();
                }}
                tradeInfo={lastTradeInfo || { side: 'yes', amount: '0', marketTitle: 'Market' }}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
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
});

export default MarketTradeSheet;
