import { MarketRail } from "@/components/MarketRail";
import { marketsApi } from "@/lib/api";
import { formatPercent, getTopMarkets } from "@/lib/marketUtils";
import { Event, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import theme from central location
import { Theme } from '@/constants/theme';

// Theme constants
const ACCENT = Theme.accentSubtle;
const BG_MAIN = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;
const SUCCESS = Theme.success;
const ERROR = Theme.error;

const EventCard = ({ item }: { item: Event }) => {
  // Get top 2 markets sorted by highest probability
  const topMarkets = getTopMarkets(item.markets, 2);

  const handlePress = () => {
    router.push({ pathname: '/event/[ticker]', params: { ticker: item.ticker } });
  };

  return (
    <TouchableOpacity style={styles.eventCard} activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.eventCardLayout}>
        {/* Left - Event Image */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.eventImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.eventImagePlaceholder}>
            <Ionicons name="image-outline" size={24} color={TEXT_DISABLED} />
          </View>
        )}

        {/* Right Content */}
        <View style={styles.eventContent}>
          {item.competition && (
            <Text style={styles.competitionText}>{item.competition}</Text>
          )}

          <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>

          {/* Top Markets - Clean List */}
          {topMarkets.length > 0 && (
            <View style={styles.marketsContainer}>
              {topMarkets.map((market: Market) => (
                <View key={market.ticker} style={styles.marketRow}>
                  <Text style={styles.marketTitle} numberOfLines={1}>
                    {market.yesSubTitle || market.title}
                  </Text>
                  <Text style={styles.marketPercent}>
                    {formatPercent(market.yesBid)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function HomeScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await marketsApi.fetchEvents(50, {
        status: 'active',
        withNestedMarkets: true
      });
      // Filter events that have active markets
      const eventsWithActiveMarkets = data.filter(event => {
        const activeMarkets = event.markets?.filter(
          market => market.status === 'active'
        ) || [];
        return activeMarkets.length > 0;
      });
      setEvents(eventsWithActiveMarkets);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Clean white background */}

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.headerLogo}
            contentFit="contain"
            contentPosition={{ left: 0 }}
          />
          <TouchableOpacity style={styles.refreshButton} onPress={loadEvents}>
            <Ionicons name="refresh" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadEvents}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.ticker}
            renderItem={({ item }) => <EventCard item={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadEvents}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={<MarketRail />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_MAIN,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerLogo: {
    width: 120,
    height: 40,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  listContent: {
    paddingBottom: 80,
  },
  separator: {
    height: 1,
    backgroundColor: BORDER,
    opacity: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: ERROR,
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: Theme.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: Theme.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  eventCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  eventCardLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  eventImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  eventImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
    gap: 6,
  },
  competitionText: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  marketsContainer: {
    gap: 4,
    marginTop: 4,
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  marketTitle: {
    flex: 1,
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginRight: 8,
  },
  marketPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
});
