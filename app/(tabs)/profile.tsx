import CreditCard from "@/components/CreditCard";
import SellPositionSheet from "@/components/SellPositionSheet";
import SettingsSheet from "@/components/SettingsSheet";
import TradeQuoteSheet from "@/components/TradeQuoteSheet";
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, marketsApi } from "@/lib/api";
import { executeTrade, toRawAmount, USDC_MINT } from "@/lib/tradeService";
import { AggregatedPosition, Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { useFundSolanaWallet } from "@privy-io/expo/ui";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const defaultProfileImage = require("@/assets/default.jpeg");

type TradeTab = 'active' | 'previous';

const formatCurrency = (value: number | null | undefined, fractionDigits = 2) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `$${value.toFixed(fractionDigits)}`;
};

const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `${value.toFixed(1)}%`;
};

const PositionItem = ({
    position,
    isPrevious = false,
    onPress,
    onSell,
}: {
    position: AggregatedPosition;
    isPrevious?: boolean;
    onPress: () => void;
    onSell?: () => void;
}) => {
    const isYes = position.side === 'yes';
    const marketTitle = position.market?.title || position.marketTicker;
    const subtitle = isYes ? position.market?.yesSubTitle : position.market?.noSubTitle;
    const pnlValue = position.totalPnL ?? position.profitLoss ?? position.unrealizedPnL ?? position.realizedPnL ?? null;
    const pnlPercent = position.profitLossPercentage ?? (
        pnlValue !== null && position.totalCostBasis > 0
            ? (pnlValue / position.totalCostBasis) * 100
            : null
    );
    const pnlColor = pnlValue !== null ? (pnlValue >= 0 ? '#22c55e' : '#ef4444') : Theme.textDisabled;
    const pnlText = pnlValue !== null
        ? `${pnlValue >= 0 ? '+' : '-'}${formatCurrency(Math.abs(pnlValue))}`
        : '—';
    const hasTokens = position.totalTokenAmount > 0.001 || (position.totalTokensBought - position.totalTokensSold) > 0.001;

    return (
        <TouchableOpacity
            className="px-4 py-4"
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View className="bg-app-card rounded-2xl p-4 border border-border">
                <View className="flex-row items-center gap-3 mb-3">
                    <View className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-app-elevated">
                        <Image
                            source={position.eventImageUrl ? { uri: position.eventImageUrl } : defaultProfileImage}
                            className="w-full h-full"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-txt-primary" numberOfLines={2}>
                            {marketTitle}
                        </Text>
                        <Text className="text-xs text-txt-secondary" numberOfLines={1}>
                            {subtitle || position.market?.subtitle || 'Market'}
                        </Text>
                    </View>
                    <View className={`px-2.5 py-1 rounded-md ${isYes ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <Text className={`text-xs font-bold ${isYes ? 'text-green-500' : 'text-red-500'}`}>
                            {isYes ? 'YES' : 'NO'}
                        </Text>
                    </View>
                </View>

                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                        <Text className="text-[11px] text-txt-disabled uppercase">Cost</Text>
                        <Text className="text-base font-semibold text-txt-primary">
                            {formatCurrency(position.totalCostBasis)}
                        </Text>
                    </View>
                    {!isPrevious && (
                        <View className="flex-1">
                            <Text className="text-[11px] text-txt-disabled uppercase">Value</Text>
                            <Text className="text-base font-semibold text-txt-primary">
                                {formatCurrency(position.currentValue)}
                            </Text>
                        </View>
                    )}
                    <View className="flex-1">
                        <Text className="text-[11px] text-txt-disabled uppercase">PnL</Text>
                        <Text className="text-base font-semibold" style={{ color: pnlColor }}>
                            {pnlText}
                        </Text>
                        <Text className="text-[11px] font-medium" style={{ color: pnlColor }}>
                            {pnlPercent === null ? '—' : `${pnlPercent >= 0 ? '+' : ''}${formatPercent(pnlPercent)}`}
                        </Text>
                    </View>
                </View>

                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-[11px] text-txt-disabled uppercase">Entry</Text>
                        <Text className="text-sm font-medium text-txt-primary">
                            {formatCurrency(position.averageEntryPrice)}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-txt-disabled uppercase">Current</Text>
                        <Text className="text-sm font-medium text-txt-primary">
                            {formatCurrency(position.currentPrice)}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-[11px] text-txt-disabled uppercase">Trades</Text>
                        <Text className="text-sm font-medium text-txt-primary">
                            {position.tradeCount}
                        </Text>
                    </View>
                </View>

                {/* Sell Button for active positions with tokens */}
                {!isPrevious && hasTokens && onSell && (
                    <TouchableOpacity
                        className="mt-3 bg-red-500/10 rounded-xl py-2.5 flex-row items-center justify-center gap-2 border border-red-500/20"
                        onPress={(e) => {
                            e.stopPropagation();
                            onSell();
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trending-down" size={16} color="#ef4444" />
                        <Text className="text-red-500 font-semibold text-sm">Sell Position</Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
};

export default function ProfileScreen() {
    const { user, logout } = usePrivy();
    const { backendUser, setBackendUser } = useUser();
    const { wallets } = useEmbeddedSolanaWallet();
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
    const [positions, setPositions] = useState<{ active: AggregatedPosition[]; previous: AggregatedPosition[] }>({
        active: [],
        previous: [],
    });
    const [isLoadingPositions, setIsLoadingPositions] = useState(true);

    // Sell position state
    const [sellSheetVisible, setSellSheetVisible] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<AggregatedPosition | null>(null);
    const [isSelling, setIsSelling] = useState(false);

    // Quote sheet state
    const [showQuoteSheet, setShowQuoteSheet] = useState(false);
    const [lastTradeInfo, setLastTradeInfo] = useState<{ side: 'yes' | 'no'; amount: string; marketTitle: string } | null>(null);
    const [lastTradeId, setLastTradeId] = useState<string | null>(null);

    const finalizeTrade = async (quote?: string) => {
        if (!lastTradeId) {
            setShowQuoteSheet(false);
            setLastTradeId(null);
            loadPositions();
            loadUsdcBalance();
            return;
        }

        if (!quote) {
            setShowQuoteSheet(false);
            setLastTradeId(null);
            loadPositions();
            loadUsdcBalance();
            return;
        }

        try {
            // Update the existing trade with the quote
            await api.updateTradeQuote(lastTradeId, quote);
        } catch (error) {
            console.error('Failed to update quote:', error);
        } finally {
            setShowQuoteSheet(false);
            setLastTradeId(null);
            loadPositions();
            loadUsdcBalance();
        }
    };

    const slideAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0.6)).current;

    // Solana connection for trading
    const connection = useMemo(() => {
        const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
        return new Connection(rpcUrl, 'confirmed');
    }, []);
    const solanaWallet = wallets?.[0];

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
        loadPositions();
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

    const loadPositions = async () => {
        if (!backendUser) {
            setIsLoadingPositions(false);
            return;
        }
        try {
            setIsLoadingPositions(true);
            const data = await api.getPositions(backendUser.id);
            setPositions(data.positions);
        } catch (error) {
            console.error("Failed to load positions:", error);
        } finally {
            setIsLoadingPositions(false);
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

    const activePositions = positions.active;
    const previousPositions = positions.previous;

    const handleLogout = async () => {
        await logout();
        setBackendUser(null);
        router.replace("/login");
    };

    // Handle opening sell sheet
    const handleOpenSell = (position: AggregatedPosition) => {
        setSelectedPosition(position);
        setSellSheetVisible(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Handle sell trade execution - sells all tokens for this position
    const handleSell = async () => {
        if (!selectedPosition || !backendUser || !solanaWallet) {
            throw new Error('Missing required data for sell');
        }

        setIsSelling(true);
        try {
            const market = selectedPosition.market;

            // Get the outcome mint based on position side
            // First check direct fields, then check accounts
            let outcomeMint: string | undefined;

            if (selectedPosition.side === 'yes') {
                outcomeMint = market?.yesMint;
                // If not found, check in accounts (under USDC key)
                if (!outcomeMint && market?.accounts) {
                    const usdcAccount = market.accounts[USDC_MINT];
                    outcomeMint = usdcAccount?.yesMint;
                }
            } else {
                outcomeMint = market?.noMint;
                if (!outcomeMint && market?.accounts) {
                    const usdcAccount = market.accounts[USDC_MINT];
                    outcomeMint = usdcAccount?.noMint;
                }
            }

            if (!outcomeMint) {
                // If still not found, try to fetch market details
                console.log('[Sell] Mint not found locally, fetching market details...');
                const marketDetails = await marketsApi.fetchMarketDetails(selectedPosition.marketTicker);
                outcomeMint = selectedPosition.side === 'yes'
                    ? marketDetails.yesMint || marketDetails.accounts?.[USDC_MINT]?.yesMint
                    : marketDetails.noMint || marketDetails.accounts?.[USDC_MINT]?.noMint;
            }

            if (!outcomeMint) {
                throw new Error('No outcome mint found for this position');
            }

            // Use totalTokenAmount first (this is the actual available tokens), fallback to calculation
            const tokensToSell = selectedPosition.totalTokenAmount > 0
                ? selectedPosition.totalTokenAmount
                : selectedPosition.totalTokensBought - selectedPosition.totalTokensSold;
            
            if (tokensToSell <= 0) {
                throw new Error('No tokens to sell');
            }

            console.log(`[Sell] Selling ${tokensToSell} tokens of ${outcomeMint}`, {
                totalTokenAmount: selectedPosition.totalTokenAmount,
                totalTokensBought: selectedPosition.totalTokensBought,
                totalTokensSold: selectedPosition.totalTokensSold,
            });

            // Convert token amount to raw (6 decimals)
            const rawAmount = toRawAmount(tokensToSell, 6);

            // Get wallet provider
            const provider = await solanaWallet.getProvider();

            // Execute the sell trade
            const { signature, order } = await executeTrade({
                provider,
                connection,
                userPublicKey: backendUser.walletAddress,
                inputMint: outcomeMint,
                outputMint: USDC_MINT,
                amount: rawAmount,
                slippageBps: 50,
            });

            // Calculate USDC received for display
            const usdcReceived = (parseInt(order.outAmount) / 1_000_000).toFixed(2);

            // Prepare trade data for immediate save
            const tradeData = {
                userId: backendUser.id,
                marketTicker: selectedPosition.marketTicker,
                eventTicker: selectedPosition.eventTicker || undefined,
                side: selectedPosition.side,
                action: 'SELL' as const,
                amount: usdcReceived,
                walletAddress: backendUser.walletAddress,
                transactionSig: signature,
                executedInAmount: order.inAmount,
                executedOutAmount: order.outAmount,
                isDummy: false,
            };

            // Save trade to backend immediately to get the trade ID
            const savedTrade = await api.createTrade(tradeData);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSellSheetVisible(false);

            // Show quote sheet with the saved trade ID
            setLastTradeId(savedTrade.id);
            setLastTradeInfo({
                side: selectedPosition.side,
                amount: usdcReceived,
                marketTitle: selectedPosition.market?.title || selectedPosition.marketTicker,
            });
            setShowQuoteSheet(true);

            setSelectedPosition(null);

            // Reload positions and balances
            loadPositions();
            loadUsdcBalance();
        } catch (err: any) {
            console.error('Sell error:', err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            throw err;
        } finally {
            setIsSelling(false);
        }
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
                                        ACTIVE ({activePositions.length})
                                    </Text>
                                </View>
                                {activeTab === 'active' && <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-txt-primary" />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 items-center py-3 relative"
                                onPress={() => animateToTab('previous')}
                            >
                                <Text className={`text-lg font-bold ${activeTab === 'previous' ? ' text-red-500' : 'font-medium text-txt-secondary'}`}>
                                    PREVIOUS ({previousPositions.length})
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
                                        {isLoadingPositions ? (
                                            <View className="p-10 items-center gap-3">
                                                <ActivityIndicator size="small" color={Theme.textPrimary} />
                                                <Text className="text-sm text-txt-disabled">Loading positions...</Text>
                                            </View>
                                        ) : activePositions.length === 0 ? (
                                            <View className="p-10 items-center gap-3">
                                                <Ionicons name="bar-chart-outline" size={32} color={Theme.textDisabled} />
                                                <Text className="text-sm text-txt-disabled">No positions</Text>
                                            </View>
                                        ) : (
                                            <View className="bg-app-card rounded-xl overflow-hidden border border-border">
                                                {activePositions.map((position) => (
                                                    <PositionItem
                                                        key={`${position.marketTicker}-${position.side}`}
                                                        position={position}
                                                        onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: position.marketTicker } })}
                                                        onSell={() => handleOpenSell(position)}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {/* Previous Trades */}
                                <View style={styles.listPane}>
                                    <View className="pb-10">
                                        {isLoadingPositions ? (
                                            <View className="p-10 items-center gap-3">
                                                <ActivityIndicator size="small" color={Theme.textPrimary} />
                                                <Text className="text-sm text-txt-disabled">Loading positions...</Text>
                                            </View>
                                        ) : previousPositions.length === 0 ? (
                                            <View className="p-10 items-center gap-3">
                                                <Ionicons name="time-outline" size={32} color={Theme.textDisabled} />
                                                <Text className="text-sm text-txt-disabled">No positions</Text>
                                            </View>
                                        ) : (
                                            <View className="bg-app-card rounded-xl overflow-hidden border border-border">
                                                {previousPositions.map((position) => (
                                                    <PositionItem
                                                        key={`${position.marketTicker}-${position.side}`}
                                                        position={position}
                                                        isPrevious
                                                        onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: position.marketTicker } })}
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

            <SellPositionSheet
                visible={sellSheetVisible}
                onClose={() => {
                    setSellSheetVisible(false);
                    setSelectedPosition(null);
                }}
                onSell={handleSell}
                submitting={isSelling}
                position={selectedPosition}
            />

            <TradeQuoteSheet
                visible={showQuoteSheet && !!lastTradeInfo}
                onClose={() => {
                    setShowQuoteSheet(false);
                    setLastTradeId(null);
                    loadPositions();
                    loadUsdcBalance();
                }}
                onSubmit={async (quoteText: string) => {
                    await finalizeTrade(quoteText);
                }}
                onSkip={() => {
                    setShowQuoteSheet(false);
                    setLastTradeId(null);
                    loadPositions();
                    loadUsdcBalance();
                }}
                tradeInfo={lastTradeInfo || { side: 'yes', amount: '0', marketTitle: 'Market' }}
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
