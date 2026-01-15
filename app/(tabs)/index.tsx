import { MarketRail } from "@/components/MarketRail";
import { Theme } from '@/constants/theme';
import { marketsApi } from "@/lib/api";
import { formatPercent, getTopMarkets } from "@/lib/marketUtils";
import { Event, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EventCard = ({ item }: { item: Event }) => {
  const topMarkets = getTopMarkets(item.markets, 2);

  const handlePress = () => {
    router.push({ pathname: '/event/[ticker]', params: { ticker: item.ticker } });
  };

  return (
    <TouchableOpacity
      className="py-4 px-5 bg-transparent"
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <View className="flex-row items-start gap-4">
        {/* Left - Event Image */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            className="w-[70px] h-[70px] rounded-[10px]"
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="w-[70px] h-[70px] rounded-[10px] bg-app-card justify-center items-center">
            <Ionicons name="image-outline" size={24} color={Theme.textDisabled} />
          </View>
        )}

        {/* Right Content */}
        <View className="flex-1 gap-1.5">
          {item.competition && (
            <Text className="text-[10px] font-semibold text-txt-secondary uppercase tracking-wider">
              {item.competition}
            </Text>
          )}

          <Text className="text-[15px] font-semibold text-txt-primary leading-5" numberOfLines={2}>
            {item.title}
          </Text>

          {/* Top Markets */}
          {topMarkets.length > 0 && (
            <View className="gap-1 mt-1">
              {topMarkets.map((market: Market) => (
                <View key={market.ticker} className="flex-row items-center justify-between py-1">
                  <Text className="flex-1 text-[13px] text-txt-secondary mr-2" numberOfLines={1}>
                    {market.yesSubTitle || market.title}
                  </Text>
                  <Text className="text-[13px] font-bold text-txt-primary">
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
    <View className="flex-1 bg-app-bg">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-3 flex-row justify-between items-center">
          <Image
            source={require('../../assets/images/logo.png')}
            className="w-[120px] h-10"
            contentFit="contain"
            contentPosition={{ left: 0 }}
          />
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-app-card justify-center items-center border border-border"
            onPress={loadEvents}
          >
            <Ionicons name="refresh" size={20} color={Theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={Theme.accentSubtle} />
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-status-error text-base mb-3">{error}</Text>
            <TouchableOpacity
              className="bg-txt-primary py-2.5 px-5 rounded-lg"
              onPress={loadEvents}
            >
              <Text className="text-txt-inverse text-sm font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.ticker}
            renderItem={({ item }) => <EventCard item={item} />}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadEvents}
            ItemSeparatorComponent={() => (
              <View className="h-px bg-border opacity-50" />
            )}
            ListHeaderComponent={<MarketRail />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
