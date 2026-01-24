import { MarketTradeSheet } from '@/components/MarketTradeSheet';
import { MultiMarketChart } from '@/components/MultiMarketChart';
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { marketsApi } from "@/lib/api";
import { Event, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


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
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartScrollEnabled, setChartScrollEnabled] = useState(true);
  const [marketSheetVisible, setMarketSheetVisible] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [walletProvider, setWalletProvider] = useState<any>(null);

  const connection = useMemo(() => {
    const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
    return new Connection(rpcUrl, 'confirmed');
  }, []);
  const solanaWallet = wallets?.[0];

  // Get wallet provider
  useEffect(() => {
    const getProvider = async () => {
      if (solanaWallet) {
        try {
          const provider = await solanaWallet.getProvider();
          setWalletProvider(provider);
        } catch (error) {
          console.error('Failed to get wallet provider:', error);
        }
      }
    };
    getProvider();
  }, [solanaWallet]);

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
  };

  const handleCloseMarketSheet = () => {
    setMarketSheetVisible(false);
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

      <MarketTradeSheet
        visible={marketSheetVisible}
        onClose={handleCloseMarketSheet}
        onTradeSuccess={() => {}}
        market={selectedMarket}
        backendUser={backendUser || null}
        walletProvider={walletProvider}
        connection={connection}
        eventTitle={event?.title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    width: '100%',
    height: '100%',
  },
});
