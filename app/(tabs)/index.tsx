import { FilterPills } from "@/components/FilterPills";
import { MarketRail } from "@/components/MarketRail";
import { MiniNewsCarousel } from "@/components/MiniNewsCarousel";
import { Theme } from '@/constants/theme';
import { api, marketsApi } from "@/lib/api";
import { formatPercent, getTopMarkets } from "@/lib/marketUtils";
import { Event, EventEvidence, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Filter active events (events with at least one active market)
const isEventActive = (event: Event): boolean => {
  const activeMarkets = event.markets?.filter(
    market => market.status === 'active'
  ) || [];
  return activeMarkets.length > 0;
};

// Sort events by volume (highest first)
const sortByVolume = (events: Event[]): Event[] => {
  return [...events].sort((a, b) => (b.volume || 0) - (a.volume || 0));
};

// Chunk array into smaller pieces (for API batching)
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

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

// Default categories fallback
const DEFAULT_CATEGORIES = [
  'All',
  'Climate and Weather',
  'Companies',
  'Crypto',
  'Economics',
  'Elections',
  'Entertainment',
  'Financials',
  'Mentions',
  'Politics',
  'Science and Technology',
  'Social',
  'Sports',
  'Transportation',
];

// Cache for tags response
let tagsCache: { categories: string[]; timestamp: number } | null = null;
const TAGS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// News event tickers for evidence
const NEWS_EVENT_TICKERS = ['KXFEDDECISION-26JAN', 'KXFEDCHAIRNOM-29'];

// Feed item types for mixed list
type FeedItem =
  | { type: 'event'; data: Event }
  | { type: 'news'; data: EventEvidence[] };

export default function HomeScreen() {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [events, setEvents] = useState<Event[]>([]);
  const [newsItems, setNewsItems] = useState<EventEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const isLoadingRef = useRef(false);

  // Load categories and news on mount
  useEffect(() => {
    loadCategories();
    loadNews();
  }, []);

  // Load events when category changes
  useEffect(() => {
    loadEventsForCategory(selectedCategory, true);
  }, [selectedCategory]);

  // Load news evidence
  const loadNews = async () => {
    try {
      const evidence = await api.fetchEvidence(NEWS_EVENT_TICKERS);
      setNewsItems(evidence);
    } catch (err) {
      console.error('Failed to load news:', err);
    }
  };

  const loadCategories = async () => {
    try {
      // Check cache first
      if (tagsCache && Date.now() - tagsCache.timestamp < TAGS_CACHE_DURATION) {
        setCategories(tagsCache.categories);
        return;
      }

      const tagsResponse = await marketsApi.fetchTags();
      const categoryNames = Object.keys(tagsResponse.tagsByCategories);
      const allCategories = ['All', ...categoryNames];

      tagsCache = { categories: allCategories, timestamp: Date.now() };
      setCategories(allCategories);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      // Use default categories as fallback
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const loadEventsForCategory = async (category: string, reset: boolean = false) => {
    if (isLoadingRef.current && !reset) return;
    isLoadingRef.current = true;

    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setCursor(undefined);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      let fetchedEvents: Event[] = [];
      let newCursor: string | undefined;

      if (category === 'All') {
        // Flow 1: Fetch all events with pagination
        const result = await marketsApi.fetchEvents(20, {
          status: 'active',
          withNestedMarkets: true,
          cursor: reset ? undefined : cursor,
        });
        fetchedEvents = result.events;
        newCursor = result.cursor;
      } else {
        // Flow 2: Fetch series for category, then events by series tickers
        const series = await marketsApi.fetchSeries(category, {
          isInitialized: true,
          status: 'active',
        });

        const tickers = series.map(s => s.ticker);

        if (tickers.length === 0) {
          fetchedEvents = [];
        } else {
          // Split into chunks of 25 for API limits
          const tickerChunks = chunkArray(tickers, 25);
          const allEvents: Event[] = [];

          for (const chunk of tickerChunks) {
            const chunkEvents = await marketsApi.fetchEventsBySeries(chunk, {
              withNestedMarkets: true,
              status: 'active',
            });
            allEvents.push(...chunkEvents);
          }

          fetchedEvents = allEvents;
        }
        // No pagination for category-specific events
        newCursor = undefined;
      }

      // Filter and sort events
      const activeEvents = fetchedEvents.filter(isEventActive);
      const sortedEvents = sortByVolume(activeEvents);

      if (reset) {
        setEvents(sortedEvents);
      } else {
        setEvents(prev => [...prev, ...sortedEvents]);
      }

      setCursor(newCursor);
      setHasMore(!!newCursor && activeEvents.length > 0);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      if (reset) {
        setError("Failed to load events");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  };

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleLoadMore = useCallback(() => {
    // Only paginate for "All" category
    if (
      selectedCategory === 'All' &&
      hasMore &&
      !loading &&
      !loadingMore &&
      cursor
    ) {
      loadEventsForCategory(selectedCategory, false);
    }
  }, [selectedCategory, hasMore, loading, loadingMore, cursor]);

  const handleRefresh = useCallback(() => {
    loadEventsForCategory(selectedCategory, true);
  }, [selectedCategory]);

  // Create mixed feed items (events + news carousel every 4 events)
  const feedItems: FeedItem[] = [];
  const NEWS_INTERVAL = 4; // Insert news after every 4 events

  events.forEach((event, index) => {
    feedItems.push({ type: 'event', data: event });

    // Insert news carousel after every NEWS_INTERVAL events (but only once if we have news)
    if (newsItems.length > 0 && (index + 1) % NEWS_INTERVAL === 0 && index < NEWS_INTERVAL) {
      feedItems.push({ type: 'news', data: newsItems });
    }
  });

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'news') {
      return <MiniNewsCarousel items={item.data} />;
    }
    return <EventCard item={item.data} />;
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={Theme.accentSubtle} />
      </View>
    );
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
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={20} color={Theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Filter Pills - Fixed at top */}
        <FilterPills
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />

        {/* Scrollable content: MarketRail + Events + News */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={Theme.accentSubtle} />
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-status-error text-base mb-3">{error}</Text>
            <TouchableOpacity
              className="bg-txt-primary py-2.5 px-5 rounded-lg"
              onPress={handleRefresh}
            >
              <Text className="text-txt-inverse text-sm font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={feedItems}
            keyExtractor={(item, index) =>
              item.type === 'news' ? `news-${index}` : `event-${item.data.ticker}`
            }
            renderItem={renderFeedItem}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={handleRefresh}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={<MarketRail />}
            ListFooterComponent={renderFooter}
            ItemSeparatorComponent={({ leadingItem }) =>
              leadingItem?.type === 'event' ? (
                <View className="h-px bg-border opacity-50" />
              ) : null
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-20">
                <Ionicons name="search-outline" size={48} color={Theme.textDisabled} />
                <Text className="text-txt-secondary text-base mt-4">
                  No events found
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
