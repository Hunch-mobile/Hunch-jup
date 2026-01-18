import CreditCard from "@/components/CreditCard";
import SettingsSheet from "@/components/SettingsSheet";
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, getMarketDetails, marketsApi } from "@/lib/api";
import { CandleData, Event, Market, Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { useFundSolanaWallet } from "@privy-io/expo/ui";
import { Connection, LAMPORTS_PER_SOL, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const defaultProfileImage = require("@/assets/default.jpeg");

type TradeTab = 'active' | 'previous';

// Trade item component
const formatUnixTime = (timestamp?: number | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

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

const TradeItem = ({
    trade,
    onPress,
    market,
    event,
    candles,
    showDetails = false,
}: {
    trade: Trade;
    onPress: () => void;
    market?: Market | null;
    event?: Event | null;
    candles?: CandleData[] | null;
    showDetails?: boolean;
}) => {
    const isYes = trade.side === 'yes';
    const entryTimestamp = Math.floor(new Date(trade.createdAt).getTime() / 1000);
    const pnlInfo = candles ? (getEntryPnl(candles, entryTimestamp, isYes) || getPriceChange(candles)) : null;
    const percentValue = pnlInfo ? Number(pnlInfo.changePercent) : NaN;
    const amountValue = Number(trade.amount);
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
                                    className="w-full h-full"
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

export default function ProfileScreen() {
    const { user, logout } = usePrivy();
    const { backendUser, setBackendUser } = useUser();
    const router = useRouter();
    const { fundWallet } = useFundSolanaWallet();
    const [profileData, setProfileData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [activeTab, setActiveTab] = useState<TradeTab>('active');
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [solBalance, setSolBalance] = useState<number | null>(null);
    const [solUsdPrice, setSolUsdPrice] = useState<number | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
    const [marketDetailsByTicker, setMarketDetailsByTicker] = useState<Record<string, Market | null>>({});
    const [eventDetailsByTicker, setEventDetailsByTicker] = useState<Record<string, Event | null>>({});
    const [candlesByTicker, setCandlesByTicker] = useState<Record<string, CandleData[]>>({});

    const slideAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0.6)).current;
    const loadedMarketTickers = useRef(new Set<string>());
    const loadedEventTickers = useRef(new Set<string>());
    const loadedCandleTickers = useRef(new Set<string>());

    const animateToTab = useCallback((tab: TradeTab) => {
        const toValue = tab === 'active' ? 0 : -SCREEN_WIDTH + 40;
        Animated.spring(slideAnim, {
            toValue,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
        setActiveTab(tab);
    }, [slideAnim]);

    useEffect(() => {
        loadProfile();
        loadTrades();
    }, [backendUser]);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    const loadProfile = async () => {
        if (!backendUser) {
            setIsLoading(false);
            return;
        }
        try {
            const data = await api.getUser(backendUser.id);
            setProfileData(data);
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadTrades = async () => {
        if (!backendUser) return;
        try {
            const data = await api.getUserTrades(backendUser.id, 50);
            setTrades(data);
        } catch (error) {
            console.error("Failed to load trades:", error);
        }
    };

    const walletAddress = profileData?.walletAddress || backendUser?.walletAddress;

    const loadSolBalance = useCallback(async () => {
        if (!walletAddress) {
            setSolBalance(null);
            setSolUsdPrice(null);
            return;
        }
        try {
            const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
            const connection = new Connection(rpcUrl, 'confirmed');
            const [lamports, priceResponse] = await Promise.all([
                connection.getBalance(new PublicKey(walletAddress)),
                fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'),
            ]);
            const priceJson = await priceResponse.json();
            setSolBalance(lamports / LAMPORTS_PER_SOL);
            setSolUsdPrice(Number(priceJson?.solana?.usd) || null);
        } catch (error) {
            console.error("Failed to load SOL balance:", error);
            setSolBalance(null);
            setSolUsdPrice(null);
        }
    }, [walletAddress]);

    const loadUsdcBalance = useCallback(async () => {
        if (!walletAddress) {
            setUsdcBalance(null);
            return;
        }
        try {
            const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
            const connection = new Connection(rpcUrl, 'confirmed');
            const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(walletAddress),
                { mint: usdcMint }
            );
            const totalBalance = tokenAccounts.value.reduce((sum, accountInfo) => {
                const amount = accountInfo.account.data?.parsed?.info?.tokenAmount?.uiAmount;
                return sum + (typeof amount === 'number' ? amount : 0);
            }, 0);
            setUsdcBalance(totalBalance);
        } catch (error) {
            console.error("Failed to load USDC balance:", error);
            setUsdcBalance(null);
        }
    }, [walletAddress]);

    useEffect(() => {
        loadSolBalance();
        loadUsdcBalance();
    }, [loadSolBalance, loadUsdcBalance]);

    useEffect(() => {
        const uniqueTickers = Array.from(new Set(trades.map((trade) => trade.marketTicker)));
        const tickersToFetch = uniqueTickers.filter((ticker) => !loadedMarketTickers.current.has(ticker));
        if (tickersToFetch.length === 0) return;

        let cancelled = false;
        const loadMarkets = async () => {
            const results = await Promise.all(
                tickersToFetch.map(async (ticker) => ({
                    ticker,
                    market: await getMarketDetails(ticker),
                }))
            );
            if (cancelled) return;
            setMarketDetailsByTicker((prev) => {
                const next = { ...prev };
                results.forEach(({ ticker, market }) => {
                    loadedMarketTickers.current.add(ticker);
                    next[ticker] = market;
                });
                return next;
            });
        };
        loadMarkets();
        return () => {
            cancelled = true;
        };
    }, [trades]);

    useEffect(() => {
        const eventTickers = Object.values(marketDetailsByTicker)
            .map((market) => market?.eventTicker)
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
    }, [marketDetailsByTicker]);

    useEffect(() => {
        const now = new Date();
        const activeTradeTickers = trades
            .filter((trade) => {
                const tradeDate = new Date(trade.createdAt);
                const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
                return hoursDiff < 24;
            })
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
                    const market = marketDetailsByTicker[ticker];
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
    }, [trades, marketDetailsByTicker]);

    const handleLogout = async () => {
        await logout();
        setBackendUser(null);
        router.replace("/login");
    };

    const twitterAccount = user?.linked_accounts?.find((a: any) => a.type === 'twitter_oauth');
    const rawProfileImageUrl = (twitterAccount as any)?.profile_picture_url;
    const profileImageUrl = rawProfileImageUrl?.replace('_normal', '');

    const privyUsernameSource =
        user?.linked_accounts?.find(
            (a: any) => a.type === 'twitter_oauth' || a.type === 'google_oauth' || a.type === 'email'
        ) as any;
    const privyUsernameRaw =
        privyUsernameSource?.username ||
        privyUsernameSource?.name ||
        privyUsernameSource?.email?.split('@')[0];
    const username = `@${(privyUsernameRaw || profileData?.displayName || "user").toLowerCase().replace(/\s/g, '')}`;
    const followerCount = profileData?.followerCount || 0;
    const followingCount = profileData?.followingCount || 0;
    const usdBalance = solBalance !== null && solUsdPrice !== null ? solBalance * solUsdPrice : null;
    const cashBalance = usdcBalance ?? usdBalance ?? 0;

    const now = new Date();
    const activeTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff < 24;
    });
    const previousTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff >= 24;
    });

    if (isLoading) {
        return (
            <View className="flex-1 bg-app-bg">
                <SafeAreaView className="flex-1" edges={['top']}>
                    <View className="flex-1 justify-center items-center px-5">
                        <ActivityIndicator size="large" color={Theme.textPrimary} />
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 80 }}
                >
                    {/* Profile Header */}
                    <View className="mb-6  ">
                        {/* Menu Button */}
                        <View className="items-end mb-5">
                            <TouchableOpacity
                                className="justify-center items-center"
                                onPress={() => setSettingsVisible(true)}
                            >
                            <Ionicons name="menu-outline" size={30} color={Theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Avatar + Info Row */}
                        <View className="flex-row items-start gap-4 pt-4 mb-4">
                            {/* Avatar */}
                            <View className="relative">
                                <View className="w-14 h-14 rounded-full bg-app-card justify-center items-center overflow-hidden">
                                    <Image
                                        source={profileImageUrl ? { uri: profileImageUrl } : defaultProfileImage}
                                        className="w-full h-full rounded-full"
                                    />
                                </View>
                            </View>

                            {/* Profile Info */} 
                            <View className="flex-1 pt-1">
                                <View className="flex-row items-center mb-3">
                                    <Text className="text-xl font-bold text-txt-primary">{username}</Text>
                                   
                                    <TouchableOpacity
                                        className="flex-row ml-20 items-center gap-1.5 px-3.5 py-[7px]  rounded-md  bg-slate-200 "
                                        onPress={() => {
                                            if (backendUser?.walletAddress) {
                                                fundWallet({ address: backendUser.walletAddress, amount: "0.2" });
                                            }
                                        }}
                                    >
                                        <Text className="text-[15px] font-medium   text-txt-primary">+ Add Cash</Text>
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row gap-5 ">
                                    <TouchableOpacity onPress={() => {
                                        if (backendUser?.id) {
                                            router.push({ pathname: '/user/followers/[userId]', params: { userId: backendUser.id, tab: 'following' } });
                                        }
                                    }}>
                                        <Text className="text-base text-txt-secondary">
                                            <Text className="font-semibold text-txt-primary">{followingCount}</Text> Following
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        if (backendUser?.id) {
                                            router.push({ pathname: '/user/followers/[userId]', params: { userId: backendUser.id, tab: 'followers' } });
                                        }
                                    }}>
                                        <Text className="text-base text-txt-secondary">
                                            <Text className="font-semibold text-txt-primary">{followerCount}</Text> Followers
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                            </View>
                        </View>
                    </View>

                    {/* Credit Card */}
                    <View className="my-3">
                        <View
                            style={{
                                transform: [{ scale: 0.9 }],
                                alignSelf: 'center',
                                backgroundColor: Theme.bgMain,
                                borderRadius: 20,
                                shadowColor: Theme.shadowColor,
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.22,
                                shadowRadius: 20,
                                elevation: 10,
                            }}
                        >
                            <CreditCard
                                tradesCount={trades.length}
                                balance={cashBalance}
                                walletAddress={walletAddress || ""}
                            />
                        </View>
                    </View>

                    {/* Trades Section */}
                    <View>
                        {/* Tab Header */}
                        <View className="flex-row mb-4 border-b border-border">
                            <TouchableOpacity
                                className="flex-1 items-center py-3 relative"
                                onPress={() => animateToTab('active')}
                            >
                                <View className="flex-row items-center gap-2">
                                    <Animated.View
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 4,
                                            backgroundColor: '#22c55e',
                                            opacity: pulseAnim,
                                            transform: [{ scale: pulseAnim }],
                                        }}
                                    />
                                    <Text className={`text-lg font-bold ${activeTab === 'active' ? ' text-txt-primary' : 'font-medium text-txt-secondary'}`}>
                                        ACTIVE ({activeTrades.length})
                                    </Text>
                                </View>
                                {activeTab === 'active' && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-txt-primary" />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 items-center py-3 relative"
                                onPress={() => animateToTab('previous')}
                            >
                                <Text className={`text-lg font-bold ${activeTab === 'previous' ? ' text-red-500' : 'font-medium text-txt-secondary'}`}>
                                    PREVIOUS ({previousTrades.length})
                                </Text>
                                {activeTab === 'previous' && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />}
                            </TouchableOpacity>
                        </View>

                        {/* Animated Sliding Lists */}
                        <View style={styles.listContainer}>
                            <Animated.View style={[styles.slidingContainer, { transform: [{ translateX: slideAnim }] }]}>
                                {/* Active Trades */}
                                <View style={styles.listPane}>
                                    <View className="pb-10">
                                        {activeTrades.length === 0 ? (
                                            <View className="p-10 items-center gap-3">
                                                <Ionicons name="bar-chart-outline" size={32} color={Theme.textDisabled} />
                                                <Text className="text-sm text-txt-disabled">No trades</Text>
                                            </View>
                                        ) : (
                                            <View className="bg-app-card rounded-xl overflow-hidden border border-border">
                                                {activeTrades.map((trade) => (
                                                    <TradeItem
                                                        key={trade.id}
                                                        trade={trade}
                                                        market={marketDetailsByTicker[trade.marketTicker]}
                                                        event={marketDetailsByTicker[trade.marketTicker]?.eventTicker
                                                            ? eventDetailsByTicker[marketDetailsByTicker[trade.marketTicker]!.eventTicker!]
                                                            : undefined}
                                                        candles={candlesByTicker[trade.marketTicker]}
                                                        showDetails
                                                        onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: trade.marketTicker } })}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Previous Trades */}
                                <View style={styles.listPane}>
                                    <View className="pb-10">
                                        {previousTrades.length === 0 ? (
                                            <View className="p-10 items-center gap-3">
                                                <Ionicons name="time-outline" size={32} color={Theme.textDisabled} />
                                                <Text className="text-sm text-txt-disabled">No trades</Text>
                                            </View>
                                        ) : (
                                            <View className="bg-app-card rounded-xl overflow-hidden border border-border">
                                                {previousTrades.map((trade) => (
                                                    <TradeItem
                                                        key={trade.id}
                                                        trade={trade}
                                                        onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: trade.marketTicker } })}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </Animated.View>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>

            <SettingsSheet
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                onSwitchTheme={() => console.log("Switch theme clicked")}
                onLogout={handleLogout}
            />
        </View>
    );
}

// Minimal styles for animated components requiring exact dimensions
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
