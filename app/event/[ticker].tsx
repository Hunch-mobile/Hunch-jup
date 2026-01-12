import { marketsApi } from "@/lib/api";
import { Event, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import theme from central location
import { Theme } from '@/constants/theme';

// Theme constants
const ACCENT = Theme.accentSubtle;
const BG_MAIN = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BG_ELEVATED = Theme.bgElevated;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;
const SUCCESS = Theme.success;
const ERROR = Theme.error;

const MarketCard = ({ item }: { item: Market }) => {
  const handlePress = () => {
    router.push({ pathname: '/market/[ticker]', params: { ticker: item.ticker } });
  };

  // Calculate probability from bid/ask if available
  const yesBid = item.yesBid ? parseFloat(item.yesBid) * 100 : null;
  const yesAsk = item.yesAsk ? parseFloat(item.yesAsk) * 100 : null;
  const probability = yesBid && yesAsk ? ((yesBid + yesAsk) / 2) : null;

  return (
    <TouchableOpacity style={styles.marketCard} activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.marketCardContent}>
        <View style={styles.marketTop}>
          <View style={styles.marketTopLeft}>
            {item.status === 'active' && (
              <View style={styles.activeDot} />
            )}
            <Text style={styles.marketTitle} numberOfLines={2}>{item.title}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={TEXT_DISABLED} />
        </View>

        {item.yesSubTitle && (
          <Text style={styles.outcomeLabel} numberOfLines={1}>
            Yes: {item.yesSubTitle}
          </Text>
        )}

        <View style={styles.marketStats}>
          <View style={styles.statRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Probability</Text>
              <Text style={styles.statValue}>
                {probability ? `${probability.toFixed(1)}%` : '--'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValue}>
                ${((item.volume || 0) / 1000).toFixed(1)}K
              </Text>
            </View>
          </View>
        </View>

        {probability && (
          <View style={styles.probabilityBar}>
            <View style={[styles.probabilityFill, { width: `${probability}%` }]} />
          </View>
        )}
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
        <LinearGradient colors={[BG_MAIN, BG_CARD]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[BG_MAIN, BG_CARD]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={ERROR} />
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
      <LinearGradient colors={[BG_MAIN, BG_CARD]} style={styles.gradient} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Hero Image with Overlay */}
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
                <Ionicons name="image-outline" size={64} color={TEXT_DISABLED} />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)', BG_MAIN]}
              style={styles.heroGradient}
            />
            
            {/* Floating Header */}
            <View style={styles.floatingHeader}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
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

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Ionicons name="pulse" size={14} color={ACCENT} />
              <Text style={styles.statPillText}>{activeMarkets.length} Markets</Text>
            </View>
            {event.volume && (
              <View style={styles.statPill}>
                <Ionicons name="trending-up" size={14} color={TEXT_SECONDARY} />
                <Text style={styles.statPillText}>${(event.volume / 1000000).toFixed(1)}M Vol</Text>
              </View>
            )}
            {event.liquidity && (
              <View style={styles.statPill}>
                <Ionicons name="water" size={14} color={TEXT_SECONDARY} />
                <Text style={styles.statPillText}>${(event.liquidity / 1000000).toFixed(1)}M Liq</Text>
              </View>
            )}
          </View>
        </View>

        {/* Markets Section */}
        <View style={styles.marketsSection}>
          <Text style={styles.sectionTitle}>Markets</Text>
          {activeMarkets.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bar-chart-outline" size={48} color={TEXT_DISABLED} />
              </View>
              <Text style={styles.emptyText}>No active markets</Text>
              <Text style={styles.emptySubtext}>Check back later for new markets</Text>
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
    backgroundColor: BG_MAIN,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
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
  // Hero Section
  heroContainer: {
    position: 'relative',
    height: 320,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    zIndex: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  // Event Info
  eventInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  competitionBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: `rgba(63, 227, 255, 0.12)`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `rgba(63, 227, 255, 0.2)`,
  },
  competitionText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  competitionScope: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    lineHeight: 36,
  },
  eventSubtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    marginBottom: 16,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BG_CARD,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  statPillText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  // Markets Section
  marketsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  // Market Card
  marketCard: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  marketCardContent: {
    padding: 16,
  },
  marketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  marketTopLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
    marginTop: 7,
  },
  marketTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 21,
  },
  outcomeLabel: {
    fontSize: 12,
    color: TEXT_DISABLED,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  marketStats: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  probabilityBar: {
    height: 4,
    backgroundColor: BG_ELEVATED,
    borderRadius: 999,
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 999,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtext: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  // Error State
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: ERROR,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: BG_CARD,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  retryText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
});

