import { marketsApi } from "@/lib/api";
import { Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MarketCard = ({ item }: { item: Market }) => (
  <TouchableOpacity style={styles.card} activeOpacity={0.7}>
    <View style={styles.cardHeader}>
      <View style={styles.volumeContainer}>
        <Ionicons name="stats-chart" size={12} color="rgba(255, 255, 255, 0.5)" />
        <Text style={styles.volumeText}>${(item.volume || 0).toLocaleString()} Vol</Text>
      </View>
      {item.status === 'active' && (
        <View style={styles.hotBadge}>
          <Text style={styles.hotText}>Active</Text>
        </View>
      )}
    </View>

    <Text style={styles.marketTitle}>{item.title}</Text>

    <View style={styles.cardFooter}>
      <View style={styles.chanceContainer}>
        {/* Placeholder for chance since API might not return it directly without calculation */}
        <Text style={styles.chanceLabel}>Volume</Text>
        <Text style={styles.chanceValue}>${(item.volume || 0).toLocaleString()}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Trade</Text>
        </TouchableOpacity>
      </View>
    </View>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      const data = await marketsApi.fetchMarkets(50);
      // Filter out non-active markets for better UX
      const activeMarkets = data.filter(
        market => market.status !== 'finalized' &&
          market.status !== 'resolved' &&
          market.status !== 'closed'
      );
      setMarkets(activeMarkets);
    } catch (err) {
      console.error("Failed to fetch markets:", err);
      setError("Failed to load markets");
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
          <Text style={styles.headerTitle}>Markets</Text>
          <TouchableOpacity style={styles.filterButton} onPress={loadMarkets}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4ade80" />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadMarkets}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={markets}
            keyExtractor={(item) => item.ticker}
            renderItem={({ item }) => <MarketCard item={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadMarkets}
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
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for tab bar
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
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
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
  hotBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)', // Green background for active
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  hotText: {
    color: '#4ade80', // Green text for active
    fontSize: 10,
    fontWeight: '600',
  },
  marketTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    lineHeight: 24,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  chanceLabel: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '500',
  },
  chanceValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  actions: {},
  actionButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  actionButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
});
