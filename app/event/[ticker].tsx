import { marketsApi } from "@/lib/api";
import { Event, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MarketCard = ({ item }: { item: Market }) => {
  const handlePress = () => {
    router.push({ pathname: '/market/[ticker]', params: { ticker: item.ticker } });
  };

  // Calculate probability from bid/ask if available
  const yesBid = item.yesBid ? parseFloat(item.yesBid) * 100 : null;
  const yesAsk = item.yesAsk ? parseFloat(item.yesAsk) * 100 : null;
  const probability = yesBid && yesAsk ? ((yesBid + yesAsk) / 2).toFixed(1) : null;

  return (
    <TouchableOpacity style={styles.marketCard} activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.marketHeader}>
        <View style={styles.volumeContainer}>
          <Ionicons name="stats-chart" size={12} color="rgba(255, 255, 255, 0.5)" />
          <Text style={styles.volumeText}>${((item.volume || 0) / 1000).toFixed(1)}K Vol</Text>
        </View>
        {item.status === 'active' && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>Active</Text>
          </View>
        )}
      </View>

      <Text style={styles.marketTitle}>{item.title}</Text>

      {item.yesSubTitle && item.noSubTitle && (
        <View style={styles.outcomeLabels}>
          <View style={styles.outcomeLabelItem}>
            <Text style={styles.outcomeLabel}>Yes: {item.yesSubTitle}</Text>
          </View>
        </View>
      )}

      <View style={styles.marketFooter}>
        <View style={styles.volumeInfoContainer}>
          {probability ? (
            <>
              <Text style={styles.volumeLabel}>Probability</Text>
              <Text style={styles.volumeValue}>{probability}%</Text>
            </>
          ) : (
            <>
              <Text style={styles.volumeLabel}>Volume</Text>
              <Text style={styles.volumeValue}>${((item.volume || 0) / 1000).toFixed(1)}K</Text>
            </>
          )}
        </View>
        <TouchableOpacity style={styles.tradeButton}>
          <Text style={styles.tradeButtonText}>Trade</Text>
          <Ionicons name="arrow-forward" size={14} color="#4ade80" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default function EventDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const activeMarkets = event?.markets?.filter(
    market => market.status !== 'finalized' &&
      market.status !== 'resolved' &&
      market.status !== 'closed'
  ) || [];

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0a0a0f", "#12121a", "#1a1a2e"]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4ade80" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0a0a0f", "#12121a", "#1a1a2e"]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.centerContainer}>
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
      <LinearGradient colors={["#0a0a0f", "#12121a", "#1a1a2e"]} style={styles.gradient} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={loadEventDetails}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Event Image */}
          {event.imageUrl && (
            <Image
              source={{ uri: event.imageUrl }}
              style={styles.eventImage}
              contentFit="cover"
              transition={200}
            />
          )}

          <View style={styles.eventHeader}>
            {event.competition && (
              <View style={styles.competitionBadge}>
                <Text style={styles.competitionText}>{event.competition}</Text>
                {event.competitionScope && (
                  <Text style={styles.competitionScope}> • {event.competitionScope}</Text>
                )}
              </View>
            )}
            <Text style={styles.eventTitle}>{event.title}</Text>
            {event.subtitle && (
              <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
            )}
            <View style={styles.eventMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="pulse" size={16} color="#4ade80" />
                <Text style={styles.metaText}>{activeMarkets.length} Active Markets</Text>
              </View>
              {event.volume && (
                <View style={styles.metaItem}>
                  <Ionicons name="trending-up" size={16} color="rgba(255, 255, 255, 0.5)" />
                  <Text style={styles.metaText}>${(event.volume / 1000000).toFixed(2)}M Volume</Text>
                </View>
              )}
              {event.liquidity && (
                <View style={styles.metaItem}>
                  <Ionicons name="water" size={16} color="rgba(255, 255, 255, 0.5)" />
                  <Text style={styles.metaText}>${(event.liquidity / 1000000).toFixed(2)}M Liquidity</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.marketsSection}>
            <Text style={styles.sectionTitle}>Markets</Text>
            {activeMarkets.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="information-circle-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyText}>No active markets available</Text>
              </View>
            ) : (
              activeMarkets.map((market) => (
                <MarketCard key={market.ticker} item={market} />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  eventImage: {
    width: '100%',
    height: 240,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  eventHeader: {
    padding: 20,
    marginBottom: 12,
  },
  competitionBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  competitionText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  competitionScope: {
    color: 'rgba(74, 222, 128, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 40,
  },
  eventSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
    lineHeight: 22,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  marketsSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    marginTop: 12,
  },
  marketCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  volumeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  activeBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  activeText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '600',
  },
  marketTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    lineHeight: 22,
  },
  marketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  volumeInfoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  volumeLabel: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '500',
  },
  volumeValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  outcomeLabels: {
    marginBottom: 12,
    gap: 6,
  },
  outcomeLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outcomeLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  tradeButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tradeButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
});

