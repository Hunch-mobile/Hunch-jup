import { marketsApi } from "@/lib/api";
import { Event, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MultiMarketChart } from '@/components/MultiMarketChart';
import { Theme } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Simplified MarketCard for the list below charts
const MarketCard = ({ item, isCompact = false }: { item: Market; isCompact?: boolean }) => {
  const handlePress = () => {
    router.push({ pathname: '/market/[ticker]', params: { ticker: item.ticker } });
  };

  const yesBid = item.yesBid ? parseFloat(item.yesBid) * 100 : null;
  const yesAsk = item.yesAsk ? parseFloat(item.yesAsk) * 100 : null;
  const probability = yesBid && yesAsk ? ((yesBid + yesAsk) / 2) : null;

  // Use yesSubTitle if available, otherwise fallback to title
  const displayTitle = item.yesSubTitle || item.title;

  return (
    <TouchableOpacity style={styles.marketCard} activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.marketCardRow}>
        <View style={styles.marketCardLeft}>
          <Text style={styles.marketTitle} numberOfLines={2}>{displayTitle}</Text>
        </View>
        <View style={styles.marketCardRight}>
          <Text style={styles.probabilityValue}>
            {probability ? `${probability.toFixed(0)}%` : '--'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Theme.textDisabled} />
        </View>
      </View>
      {item.volume && item.volume > 0 && (
        <Text style={styles.volumeText}>
          Vol: ${((item.volume || 0) / 1000).toFixed(1)}K
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default function EventDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartScrollEnabled, setChartScrollEnabled] = useState(true);

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

  // Filter active markets and sort by highest YES percentage
  const activeMarkets = useMemo(() => {
    const markets = event?.markets?.filter(
      market => market.status !== 'finalized' &&
        market.status !== 'resolved' &&
        market.status !== 'closed'
    ) || [];

    // Sort by YES percentage (highest first)
    return markets.sort((a, b) => {
      const aYesBid = a.yesBid ? parseFloat(a.yesBid) * 100 : 0;
      const aYesAsk = a.yesAsk ? parseFloat(a.yesAsk) * 100 : 0;
      const aProbability = aYesBid && aYesAsk ? (aYesBid + aYesAsk) / 2 : 0;

      const bYesBid = b.yesBid ? parseFloat(b.yesBid) * 100 : 0;
      const bYesAsk = b.yesAsk ? parseFloat(b.yesAsk) * 100 : 0;
      const bProbability = bYesBid && bYesAsk ? (bYesBid + bYesAsk) / 2 : 0;

      return bProbability - aProbability; // Descending order
    });
  }, [event?.markets]);

  // Get top 4 markets by volume for charts
  const topMarketsForCharts = useMemo(() => {
    return [...activeMarkets]
      .filter(m => m.yesMint || (m.accounts && Object.values(m.accounts).some(a => a?.yesMint)))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 4);
  }, [activeMarkets]);

  // Remaining markets not in the chart section
  const remainingMarkets = useMemo(() => {
    const topTickers = new Set(topMarketsForCharts.map(m => m.ticker));
    return activeMarkets.filter(m => !topTickers.has(m.ticker));
  }, [activeMarkets, topMarketsForCharts]);

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Theme.bgMain, Theme.bgCard]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Theme.accentSubtle} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[Theme.bgMain, Theme.bgCard]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={Theme.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={Theme.error} />
            <Text style={styles.errorText}>{error || "Event not found"}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadEventDetails}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Theme.bgMain, Theme.bgCard]} style={styles.gradient} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={chartScrollEnabled}
        >
          {/* Compact Hero Section */}
          <View style={styles.heroContainer}>
            {event.imageUrl ? (
              <Image
                source={{ uri: event.imageUrl }}
                style={styles.heroImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Ionicons name="image-outline" size={48} color={Theme.textDisabled} />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)', Theme.bgMain]}
              style={styles.heroGradient}
            />

            {/* Back Button */}
            <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={Theme.textPrimary} />
            </TouchableOpacity>

            {/* Event Info Overlay */}
            <View style={styles.heroContent}>
              {event.competition && (
                <View style={styles.competitionBadge}>
                  <Text style={styles.competitionText}>{event.competition}</Text>
                </View>
              )}
              <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="pulse" size={14} color={Theme.accentSubtle} />
              <Text style={styles.statText}>{activeMarkets.length} Markets</Text>
            </View>
            {event.volume && event.volume > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="trending-up" size={14} color={Theme.textSecondary} />
                <Text style={styles.statText}>${(event.volume / 1000000).toFixed(1)}M Vol</Text>
              </View>
            )}
          </View>

          {/* Top Markets Charts Section */}
          {topMarketsForCharts.length > 0 && (
            <View style={styles.chartsSection}>
              <MultiMarketChart
                markets={topMarketsForCharts}
                onInteractionStart={() => setChartScrollEnabled(false)}
                onInteractionEnd={() => setChartScrollEnabled(true)}
              />
            </View>
          )}

          {/* All Markets List */}
          <View style={styles.marketsSection}>
            <Text style={styles.sectionTitle}>Markets</Text>
            {activeMarkets.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bar-chart-outline" size={40} color={Theme.textDisabled} />
                <Text style={styles.emptyText}>No markets available</Text>
              </View>
            ) : (
              activeMarkets.map((market) => (
                <MarketCard key={market.ticker} item={market} />
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.bgMain,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Hero Section - Compact
  heroContainer: {
    position: 'relative',
    height: 200,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Theme.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  competitionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(63, 227, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  competitionText: {
    color: Theme.accentSubtle,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.textPrimary,
    lineHeight: 28,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: Theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Charts Section
  chartsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  chartsList: {
    paddingHorizontal: 16,
  },
  // Markets Section
  marketsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  // Market Card - Simplified
  marketCard: {
    backgroundColor: Theme.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  marketCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  marketCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.accentSubtle,
    marginTop: 4,
  },
  marketTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Theme.textPrimary,
    lineHeight: 21,
  },
  marketCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  probabilityValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Theme.textPrimary,
    minWidth: 50,
    textAlign: 'right',
  },
  volumeText: {
    marginTop: 8,
    fontSize: 12,
    color: Theme.textSecondary,
    fontWeight: '500',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: Theme.textDisabled,
    fontSize: 14,
  },
  // Error/Loading States
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: Theme.error,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Theme.bgCard,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.border,
  },
  retryText: {
    color: Theme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
