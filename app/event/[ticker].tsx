import CustomKeypad from "@/components/CustomKeypad";
import { MultiMarketChart } from '@/components/MultiMarketChart';
import TradeQuoteSheet from "@/components/TradeQuoteSheet";
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, marketsApi } from "@/lib/api";
import { executeTrade, toRawAmount, USDC_MINT } from "@/lib/tradeService";
import { Event, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

// MarketCard for the list below charts
const MarketCard = ({ item, onPress }: { item: Market; onPress: () => void }) => {

  const yesBid = item.yesBid ? parseFloat(item.yesBid) * 100 : null;
  const yesAsk = item.yesAsk ? parseFloat(item.yesAsk) * 100 : null;
  const probability = yesBid && yesAsk ? ((yesBid + yesAsk) / 2) : null;
  const displayTitle = item.yesSubTitle || item.title;

  return (
    <TouchableOpacity
      className="bg-app-card rounded-[16px] p-4 mb-3 border border-border"
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View className="flex-row justify-between items-center gap-3">
        <View className="flex-1 flex-row items-start gap-2.5 pr-2">
          <Text className="flex-1 text-[15px] font-semibold text-txt-primary leading-[21px]" numberOfLines={2}>
            {displayTitle}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xl font-bold text-txt-primary min-w-[50px] text-right">
            {probability ? `${probability.toFixed(0)}%` : '--'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Theme.textDisabled} />
        </View>
      </View>
      {item.subtitle && (
        <Text className="mt-1 text-xs text-txt-secondary" numberOfLines={1}>
          {item.subtitle}
        </Text>
      )}
      {item.volume && item.volume > 0 && (
        <Text className="mt-2 text-xs text-txt-secondary font-medium">
          Vol: ${((item.volume || 0) / 1000).toFixed(1)}K
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default function EventDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const { backendUser } = useUser();
  const { wallets } = useEmbeddedSolanaWallet();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartScrollEnabled, setChartScrollEnabled] = useState(true);
  const [marketSheetVisible, setMarketSheetVisible] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [amountKeypadOpen, setAmountKeypadOpen] = useState(false);
  const [showQuoteSheet, setShowQuoteSheet] = useState(false);
  const [lastTradeId, setLastTradeId] = useState<string | null>(null);
  const sheetHeight = Math.round(Dimensions.get("window").height * 0.82);
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;

  const connection = useMemo(() => {
    const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
    return new Connection(rpcUrl, 'confirmed');
  }, []);
  const solanaWallet = wallets?.[0];

  useEffect(() => {
    if (ticker) {
      loadEventDetails();
    }
  }, [ticker]);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await marketsApi.fetchEventDetails(ticker as string);
      setEvent(data);
    } catch (err) {
      console.error("Failed to fetch event details:", err);
      setError("Failed to load event details");
    } finally {
      setLoading(false);
    }
  };

  const activeMarkets = useMemo(() => {
    const markets = event?.markets?.filter(
      market => market.status !== 'finalized' &&
        market.status !== 'resolved' &&
        market.status !== 'closed'
    ) || [];

    return markets.sort((a, b) => {
      const aYesBid = a.yesBid ? parseFloat(a.yesBid) * 100 : 0;
      const aYesAsk = a.yesAsk ? parseFloat(a.yesAsk) * 100 : 0;
      const aProbability = aYesBid && aYesAsk ? (aYesBid + aYesAsk) / 2 : 0;

      const bYesBid = b.yesBid ? parseFloat(b.yesBid) * 100 : 0;
      const bYesAsk = b.yesAsk ? parseFloat(b.yesAsk) * 100 : 0;
      const bProbability = bYesBid && bYesAsk ? (bYesBid + bYesAsk) / 2 : 0;

      return bProbability - aProbability;
    });
  }, [event?.markets]);

  const topMarketsForCharts = useMemo(() => {
    return [...activeMarkets]
      .filter(m => m.yesMint || (m.accounts && Object.values(m.accounts).some(a => a?.yesMint)))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 4);
  }, [activeMarkets]);

  const handleOpenMarketSheet = (marketItem: Market) => {
    setSelectedMarket(marketItem);
    setMarketSheetVisible(true);
    setSelectedSide('yes');
    setAmount('');
    setTradeError(null);
  };

  const handleCloseMarketSheet = () => {
    setMarketSheetVisible(false);
  };

  useEffect(() => {
    if (marketSheetVisible) {
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 30,
        stiffness: 400,
        mass: 0.9,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: sheetHeight,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [marketSheetVisible, sheetAnim, sheetHeight]);

  const getProbability = (marketItem?: Market | null) => {
    if (marketItem?.yesBid && marketItem?.yesAsk) {
      return (parseFloat(marketItem.yesBid) + parseFloat(marketItem.yesAsk)) / 2 * 100;
    }
    return 50;
  };

  const handleTrade = async () => {
    if (!selectedMarket || !backendUser || !amount || parseFloat(amount) <= 0) return;
    if (!solanaWallet) {
      setTradeError("Wallet not connected");
      return;
    }

    Keyboard.dismiss();
    setIsTrading(true);
    setTradeError(null);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const outcomeMint = selectedSide === 'yes' ? selectedMarket.yesMint : selectedMarket.noMint;
      if (!outcomeMint) {
        throw new Error(`No ${selectedSide} mint found for this market`);
      }

      const rawAmount = toRawAmount(parseFloat(amount), 6);
      const provider = await solanaWallet.getProvider();
      const { signature, order } = await executeTrade({
        provider,
        connection,
        userPublicKey: backendUser.walletAddress,
        inputMint: USDC_MINT,
        outputMint: outcomeMint,
        amount: rawAmount,
        slippageBps: 100,
      });

      const trade = await api.createTrade({
        userId: backendUser.id,
        marketTicker: selectedMarket.ticker,
        eventTicker: selectedMarket.eventTicker,
        side: selectedSide,
        action: 'BUY',
        amount: amount,
        walletAddress: backendUser.walletAddress,
        transactionSig: signature,
        executedInAmount: order.inAmount,
        executedOutAmount: order.outAmount,
        isDummy: false,
      });

      setLastTradeId(trade.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowQuoteSheet(true);
    } catch (err: any) {
      console.error("Trade placement error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      let errorMessage = "Failed to place trade";
      if (err.message?.includes("insufficient") || err.message?.includes("balance")) {
        errorMessage = "Insufficient balance";
      } else if (err.message?.includes("rejected") || err.message?.includes("cancelled") || err.message?.includes("denied")) {
        errorMessage = "Transaction cancelled";
      } else if (err.message?.includes("market")) {
        errorMessage = "Market not available";
      } else if (err.message?.includes("timeout")) {
        errorMessage = "Transaction timeout - check your wallet";
      } else if (err.message) {
        errorMessage = err.message.length > 50 ? err.message.slice(0, 50) + '...' : err.message;
      }
      setTradeError(errorMessage);
    } finally {
      setIsTrading(false);
    }
  };

  const handleQuoteSubmit = async (quote: string) => {
    if (lastTradeId) {
      try {
        await api.updateTradeQuote(lastTradeId, quote);
      } catch (err) {
        console.error("Failed to update quote:", err);
      }
    }
    setShowQuoteSheet(false);
    setAmount('');
  };

  const handleQuoteSkip = () => {
    setShowQuoteSheet(false);
    setAmount('');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-app-bg">
        <LinearGradient colors={[Theme.bgMain, Theme.bgCard]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView className="flex-1">
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={Theme.accentSubtle} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-app-bg">
        <LinearGradient colors={[Theme.bgMain, Theme.bgCard]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView className="flex-1">
          <View className="flex-row px-5 pt-3">
            <TouchableOpacity
              className="w-8 h-8 rounded-full bg-app-card justify-center items-center"
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={Theme.textPrimary} />
            </TouchableOpacity>
          </View>
          <View className="flex-1 justify-center items-center px-10">
            <Ionicons name="alert-circle-outline" size={64} color={Theme.error} />
            <Text className="text-status-error text-base mt-4 mb-3 text-center">
              {error || "Event not found"}
            </Text>
            <TouchableOpacity
              className="bg-app-card py-2.5 px-5 rounded-[10px] border border-border"
              onPress={loadEventDetails}
            >
              <Text className="text-txt-primary text-sm font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app-bg">
      <LinearGradient colors={[Theme.bgMain, Theme.bgCard]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          scrollEnabled={chartScrollEnabled}
        >
          {/* Hero Section */}
          <View className="relative h-[220px] overflow-hidden">
            {event.imageUrl ? (
              <Image
                source={{ uri: event.imageUrl }}
                style={styles.heroImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="w-full h-full bg-app-card justify-center items-center">
                <Ionicons name="image-outline" size={48} color={Theme.textDisabled} />
              </View>
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)', Theme.bgMain]}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Back Button */}
            <TouchableOpacity
              className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 justify-center items-center"
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={20} color={Theme.textPrimary} />
            </TouchableOpacity>

            {/* Event Info */}
            <View className="absolute bottom-0 left-0 right-0 p-4">
              {event.competition && (
                <View className="self-start bg-cyan-500/15 px-2.5 py-1 rounded-md mb-2">
                  <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: Theme.accentSubtle }}>
                    {event.competition}
                  </Text>
                </View>
              )}
              <Text className="text-[22px] font-bold text-txt-primary leading-7" numberOfLines={2}>
                {event.title}
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View className="flex-row px-4 py-3 gap-4">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="pulse" size={14} color={Theme.accentSubtle} />
              <Text className="text-txt-secondary text-[13px] font-semibold">
                {activeMarkets.length} Markets
              </Text>
            </View>
            {event.volume && event.volume > 0 && (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="trending-up" size={14} color={Theme.textSecondary} />
                <Text className="text-txt-secondary text-[13px] font-semibold">
                  ${(event.volume / 1000000).toFixed(1)}M Vol
                </Text>
              </View>
            )}
          </View>

          {/* Charts Section */}
          {topMarketsForCharts.length > 0 && (
            <View className="mt-2">
              <MultiMarketChart
                markets={topMarketsForCharts}
                onInteractionStart={() => setChartScrollEnabled(false)}
                onInteractionEnd={() => setChartScrollEnabled(true)}
              />
            </View>
          )}

          {/* Markets List */}
          <View className="mt-6 px-4">
            <Text className="text-lg font-bold text-txt-primary mb-3">Markets</Text>
            {activeMarkets.length === 0 ? (
              <View className="items-center py-10 gap-2">
                <Ionicons name="bar-chart-outline" size={40} color={Theme.textDisabled} />
                <Text className="text-txt-disabled text-sm">No markets available</Text>
              </View>
            ) : (
              activeMarkets.map((market) => (
                <MarketCard
                  key={market.ticker}
                  item={market}
                  onPress={() => handleOpenMarketSheet(market)}
                />
              ))
            )}
          </View>

          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={marketSheetVisible} transparent animationType="fade" onRequestClose={handleCloseMarketSheet}>
        <Pressable className="flex-1 justify-end" onPress={handleCloseMarketSheet}>
          <BlurView intensity={20} tint="default" style={StyleSheet.absoluteFillObject} />
          <View style={styles.sheetBackdrop} />
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 20),
                transform: [{ translateY: sheetAnim }],
                height: sheetHeight,
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="items-center py-2">
                <View className="w-12 h-1.5 rounded-full bg-border" />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row gap-2 flex-1">
                    <TouchableOpacity
                      className="flex-1 py-3 rounded-xl"
                      onPress={() => { setSelectedSide('yes'); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                    >
                      <Text className={`text-center font-semibold ${selectedSide === 'yes' ? 'text-status-success' : 'text-txt-disabled'}`}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 py-3 rounded-xl"
                      onPress={() => { setSelectedSide('no'); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                    >
                      <Text className={`text-center font-semibold ${selectedSide === 'no' ? 'text-status-error' : 'text-txt-disabled'}`}>No</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    className="w-9 h-9 rounded-full bg-app-card border border-border justify-center items-center ml-3"
                    onPress={handleCloseMarketSheet}
                  >
                    <Ionicons name="close" size={18} color={Theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View className="mb-4">
                  <View className="flex-row items-start justify-between gap-3 mb-2">
                    <Text className="text-xl font-bold text-txt-primary flex-1" numberOfLines={2}>
                      {selectedMarket?.title || 'Market'}
                    </Text>
                    <Text className="text-sm font-semibold text-txt-secondary">
                      {getProbability(selectedMarket).toFixed(1)}%
                    </Text>
                  </View>
                  <View className="rounded-full bg-yellow-200 px-3 py-1 self-start">
                    <Text className="text-sm font-semibold text-black" numberOfLines={1}>
                      {selectedMarket?.subtitle || selectedMarket?.yesSubTitle || selectedMarket?.noSubTitle || 'Market'}
                    </Text>
                  </View>
                </View>

                <View className="bg-app-card rounded-[20px] p-5 mb-4 border border-border">

                  <View className="mb-4">
                    <Text className="text-txt-secondary text-xs font-bold uppercase tracking-wide mb-2.5">Amount</Text>
                    <View className="flex-row items-center bg-app-elevated rounded-[14px] border border-border px-4">
                      <Text className="text-txt-secondary text-2xl font-semibold">$</Text>
                      <Pressable className="flex-1" onPress={() => setAmountKeypadOpen(true)}>
                        <Text className="text-txt-primary text-[28px] font-bold py-3.5 pl-1.5">
                          {amount || "0"}
                        </Text>
                      </Pressable>
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
                  </View>

                  {parseFloat(amount || '0') > 0 && (
                    <View className="bg-cyan-500/10 rounded-xl p-3.5 mb-4 border border-cyan-500/15">
                      <View className="flex-row justify-between mb-1.5">
                        <Text className="text-txt-secondary text-[13px]">If you win</Text>
                        <Text className="text-txt-primary text-sm font-bold">
                          ${(parseFloat(amount) * (100 / getProbability(selectedMarket))).toFixed(2)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-txt-secondary text-[13px]">Profit</Text>
                        <Text className="text-status-success text-sm font-bold">
                          +${((parseFloat(amount) * (100 / getProbability(selectedMarket))) - parseFloat(amount)).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {tradeError && (
                    <View className="flex-row items-center gap-2 bg-red-400/10 rounded-[10px] p-3 mb-4 border border-red-400/20">
                      <Ionicons name="alert-circle" size={18} color={Theme.error} />
                      <Text className="text-status-error text-[13px] font-medium flex-1">{tradeError}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    className={`rounded-[14px] overflow-hidden ${(!backendUser || isTrading || parseFloat(amount || '0') <= 0) ? 'opacity-70' : ''}`}
                    onPress={handleTrade}
                    disabled={!backendUser || isTrading || parseFloat(amount || '0') <= 0}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={!backendUser || isTrading || parseFloat(amount || '0') <= 0 ? [Theme.bgElevated, Theme.bgElevated] : [Theme.accentSubtle, '#00B8D4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 }}
                    >
                      {isTrading ? (
                        <ActivityIndicator size="small" color={Theme.bgMain} />
                      ) : (
                        <>
                          <Text className={`text-base font-bold ${!backendUser || parseFloat(amount || '0') <= 0 ? 'text-txt-disabled' : 'text-app-bg'}`}>
                            {parseFloat(amount || '0') > 0 ? `Bet $${parseFloat(amount).toFixed(2)} on ${selectedSide.toUpperCase()}` : 'Enter Amount'}
                          </Text>
                          {backendUser && parseFloat(amount || '0') > 0 && <Ionicons name="arrow-forward" size={18} color={Theme.bgMain} />}
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap gap-3 mb-4">
                  <View className="bg-app-card rounded-xl p-3 border border-border min-w-[30%] flex-1">
                    <Text className="text-[10px] text-txt-disabled uppercase font-semibold">Status</Text>
                    <Text className="text-sm font-semibold text-txt-primary mt-1">
                      {selectedMarket?.status || '—'}
                    </Text>
                  </View>
                  <View className="bg-app-card rounded-xl p-3 border border-border min-w-[30%] flex-1">
                    <Text className="text-[10px] text-txt-disabled uppercase font-semibold">Volume</Text>
                    <Text className="text-sm font-semibold text-txt-primary mt-1">
                      ${((selectedMarket?.volume || 0) / 1000).toFixed(1)}K
                    </Text>
                  </View>
                  {selectedMarket?.closeTime && (
                    <View className="bg-app-card rounded-xl p-3 border border-border min-w-[30%] flex-1">
                      <Text className="text-[10px] text-txt-disabled uppercase font-semibold">Closes</Text>
                      <Text className="text-sm font-semibold text-txt-primary mt-1">
                        {new Date(selectedMarket.closeTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  )}
                </View>

                {(selectedMarket?.yesSubTitle || selectedMarket?.noSubTitle) && (
                  <View className="bg-app-card rounded-2xl p-4 border border-border mb-4">
                    {selectedMarket?.yesSubTitle && (
                      <Text className="text-sm text-txt-secondary mb-2">
                        <Text className="font-bold text-status-success">Yes</Text> = {selectedMarket.yesSubTitle}
                      </Text>
                    )}
                    {selectedMarket?.noSubTitle && (
                      <Text className="text-sm text-txt-secondary">
                        <Text className="font-bold text-status-error">No</Text> = {selectedMarket.noSubTitle}
                      </Text>
                    )}
                  </View>
                )}
                {selectedMarket?.rulesPrimary && (
                  <View className="bg-app-card rounded-2xl p-4 border border-border">
                    <Text className="text-base font-bold text-txt-primary mb-2">Rules</Text>
                    <Text className="text-sm text-txt-secondary leading-6">
                      {selectedMarket.rulesPrimary}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <TradeQuoteSheet
        visible={showQuoteSheet}
        onClose={() => setShowQuoteSheet(false)}
        onSubmit={handleQuoteSubmit}
        onSkip={handleQuoteSkip}
        tradeInfo={{
          side: selectedSide,
          amount: amount,
          marketTitle: selectedMarket?.title || 'Market',
        }}
      />
      <CustomKeypad
        visible={amountKeypadOpen}
        value={amount}
        onChange={(next) => { setAmount(next.replace(',', '.')); setTradeError(null); }}
        onClose={() => setAmountKeypadOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    width: '100%',
    height: '100%',
  },
  sheet: {
    backgroundColor: Theme.bgMain,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Theme.border,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
