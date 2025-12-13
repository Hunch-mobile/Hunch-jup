import { useUser } from "@/contexts/UserContext";
import { api, marketsApi } from "@/lib/api";
import { Event, Trade } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const UserPositionsSection = () => {
  const { backendUser } = useUser();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (backendUser) {
      loadUserTrades();
    }
  }, [backendUser]);

  const loadUserTrades = async () => {
    if (!backendUser) return;

    try {
      setLoading(true);
      const userTrades = await api.getUserTrades(backendUser.id, 5);
      setTrades(userTrades);
    } catch (err) {
      console.error("Failed to fetch user trades:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!backendUser) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.positionsSection}>
        <Text style={styles.positionsSectionTitle}>Your Recent Positions</Text>
        <ActivityIndicator size="small" color="#4ade80" />
      </View>
    );
  }

  if (trades.length === 0) {
    return null;
  }

  return (
    <View style={styles.positionsSection}>
      <View style={styles.positionsHeader}>
        <Text style={styles.positionsSectionTitle}>Your Recent Positions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.positionsScroll}>
        {trades.map((trade) => (
          <TouchableOpacity
            key={trade.id}
            style={styles.positionCard}
            onPress={() => router.push({ pathname: '/market/[ticker]', params: { ticker: trade.marketTicker } })}
          >
            <View style={styles.positionHeader}>
              <View style={[
                styles.sideBadge,
                trade.side === 'yes' ? styles.sideBadgeYes : styles.sideBadgeNo
              ]}>
                <Text style={[
                  styles.sideText,
                  trade.side === 'yes' ? styles.sideTextYes : styles.sideTextNo
                ]}>
                  {trade.side.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.positionAmount}>${parseFloat(trade.amount).toFixed(2)}</Text>
            <Text style={styles.positionTicker} numberOfLines={1}>{trade.marketTicker}</Text>
            <Text style={styles.positionDate}>
              {new Date(trade.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const EventCard = ({ item }: { item: Event }) => {
  const activeMarkets = item.markets?.filter(
    market => market.status === 'active'
  ) || [];

  const handlePress = () => {
    router.push({ pathname: '/event/[ticker]', params: { ticker: item.ticker } });
  };

  return (
    <TouchableOpacity style={styles.eventCard} activeOpacity={0.7} onPress={handlePress}>
      <View style={styles.eventCardLayout}>
        {/* Event Image - Left Side */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.eventImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.eventImagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="rgba(255, 255, 255, 0.3)" />
          </View>
        )}

        {/* Event Content - Right Side */}
        <View style={styles.eventContent}>
          {item.competition && (
            <Text style={styles.competitionText}>{item.competition}</Text>
          )}

          <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>

          {item.subtitle && (
            <Text style={styles.eventSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          )}

          {/* Event Stats */}
          <View style={styles.eventStats}>
            <View style={styles.statItem}>
              <Ionicons name="pulse" size={12} color="#4ade80" />
              <Text style={styles.statText}>{activeMarkets.length} markets</Text>
            </View>
            {item.volume && (
              <View style={styles.statItem}>
                <Ionicons name="trending-up" size={12} color="rgba(255, 255, 255, 0.4)" />
                <Text style={styles.statText}>${(item.volume / 1000000).toFixed(1)}M</Text>
              </View>
            )}
          </View>
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
      <LinearGradient
        colors={["#0a0a0f", "#12121a", "#1a1a2e"]}
        style={styles.gradient}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Home</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadEvents}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* User Positions Section */}
        <UserPositionsSection />

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4ade80" />
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
          />
        )}
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
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  eventCardLayout: {
    flexDirection: 'row',
    height: 120,
  },
  eventImage: {
    width: 120,
    height: 120,
  },
  eventImagePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  competitionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ade80',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
    marginBottom: 4,
  },
  eventSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  eventStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  positionsSection: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  positionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  positionsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  viewAllText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  positionsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  positionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  positionHeader: {
    marginBottom: 8,
  },
  sideBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sideBadgeYes: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  sideBadgeNo: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  sideText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sideTextYes: {
    color: '#4ade80',
  },
  sideTextNo: {
    color: '#f87171',
  },
  positionAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  positionTicker: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  positionDate: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
